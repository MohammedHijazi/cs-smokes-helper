import { describe, expect, it } from "vitest";
import { sequenceRng } from "../test/rng";
import { COMMON_TECHNIQUES, techniqueChoices, techniqueText } from "./technique";

describe("techniqueText", () => {
  it.each([
    [{ movement: "stand", jump: true, click: "left" }, "Jump throw · left click"],
    [{ movement: "run", jump: true, click: "left" }, "Run + jump throw · left click"],
    [{ movement: "stand", jump: false, click: "right" }, "Standing throw · right click"],
    [{ movement: "crouch", jump: false, click: "left" }, "Crouch + throw · left click"],
    [{ movement: "walk", jump: false, click: "both" }, "Walk + throw · left + right click"],
  ] as const)("%o → %s", (throwSpec, text) => {
    expect(techniqueText(throwSpec)).toBe(text);
  });
});

describe("techniqueChoices", () => {
  const correct = "Jump throw · left click";

  it("returns the correct answer plus three different distractors", () => {
    const choices = techniqueChoices(correct, [], sequenceRng(0.42));
    expect(choices).toHaveLength(4);
    expect(choices).toContain(correct);
    expect(new Set(choices).size).toBe(4);
  });

  it("uses techniques from the same map first", () => {
    const sameMap = [
      "Run + jump throw · left click",
      "Walk + throw · left click",
      "Crouch + throw · right click",
      correct,
    ];
    const choices = techniqueChoices(correct, sameMap, sequenceRng(0.42));
    expect([...choices].sort()).toEqual([correct, ...sameMap.slice(0, 3)].sort());
  });

  it("fills up from the common list when the map has too few", () => {
    const rare = "Crouch + throw · right click";
    const choices = techniqueChoices(correct, [rare, rare], sequenceRng(0.42));
    expect(choices).toHaveLength(4);
    expect(new Set(choices).size).toBe(4);
    expect(choices).toContain(rare);
    for (const choice of choices) {
      if (choice !== correct && choice !== rare) expect(COMMON_TECHNIQUES).toContain(choice);
    }
  });
});
