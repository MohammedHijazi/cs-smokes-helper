import { describe, expect, it } from "vitest";
import { CLOSE_ENOUGH, isClose, nearestWithin, pointerToFraction } from "./radar";

describe("pointerToFraction", () => {
  it("converts a pointer position into fractions of the element", () => {
    expect(pointerToFraction(150, 300, { left: 100, top: 100, width: 400, height: 400 })).toEqual({
      x: 0.125,
      y: 0.5,
    });
    expect(pointerToFraction(400, 250, { left: 0, top: 0, width: 800, height: 500 })).toEqual({
      x: 0.5,
      y: 0.5,
    });
  });

  it("clamps positions outside the element", () => {
    expect(pointerToFraction(-10, 900, { left: 0, top: 0, width: 400, height: 400 })).toEqual({
      x: 0,
      y: 1,
    });
  });
});

describe("isClose", () => {
  it("accepts a tap within 0.06 and rejects one farther away", () => {
    expect(CLOSE_ENOUGH).toBe(0.06);
    expect(isClose({ x: 0, y: 0 }, { x: 0.06, y: 0 })).toBe(true);
    expect(isClose({ x: 0, y: 0 }, { x: 0.05, y: 0.04 })).toBe(false);
  });
});

describe("nearestWithin", () => {
  const items = [
    { id: "a", p: { x: 0.1, y: 0.1 } },
    { id: "b", p: { x: 0.15, y: 0.1 } },
  ];

  it("picks the nearest item inside the radius", () => {
    expect(nearestWithin(items, (i) => i.p, { x: 0.14, y: 0.1 }, 0.05)?.id).toBe("b");
  });

  it("returns undefined when nothing is inside the radius", () => {
    expect(nearestWithin(items, (i) => i.p, { x: 0.9, y: 0.9 }, 0.05)).toBeUndefined();
  });
});
