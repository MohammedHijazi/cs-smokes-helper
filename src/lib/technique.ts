import type { Throw } from "../data/schema";
import { shuffle, type Rng } from "./random";

const MOVEMENT_LABEL = { crouch: "Crouch", walk: "Walk", run: "Run" } as const;
const CLICK_LABEL = {
  left: "left click",
  right: "right click",
  both: "left + right click",
} as const;

export function techniqueText(t: Throw): string {
  const movement =
    t.movement === "stand"
      ? t.jump
        ? "Jump throw"
        : "Standing throw"
      : `${MOVEMENT_LABEL[t.movement]} + ${t.jump ? "jump throw" : "throw"}`;
  return `${movement} · ${CLICK_LABEL[t.click]}`;
}

export const COMMON_TECHNIQUES: readonly string[] = [
  "Jump throw · left click",
  "Run + jump throw · left click",
  "Standing throw · left click",
  "Standing throw · right click",
  "Standing throw · left + right click",
  "Walk + throw · left click",
  "Crouch + throw · left click",
];

/**
 * The correct technique plus three different distractors, in random order. Distractors come
 * first from other smokes on the same map, then from COMMON_TECHNIQUES.
 */
export function techniqueChoices(
  correct: string,
  sameMap: readonly string[],
  rng: Rng = Math.random,
): string[] {
  const fromMap = shuffle(
    [...new Set(sameMap)].filter((text) => text !== correct),
    rng,
  );
  const distractors = fromMap.slice(0, 3);
  for (const text of shuffle(COMMON_TECHNIQUES, rng)) {
    if (distractors.length >= 3) break;
    if (text !== correct && !distractors.includes(text)) distractors.push(text);
  }
  return shuffle([correct, ...distractors], rng);
}
