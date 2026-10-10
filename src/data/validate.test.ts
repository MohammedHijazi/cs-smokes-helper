import { describe, expect, it } from "vitest";
import { makeExecute, makeLineup, makeMapFile } from "../test/fixtures";
import { MAP_IDS, type MapId } from "./schema";
import { formatPath, validateDataFiles, type DataFile } from "./validate";

function filesWith(overrides: Partial<Record<MapId, unknown>> = {}): DataFile[] {
  return MAP_IDS.map((map) => ({
    fileName: `${map}.json`,
    content: overrides[map] ?? makeMapFile(map),
  }));
}

const VIDEO = "https://youtu.be/dQw4w9WgXcQ";

describe("formatPath", () => {
  it("joins keys and indexes", () => {
    expect(formatPath(["lineups", 0, "video", "end"])).toBe("lineups[0].video.end");
    expect(formatPath([])).toBe("");
  });
});

describe("validateDataFiles", () => {
  it("accepts seven valid files", () => {
    expect(validateDataFiles(filesWith())).toEqual([]);
  });

  it("reports a missing file", () => {
    const files = filesWith().filter((f) => f.fileName !== "cache.json");
    expect(validateDataFiles(files)).toEqual([
      { file: "cache.json", path: "", message: "file is missing" },
    ]);
  });

  it("reports a file that is not one of the seven maps", () => {
    const errors = validateDataFiles([...filesWith(), { fileName: "overpass.json", content: {} }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ file: "overpass.json", path: "" });
    expect(errors[0].message).toContain("unexpected file");
  });

  it("reports a file that is not valid JSON without also calling it missing", () => {
    const files = filesWith().map((f) =>
      f.fileName === "mirage.json"
        ? { fileName: "mirage.json", content: undefined, parseError: "Unexpected token" }
        : f,
    );
    expect(validateDataFiles(files)).toEqual([
      { file: "mirage.json", path: "", message: "not valid JSON: Unexpected token" },
    ]);
  });

  it("reports schema problems with a readable path", () => {
    const bad = makeMapFile("mirage", [makeLineup({ stand: { x: 2, y: 0.5 } })]);
    const errors = validateDataFiles(filesWith({ mirage: bad }));
    expect(errors.map((e) => e.path)).toEqual(["lineups[0].stand.x"]);
  });

  it("requires map to match the file name", () => {
    const errors = validateDataFiles(filesWith({ mirage: makeMapFile("nuke") }));
    expect(errors).toEqual([
      { file: "mirage.json", path: "map", message: 'must be "mirage" to match the file name' },
    ]);
  });

  it("requires ids to start with the map id", () => {
    const bad = makeMapFile("mirage", [makeLineup({ id: "dust2-window-from-t-spawn" })]);
    const errors = validateDataFiles(filesWith({ mirage: bad }));
    expect(errors).toEqual([
      { file: "mirage.json", path: "lineups[0].id", message: 'must start with "mirage-"' },
    ]);
  });

  it("finds duplicate ids within a file, across lineups and executes, and across files", () => {
    const mirage = makeMapFile(
      "mirage",
      [
        makeLineup(),
        makeLineup(),
        makeLineup({ id: "mirage-ct-from-t-ramp" }),
        makeLineup({ id: "mirage-jungle-from-t-ramp" }),
      ],
      [makeExecute({ id: "mirage-ct-from-t-ramp" })],
    );
    const nuke = makeMapFile("nuke", [
      makeLineup({
        id: "mirage-window-from-t-spawn",
        stand: { x: 0.1, y: 0.1, level: "upper" },
        land: { x: 0.2, y: 0.2, level: "upper" },
      }),
    ]);
    const messages = validateDataFiles(filesWith({ mirage, nuke })).map(
      (e) => `${e.file} ${e.path}: ${e.message}`,
    );
    expect(messages).toEqual([
      'mirage.json lineups[1].id: duplicate id "mirage-window-from-t-spawn" (also at mirage.json → lineups[0])',
      'mirage.json executes[0].id: duplicate id "mirage-ct-from-t-ramp" (also at mirage.json → lineups[2])',
      'nuke.json lineups[0].id: must start with "nuke-"',
      'nuke.json lineups[0].id: duplicate id "mirage-window-from-t-spawn" (also at mirage.json → lineups[0])',
    ]);
  });

  it("requires levels on Nuke and forbids them elsewhere", () => {
    const nuke = makeMapFile("nuke", [makeLineup({ id: "nuke-outside-from-t-roof" })]);
    const mirage = makeMapFile("mirage", [
      makeLineup({ stand: { x: 0.1, y: 0.1, level: "upper" } }),
    ]);
    const messages = validateDataFiles(filesWith({ nuke, mirage })).map(
      (e) => `${e.file} ${e.path}: ${e.message}`,
    );
    expect(messages).toEqual([
      "mirage.json lineups[0].stand.level: is only allowed on Nuke",
      "nuke.json lineups[0].stand.level: is required on Nuke",
      "nuke.json lineups[0].land.level: is required on Nuke",
    ]);
  });

  it("allows start and end only on YouTube URLs", () => {
    const bad = makeMapFile("mirage", [
      makeLineup({ video: { url: "https://csnades.gg/mirage/smokes/window", start: 5 } }),
    ]);
    expect(validateDataFiles(filesWith({ mirage: bad }))).toEqual([
      {
        file: "mirage.json",
        path: "lineups[0].video",
        message: "start and end are only allowed on YouTube URLs",
      },
    ]);
  });

  it("requires end after the effective start, including a start taken from the URL", () => {
    const bad = makeMapFile("mirage", [makeLineup({ video: { url: `${VIDEO}?t=100`, end: 90 } })]);
    expect(validateDataFiles(filesWith({ mirage: bad }))).toEqual([
      {
        file: "mirage.json",
        path: "lineups[0].video.end",
        message: "must be greater than the start (100s)",
      },
    ]);
    const good = makeMapFile("mirage", [
      makeLineup({ video: { url: `${VIDEO}?t=100`, end: 120 } }),
    ]);
    expect(validateDataFiles(filesWith({ mirage: good }))).toEqual([]);
  });

  it("checks execute references, sides and repeats", () => {
    const mirage = makeMapFile(
      "mirage",
      [
        makeLineup({ id: "mirage-ct-from-t-ramp" }),
        makeLineup({ id: "mirage-top-mid-from-ct-spawn", side: "CT" }),
      ],
      [
        makeExecute({
          lineupIds: [
            "mirage-ct-from-t-ramp",
            "mirage-ct-from-t-ramp",
            "mirage-top-mid-from-ct-spawn",
            "mirage-nowhere",
          ],
        }),
      ],
    );
    const messages = validateDataFiles(filesWith({ mirage })).map((e) => `${e.path}: ${e.message}`);
    expect(messages).toEqual([
      'executes[0].lineupIds[1]: "mirage-ct-from-t-ramp" is listed twice',
      'executes[0].lineupIds[2]: "mirage-top-mid-from-ct-spawn" is a CT smoke but the execute is T',
      'executes[0].lineupIds[3]: "mirage-nowhere" is not a smoke in mirage.json',
    ]);
  });
});
