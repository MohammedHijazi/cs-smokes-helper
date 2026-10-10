import { z } from "zod";
import { MAP_IDS, SIDES, dateSchema } from "../data/schema";
import { applyRating, type Rating } from "./scheduler";

export const STORAGE_KEY = "cs-smokes:progress:v1";
export const BACKUP_PREFIX = "cs-smokes:progress:backup:";
export const NEW_PER_DAY_MIN = 1;
export const NEW_PER_DAY_MAX = 30;

const cardSchema = z.strictObject({
  box: z.literal([1, 2, 3, 4, 5]),
  due: dateSchema,
  lastReviewed: dateSchema,
});

export const progressSchema = z.strictObject({
  version: z.literal(1),
  cards: z.record(z.string(), cardSchema),
  newToday: z.strictObject({ date: dateSchema, count: z.number().int().min(0) }),
  settings: z.strictObject({
    newPerDay: z.number().int().min(NEW_PER_DAY_MIN).max(NEW_PER_DAY_MAX),
    maps: z.array(z.enum(MAP_IDS)),
    sides: z.array(z.enum(SIDES)),
  }),
});

export type Progress = z.infer<typeof progressSchema>;
export type ProgressSettings = Progress["settings"];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type LoadStatus = "ok" | "empty" | "reset" | "unavailable";

export function defaultProgress(): Progress {
  return {
    version: 1,
    cards: {},
    newToday: { date: "1970-01-01", count: 0 },
    settings: { newPerDay: 10, maps: [...MAP_IDS], sides: [...SIDES] },
  };
}

/** localStorage if this browser lets us use it (private modes and policies can forbid it). */
export function getBrowserStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    const probe = "cs-smokes:probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function parseProgress(text: string): Progress | null {
  try {
    const result = progressSchema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** The stored progress as text; null when nothing is stored or storage can't be read. */
export function readStoredText(storage: StorageLike | null): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function loadProgress(
  storage: StorageLike | null,
  now: Date = new Date(),
): { progress: Progress; status: LoadStatus } {
  if (!storage) return { progress: defaultProgress(), status: "unavailable" };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { progress: defaultProgress(), status: "unavailable" };
  }
  if (raw === null) return { progress: defaultProgress(), status: "empty" };

  const progress = parseProgress(raw);
  if (progress) return { progress, status: "ok" };

  try {
    storage.setItem(`${BACKUP_PREFIX}${now.toISOString()}`, raw);
    storage.setItem(STORAGE_KEY, JSON.stringify(defaultProgress()));
  } catch {
    // Keep going with fresh progress for this visit even if the backup can't be written.
  }
  return { progress: defaultProgress(), status: "reset" };
}

export function saveProgress(storage: StorageLike | null, progress: Progress): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

/** Applies a rating; a smoke answered for the first time counts toward today's new smokes. */
export function recordAnswer(
  progress: Progress,
  lineupId: string,
  rating: Rating,
  today: string,
): Progress {
  const previous = progress.cards[lineupId];
  const newToday =
    previous === undefined
      ? {
          date: today,
          count: (progress.newToday.date === today ? progress.newToday.count : 0) + 1,
        }
      : progress.newToday;
  return {
    ...progress,
    cards: { ...progress.cards, [lineupId]: applyRating(previous, rating, today) },
    newToday,
  };
}

export function exportProgress(progress: Progress): string {
  return `${JSON.stringify(progress, null, 2)}\n`;
}

export function exportFileName(today: string): string {
  return `cs-smokes-progress-${today}.json`;
}

export type ImportResult = { ok: true; progress: Progress } | { ok: false; error: string };

export function importProgress(text: string): ImportResult {
  const progress = parseProgress(text);
  return progress
    ? { ok: true, progress }
    : { ok: false, error: "That file isn't a CS Smokes progress export." };
}
