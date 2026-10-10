import { describe, expect, it } from "vitest";
import { MAP_DATA, findLineup } from "./index";
import { MAP_IDS } from "./schema";
import { validateDataFiles } from "./validate";

describe("bundled data", () => {
  it("passes validation", () => {
    const files = MAP_IDS.map((map) => ({ fileName: `${map}.json`, content: MAP_DATA[map] }));
    expect(validateDataFiles(files)).toEqual([]);
  });

  it("returns undefined for an unknown smoke", () => {
    expect(findLineup("mirage", "mirage-does-not-exist")).toBeUndefined();
  });
});
