import { describe, expect, it } from "vitest";
import { makeExecute, makeLineup } from "../test/fixtures";
import { executeSchema, isRealDate, lineupSchema, mapFileSchema } from "./schema";

const pathsOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.map(String).join(".")) ?? [];

describe("isRealDate", () => {
  it.each([
    ["2026-10-10", true],
    ["2024-02-29", true],
    ["2026-02-30", false],
    ["2026-2-3", false],
    ["abcd", false],
  ])("%s → %s", (value, expected) => {
    expect(isRealDate(value)).toBe(expected);
  });
});

describe("lineupSchema", () => {
  it("accepts a complete lineup", () => {
    expect(lineupSchema.safeParse(makeLineup()).success).toBe(true);
  });

  it("accepts a lineup without notes, start or end", () => {
    const { notes: _notes, ...rest } = makeLineup();
    const lineup = { ...rest, video: { url: "https://youtu.be/dQw4w9WgXcQ" } };
    expect(lineupSchema.safeParse(lineup).success).toBe(true);
  });

  it.each([
    ["an id that is not kebab-case", { id: "Mirage_Window" }, "id"],
    ["an empty name", { name: "" }, "name"],
    ["a name with a leading space", { name: " Window" }, "name"],
    ["a name over 40 characters", { name: "x".repeat(41) }, "name"],
    ["an unknown side", { side: "TT" }, "side"],
    ["an unknown area", { area: "C" }, "area"],
    ["x above 1", { stand: { x: 1.2, y: 0.5 } }, "stand.x"],
    ["y below 0", { land: { x: 0.5, y: -0.1 } }, "land.y"],
    ["an unknown level", { land: { x: 0.5, y: 0.5, level: "middle" } }, "land.level"],
    ["an http video URL", { video: { url: "http://youtu.be/dQw4w9WgXcQ" } }, "video.url"],
    ["a video URL that is not a URL", { video: { url: "not a url" } }, "video.url"],
    [
      "a negative start",
      { video: { url: "https://youtu.be/dQw4w9WgXcQ", start: -1 } },
      "video.start",
    ],
    [
      "a fractional end",
      { video: { url: "https://youtu.be/dQw4w9WgXcQ", end: 10.5 } },
      "video.end",
    ],
    ["notes over 280 characters", { notes: "x".repeat(281) }, "notes"],
    ["an unknown status", { status: "done" }, "status"],
    ["an impossible date", { checkedOn: "2026-02-30" }, "checkedOn"],
  ])("rejects %s", (_label, override, path) => {
    const result = lineupSchema.safeParse({ ...makeLineup(), ...override });
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain(path);
  });

  it("rejects unknown fields", () => {
    expect(lineupSchema.safeParse({ ...makeLineup(), extra: 1 }).success).toBe(false);
  });
});

describe("executeSchema", () => {
  it("accepts a valid execute", () => {
    expect(executeSchema.safeParse(makeExecute()).success).toBe(true);
  });

  it("rejects fewer than 2 or more than 8 smokes", () => {
    expect(executeSchema.safeParse(makeExecute({ lineupIds: ["mirage-a"] })).success).toBe(false);
    const nine = Array.from({ length: 9 }, (_, i) => `mirage-smoke-${i}`);
    expect(executeSchema.safeParse(makeExecute({ lineupIds: nine })).success).toBe(false);
  });
});

describe("mapFileSchema", () => {
  it("accepts an empty map file", () => {
    expect(mapFileSchema.safeParse({ map: "nuke", lineups: [], executes: [] }).success).toBe(true);
  });

  it("rejects a map outside the pool", () => {
    expect(mapFileSchema.safeParse({ map: "overpass", lineups: [], executes: [] }).success).toBe(
      false,
    );
  });
});
