import type { QueueItem, Rating } from "../../lib/scheduler";

export interface Session {
  items: QueueItem[];
  /** How many items the session started with; anything after is an end-of-session repeat. */
  firstPass: number;
  index: number;
  got: number;
  forgot: number;
}

export function startSession(items: QueueItem[]): Session {
  return { items, firstPass: items.length, index: 0, got: 0, forgot: 0 };
}

export function currentItem(session: Session): QueueItem | undefined {
  return session.items[session.index];
}

export function isRepeat(session: Session): boolean {
  return session.index >= session.firstPass;
}

export function isFinished(session: Session): boolean {
  return session.index >= session.items.length;
}

/** A forgotten smoke is shown once more at the end. Repeats don't count in the totals. */
export function answerSession(session: Session, rating: Rating): Session {
  const item = currentItem(session);
  if (!item) return session;
  const repeat = isRepeat(session);
  return {
    ...session,
    items: rating === "forgot" && !repeat ? [...session.items, item] : session.items,
    index: session.index + 1,
    got: session.got + (!repeat && rating === "got" ? 1 : 0),
    forgot: session.forgot + (!repeat && rating === "forgot" ? 1 : 0),
  };
}
