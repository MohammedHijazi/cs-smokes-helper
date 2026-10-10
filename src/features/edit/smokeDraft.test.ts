import { describe, expect, it } from "vitest";
import { makeExecute, makeLineup, makeMapFile } from "../../test/fixtures";
import {
  clock,
  draftFromLineup,
  emptyDraft,
  errorsForDraft,
  lineupFromDraft,
  seconds,
  withUrl,
  type SmokeDraft,
} from "./smokeDraft";

const TODAY = "2026-10-12";
const LINK = "https://youtu.be/dQw4w9WgXcQ?t=95";
const NEW_ID = { id: "mirage-stairs-from-t-ramp", today: TODAY };

const filled = (overrides: Partial<SmokeDraft> = {}): SmokeDraft => ({
  ...emptyDraft({ side: "T", area: "A" }),
  url: LINK,
  start: "95",
  end: "112",
  name: "Stairs",
  from: "T Ramp",
  stand: { x: 0.7, y: 0.3 },
  land: { x: 0.3, y: 0.2 },
  ...overrides,
});

describe("emptyDraft", () => {
  it("starts with nothing chosen except the throw defaults", () => {
    expect(emptyDraft()).toEqual({
      url: "",
      start: "",
      end: "",
      name: "",
      from: "",
      side: null,
      area: null,
      movement: "stand",
      jump: false,
      click: "left",
      stand: null,
      land: null,
      notes: "",
      status: "unreviewed",
    });
  });

  it("takes the side and area preset from the map filters", () => {
    expect(emptyDraft({ side: "CT", area: "B" })).toMatchObject({ side: "CT", area: "B" });
  });
});

describe("draftFromLineup", () => {
  it("round-trips a smoke through the form unchanged", () => {
    const lineup = makeLineup();
    expect(
      lineupFromDraft(draftFromLineup(lineup), { id: lineup.id, original: lineup, today: TODAY }),
    ).toEqual({
      ok: true,
      lineup,
    });
  });

  it("keeps Nuke levels", () => {
    const lineup = makeLineup({
      id: "nuke-ramp-from-lobby",
      stand: { x: 0.3, y: 0.6, level: "upper" },
      land: { x: 0.4, y: 0.7, level: "lower" },
    });
    expect(
      lineupFromDraft(draftFromLineup(lineup), { id: lineup.id, original: lineup, today: TODAY }),
    ).toEqual({
      ok: true,
      lineup,
    });
  });
});

describe("withUrl", () => {
  it("fills an empty Start from the link's t", () => {
    expect(withUrl(emptyDraft(), "https://youtu.be/dQw4w9WgXcQ?t=1m35s").start).toBe("95");
  });

  it("keeps a Start typed by hand", () => {
    expect(withUrl({ ...emptyDraft(), start: "40" }, LINK).start).toBe("40");
  });

  it("ends with the whole t when the link is typed one character at a time", () => {
    let draft = emptyDraft();
    for (let i = 1; i <= LINK.length; i += 1) draft = withUrl(draft, LINK.slice(0, i));
    expect(draft.start).toBe("95");
  });

  it("clears a Start that came from the link when the t goes away", () => {
    const draft = withUrl(emptyDraft(), LINK);
    expect(withUrl(draft, "https://youtu.be/dQw4w9WgXcQ").start).toBe("");
  });
});

describe("seconds and clock", () => {
  it("reads whole seconds only", () => {
    expect(seconds(" 95 ")).toBe(95);
    expect(seconds("9.5")).toBeUndefined();
    expect(seconds("")).toBeUndefined();
  });

  it("writes m:ss or h:mm:ss", () => {
    expect(clock(5)).toBe("0:05");
    expect(clock(95)).toBe("1:35");
    expect(clock(3723)).toBe("1:02:03");
  });
});

