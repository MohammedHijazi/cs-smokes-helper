import { describe, expect, it } from "vitest";
import { makeLineup } from "../test/fixtures";
import {
  DEFAULT_FILTERS,
  applyFilters,
  filtersToSearch,
  neighbours,
  parseFilters,
} from "./filters";

describe("parseFilters", () => {
  it("reads valid values and falls back to defaults", () => {
    expect(parseFilters(new URLSearchParams("side=CT&area=B&level=lower"))).toEqual({
      side: "CT",
      area: "B",
      level: "lower",
    });
    expect(parseFilters(new URLSearchParams("side=X&area=&level=middle"))).toEqual(DEFAULT_FILTERS);
  });
});

describe("filtersToSearch", () => {
  it("writes only non-default values", () => {
    expect(filtersToSearch(DEFAULT_FILTERS)).toBe("");
    expect(filtersToSearch({ side: "T", area: "all", level: "lower" })).toBe("?side=T&level=lower");
  });
});

describe("applyFilters", () => {
  const a = makeLineup({ id: "mirage-a", side: "T", area: "A" });
  const b = makeLineup({ id: "mirage-b", side: "CT", area: "B" });

  it("filters by side and area", () => {
    expect(applyFilters([a, b], { ...DEFAULT_FILTERS, side: "CT" }, false)).toEqual([b]);
    expect(applyFilters([a, b], { ...DEFAULT_FILTERS, area: "A" }, false)).toEqual([a]);
  });

  it("filters by the landing spot's level only on maps with levels", () => {
    const upper = makeLineup({ id: "nuke-up", land: { x: 0.1, y: 0.1, level: "upper" } });
    const lower = makeLineup({ id: "nuke-low", land: { x: 0.1, y: 0.1, level: "lower" } });
    expect(applyFilters([upper, lower], DEFAULT_FILTERS, true)).toEqual([upper]);
    expect(applyFilters([upper, lower], { ...DEFAULT_FILTERS, level: "lower" }, true)).toEqual([
      lower,
    ]);
    expect(applyFilters([upper, lower], { ...DEFAULT_FILTERS, level: "lower" }, false)).toEqual([
      upper,
      lower,
    ]);
  });
});

describe("neighbours", () => {
  const list = ["a", "b", "c"].map((id) => makeLineup({ id: `mirage-${id}` }));

  it("finds the previous and next smoke", () => {
    expect(neighbours(list, "mirage-b")).toEqual({ prev: list[0], next: list[2] });
    expect(neighbours(list, "mirage-a")).toEqual({ prev: undefined, next: list[1] });
  });

  it("returns nothing for a smoke that isn't in the list", () => {
    expect(neighbours(list, "mirage-z")).toEqual({});
  });
});
