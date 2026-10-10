import { describe, expect, it } from "vitest";
import { makeExecute, makeLineup, makeMapFile } from "../../test/fixtures";
import {
  deleteConfirmText,
  deleteExecute,
  deleteLineup,
  idsOnSide,
  markReviewed,
  newExecuteId,
  newLineupId,
  nextUnreviewed,
  slug,
  takenIds,
  uniqueId,
  upsertExecute,
  upsertLineup,
} from "./mapEdits";

const WINDOW = makeLineup({ id: "mirage-window-from-t-spawn" });
const CT = makeLineup({ id: "mirage-ct-from-t-ramp", name: "CT", from: "T Ramp", status: "ok" });
const JUNGLE = makeLineup({ id: "mirage-jungle-from-t-ramp", name: "Jungle", from: "T Ramp" });
const TOP_MID = makeLineup({
  id: "mirage-top-mid-from-ct-spawn",
  name: "Top Mid",
  from: "CT Spawn",
  side: "CT",
  status: "broken",
});
const A_EXEC = makeExecute({
  id: "mirage-a-execute",
  name: "A execute",
  lineupIds: [WINDOW.id, CT.id, JUNGLE.id],
});
const B_SPLIT = makeExecute({
  id: "mirage-b-split",
  name: "B split",
  lineupIds: [CT.id, JUNGLE.id],
});
const MIRAGE = makeMapFile("mirage", [WINDOW, CT, JUNGLE, TOP_MID], [A_EXEC, B_SPLIT]);
const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

describe("slug", () => {
  it.each([
    ["Window", "window"],
    ["T Spawn", "t-spawn"],
    ["Café / Window", "cafe-window"],
    ["  A-site   (default) ", "a-site-default"],
    ["Ölçek", "olcek"],
    ["???", "smoke"],
    ["", "smoke"],
  ])("%j → %j", (text, expected) => {
    expect(slug(text)).toBe(expected);
  });
});

describe("ids", () => {
  const nuke = makeMapFile("nuke", [makeLineup({ id: "nuke-outside-from-t-roof" })]);
  const taken = takenIds([MIRAGE, nuke]);

  it("collects every lineup and execute id from every file", () => {
    expect(taken).toEqual(
      new Set([...ids(MIRAGE.lineups), ...ids(MIRAGE.executes), "nuke-outside-from-t-roof"]),
    );
  });

  it("builds a smoke id from map, name and from", () => {
    expect(newLineupId("mirage", "Stairs", "T Ramp", taken)).toBe("mirage-stairs-from-t-ramp");
  });

  it("adds -2, -3 … when the id is taken", () => {
    expect(newLineupId("mirage", "Window", "T Spawn", taken)).toBe("mirage-window-from-t-spawn-2");
    expect(uniqueId("mirage-a", new Set(["mirage-a", "mirage-a-2"]))).toBe("mirage-a-3");
  });

  it("builds an execute id from map and name", () => {
    expect(newExecuteId("mirage", "B execute", taken)).toBe("mirage-b-execute");
    expect(newExecuteId("mirage", "A execute", taken)).toBe("mirage-a-execute-2");
  });
});

describe("upsertLineup", () => {
  it("appends a new smoke", () => {
    const next = upsertLineup(MIRAGE, makeLineup({ id: "mirage-new" }));
    expect(ids(next.lineups)).toEqual([...ids(MIRAGE.lineups), "mirage-new"]);
  });

  it("replaces a smoke in place without touching the original file", () => {
    const edited = { ...CT, name: "CT box" };
    const next = upsertLineup(MIRAGE, edited);
    expect(next.lineups[1]).toBe(edited);
    expect(next.lineups).toHaveLength(4);
    expect(MIRAGE.lineups[1]).toBe(CT);
  });
});

describe("upsertExecute and deleteExecute", () => {
  it("appends a new execute and replaces an existing one in place", () => {
    const added = upsertExecute(MIRAGE, makeExecute({ id: "mirage-c-execute" }));
    expect(ids(added.executes)).toEqual([A_EXEC.id, B_SPLIT.id, "mirage-c-execute"]);
    const renamed = upsertExecute(MIRAGE, { ...A_EXEC, name: "A split" });
    expect(renamed.executes.map((e) => e.name)).toEqual(["A split", "B split"]);
  });

  it("deletes an execute and keeps its smokes", () => {
    const next = deleteExecute(MIRAGE, A_EXEC.id);
    expect(ids(next.executes)).toEqual([B_SPLIT.id]);
    expect(next.lineups).toBe(MIRAGE.lineups);
  });
});

