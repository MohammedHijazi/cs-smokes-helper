import { describe, expect, it } from "vitest";
import { MAP_IDS } from "../data/schema";
import { validateDataFiles } from "../data/validate";
import { FIXTURE_DATA } from "./fixtureData";

describe("FIXTURE_DATA", () => {
  it("is valid data", () => {
    const files = MAP_IDS.map((map) => ({ fileName: `${map}.json`, content: FIXTURE_DATA[map] }));
    expect(validateDataFiles(files)).toEqual([]);
  });
});
