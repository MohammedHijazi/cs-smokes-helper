import { describe, expect, it } from "vitest";
import { sequenceRng } from "../test/rng";
import { shuffle } from "./random";

describe("shuffle", () => {
  it("keeps every element and leaves the input alone", () => {
    const input = [1, 2, 3, 4, 5];
    const output = shuffle(input, sequenceRng(0.3, 0.9, 0.1, 0.6));
    expect([...output].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it("is a Fisher–Yates shuffle driven by the generator", () => {
    expect(shuffle([1, 2, 3, 4, 5], () => 0)).toEqual([2, 3, 4, 5, 1]);
    expect(shuffle([1, 2, 3, 4, 5], () => 0.999)).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles an empty list", () => {
    expect(shuffle([])).toEqual([]);
  });
});