describe("deleteLineup", () => {
  it("removes the smoke, shortens executes and deletes those left with fewer than 2", () => {
    const deletion = deleteLineup(MIRAGE, CT.id);
    expect(ids(deletion.file.lineups)).toEqual([WINDOW.id, JUNGLE.id, TOP_MID.id]);
    expect(deletion.file.executes).toEqual([{ ...A_EXEC, lineupIds: [WINDOW.id, JUNGLE.id] }]);
    expect(deletion.shortened).toEqual([A_EXEC]);
    expect(deletion.removed).toEqual([B_SPLIT]);
  });

  it("leaves executes alone when the smoke isn't in any", () => {
    const deletion = deleteLineup(MIRAGE, TOP_MID.id);
    expect(deletion.file.executes).toEqual(MIRAGE.executes);
    expect(deletion.shortened).toEqual([]);
    expect(deletion.removed).toEqual([]);
  });
});

describe("deleteConfirmText", () => {
  it("names the executes that change", () => {
    expect(deleteConfirmText(CT, deleteLineup(MIRAGE, CT.id))).toBe(
      "Delete 'CT from T Ramp'? It is also removed from 'A execute'. 'B split' is deleted too, because it would have fewer than 2 smokes.",
    );
  });

  it("is short when no execute changes", () => {
    expect(deleteConfirmText(TOP_MID, deleteLineup(MIRAGE, TOP_MID.id))).toBe(
      "Delete 'Top Mid from CT Spawn'?",
    );
  });

  it("uses the plural for several deleted executes", () => {
    const file = makeMapFile(
      "mirage",
      [WINDOW, CT],
      [
        makeExecute({ id: "mirage-x", name: "X", lineupIds: [WINDOW.id, CT.id] }),
        makeExecute({ id: "mirage-y", name: "Y", lineupIds: [CT.id, WINDOW.id] }),
      ],
    );
    expect(deleteConfirmText(WINDOW, deleteLineup(file, WINDOW.id))).toBe(
      "Delete 'Window from T Spawn'? 'X', 'Y' are deleted too, because they would have fewer than 2 smokes.",
    );
  });
});

describe("markReviewed", () => {
  it("sets ok and today", () => {
    expect(markReviewed(WINDOW, "2026-10-12")).toEqual({
      ...WINDOW,
      status: "ok",
      checkedOn: "2026-10-12",
    });
  });
});

describe("nextUnreviewed", () => {
  // WINDOW unreviewed, CT ok, JUNGLE unreviewed, TOP_MID broken
  const list = MIRAGE.lineups;

  it("finds the next unreviewed smoke after the current one", () => {
    expect(nextUnreviewed(list, WINDOW.id)).toBe(JUNGLE);
  });

  it("wraps round to the start", () => {
    expect(nextUnreviewed(list, JUNGLE.id)).toBe(WINDOW);
  });

  it("never returns the current smoke", () => {
    expect(nextUnreviewed([WINDOW, CT], WINDOW.id)).toBeUndefined();
  });

  it("starts from the top when the current smoke isn't in the list", () => {
    expect(nextUnreviewed([CT, JUNGLE, WINDOW], "mirage-not-listed")).toBe(JUNGLE);
  });

  it("returns undefined for an empty list", () => {
    expect(nextUnreviewed([], WINDOW.id)).toBeUndefined();
  });
});

describe("idsOnSide", () => {
  it("keeps only the smokes on that side, in order", () => {
    expect(idsOnSide([WINDOW.id, TOP_MID.id, CT.id], "T", MIRAGE.lineups)).toEqual([
      WINDOW.id,
      CT.id,
    ]);
    expect(idsOnSide([WINDOW.id, TOP_MID.id], "CT", MIRAGE.lineups)).toEqual([TOP_MID.id]);
  });
});
