import { describe, expect, it } from "vitest";
import type { QueueItem } from "../../lib/scheduler";
import { makeLineup } from "../../test/fixtures";
import { answerSession, currentItem, isFinished, isRepeat, startSession } from "./session";

const item = (id: string): QueueItem => ({
  map: "mirage",
  lineup: makeLineup({ id }),
  isNew: true,
});

describe("study session", () => {
  it("goes through the cards in order", () => {
    let session = startSession([item("mirage-a"), item("mirage-b")]);
    expect(currentItem(session)?.lineup.id).toBe("mirage-a");
    session = answerSession(session, "got");
    expect(currentItem(session)?.lineup.id).toBe("mirage-b");
    session = answerSession(session, "got");
    expect(isFinished(session)).toBe(true);
    expect(session).toMatchObject({ got: 2, forgot: 0 });
  });

  it("shows a forgotten card once more at the end, and counts only first answers", () => {
    let session = startSession([item("mirage-a"), item("mirage-b")]);
    session = answerSession(session, "forgot");
    session = answerSession(session, "got");
    expect(currentItem(session)?.lineup.id).toBe("mirage-a");
    expect(isRepeat(session)).toBe(true);
    session = answerSession(session, "forgot");
    expect(isFinished(session)).toBe(true);
    expect(session).toMatchObject({ got: 1, forgot: 1 });
  });

  it("ignores answers after the end", () => {
    expect(answerSession(startSession([]), "got")).toEqual(startSession([]));
  });
});