describe("lineupFromDraft", () => {
  it("builds a new smoke: unreviewed, checked today, fields in file order", () => {
    const result = lineupFromDraft(
      filled({ movement: "run", jump: true, notes: "  Aim at the antenna  " }),
      NEW_ID,
    );
    expect(result).toEqual({
      ok: true,
      lineup: {
        id: "mirage-stairs-from-t-ramp",
        name: "Stairs",
        from: "T Ramp",
        side: "T",
        area: "A",
        throw: { movement: "run", jump: true, click: "left" },
        stand: { x: 0.7, y: 0.3 },
        land: { x: 0.3, y: 0.2 },
        video: { url: LINK, start: 95, end: 112 },
        notes: "Aim at the antenna",
        status: "unreviewed",
        checkedOn: TODAY,
      },
    });
    expect(result.ok && Object.keys(result.lineup)).toEqual([
      "id",
      "name",
      "from",
      "side",
      "area",
      "throw",
      "stand",
      "land",
      "video",
      "notes",
      "status",
      "checkedOn",
    ]);
  });

  it("trims the link, name and from", () => {
    const result = lineupFromDraft(
      filled({ url: `  ${LINK} `, name: " Stairs ", from: "T Ramp " }),
      NEW_ID,
    );
    expect(result.ok && [result.lineup.video.url, result.lineup.name, result.lineup.from]).toEqual([
      LINK,
      "Stairs",
      "T Ramp",
    ]);
  });

  it("leaves out empty notes and empty clip times", () => {
    const result = lineupFromDraft(filled({ start: "", end: "", notes: "   " }), NEW_ID);
    expect(result.ok && result.lineup.video).toEqual({ url: LINK });
    expect(result.ok && "notes" in result.lineup).toBe(false);
  });

  it("drops clip times for links that aren't YouTube", () => {
    const url = "https://csnades.gg/mirage/smokes/stairs";
    const result = lineupFromDraft(filled({ url }), NEW_ID);
    expect(result.ok && result.lineup.video).toEqual({ url });
  });

  it("refuses clip times that aren't whole seconds", () => {
    expect(lineupFromDraft(filled({ start: "95.5", end: "1:52" }), NEW_ID)).toEqual({
      ok: false,
      errors: { start: ["must be whole seconds"], end: ["must be whole seconds"] },
    });
  });

  it("lists everything missing", () => {
    expect(lineupFromDraft(emptyDraft(), NEW_ID)).toEqual({
      ok: false,
      errors: {
        url: ["Paste a video link"],
        name: ["Enter the spot the smoke covers"],
        from: ["Enter where it is thrown from"],
        side: ["Choose a side"],
        area: ["Choose an area"],
        land: ["Place the land spot on the radar"],
        stand: ["Place the stand spot on the radar"],
      },
    });
  });

  it("keeps checkedOn when an edit leaves the status alone, and sets today when it changes", () => {
    const original = makeLineup({ checkedOn: "2026-10-10" });
    const context = { id: original.id, original, today: TODAY };
    const same = lineupFromDraft({ ...draftFromLineup(original), name: "Window box" }, context);
    expect(same.ok && same.lineup.checkedOn).toBe("2026-10-10");
    const changed = lineupFromDraft({ ...draftFromLineup(original), status: "ok" }, context);
    expect(changed.ok && changed.lineup.checkedOn).toBe(TODAY);
  });
});

describe("errorsForDraft", () => {
  const file = makeMapFile(
    "mirage",
    [makeLineup(), makeLineup({ id: "mirage-ct-from-t-ramp" })],
    [makeExecute({ name: "A execute" })],
  );

  it("puts each error about this smoke on its field", () => {
    expect(
      errorsForDraft(
        [
          { path: "lineups[1].name", message: "must be at most 40 characters" },
          { path: "lineups[1].video.end", message: "must be greater than the start (95s)" },
          { path: "lineups[1].video", message: "start and end are only allowed on YouTube URLs" },
          { path: "lineups[1].stand.level", message: "is required on Nuke" },
        ],
        1,
        file,
      ),
    ).toEqual({
      name: ["must be at most 40 characters"],
      end: ["must be greater than the start (95s)"],
      url: ["start and end are only allowed on YouTube URLs"],
      stand: ["is required on Nuke"],
    });
  });

  it("names the execute for errors in executes, and puts other errors at the top", () => {
    expect(
      errorsForDraft(
        [
          {
            path: "executes[0].lineupIds[1]",
            message: '"mirage-ct-from-t-ramp" is a CT smoke but the execute is T',
          },
          { path: "lineups[0].id", message: "duplicate id" },
          { path: "", message: "file is missing" },
        ],
        1,
        file,
      ),
    ).toEqual({
      form: [
        `Execute 'A execute': "mirage-ct-from-t-ramp" is a CT smoke but the execute is T`,
        "lineups[0].id: duplicate id",
        "file is missing",
      ],
    });
  });
});
