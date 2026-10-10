import { describe, expect, it } from "vitest";
import { failingStorage, memoryStorage } from "../test/memoryStorage";
import {
  BACKUP_PREFIX,
  STORAGE_KEY,
  defaultProgress,
  exportFileName,
  exportProgress,
  importProgress,
  loadProgress,
  recordAnswer,
  saveProgress,
} from "./storage";

const TODAY = "2026-10-10";
const NOW = new Date("2026-10-10T09:00:00.000Z");

describe("defaultProgress", () => {
  it("starts with no cards, 10 new smokes a day, every map and both sides", () => {
    expect(defaultProgress()).toEqual({
      version: 1,
      cards: {},
      newToday: { date: "1970-01-01", count: 0 },
      settings: {
        newPerDay: 10,
        maps: ["ancient", "anubis", "cache", "dust2", "inferno", "mirage", "nuke"],
        sides: ["T", "CT"],
      },
    });
  });
});

describe("loadProgress", () => {
  it("reports unavailable storage", () => {
    expect(loadProgress(null, NOW)).toEqual({ progress: defaultProgress(), status: "unavailable" });
    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => undefined,
    };
    expect(loadProgress(throwing, NOW).status).toBe("unavailable");
  });

  it("starts empty when nothing is stored", () => {
    expect(loadProgress(memoryStorage(), NOW)).toEqual({
      progress: defaultProgress(),
      status: "empty",
    });
  });

  it("loads what was saved", () => {
    const storage = memoryStorage();
    const progress = recordAnswer(defaultProgress(), "mirage-a", "got", TODAY);
    expect(saveProgress(storage, progress)).toBe(true);
    expect(loadProgress(storage, NOW)).toEqual({ progress, status: "ok" });
  });

  it("backs up and resets unreadable progress", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "{not json" });
    expect(loadProgress(storage, NOW)).toEqual({ progress: defaultProgress(), status: "reset" });
    expect(storage.data.get(`${BACKUP_PREFIX}2026-10-10T09:00:00.000Z`)).toBe("{not json");
    expect(JSON.parse(storage.data.get(STORAGE_KEY)!)).toEqual(defaultProgress());
  });

  it("backs up and resets progress from another version", () => {
    const stored = JSON.stringify({ ...defaultProgress(), version: 2 });
    const storage = memoryStorage({ [STORAGE_KEY]: stored });
    expect(loadProgress(storage, NOW).status).toBe("reset");
  });
});

describe("saveProgress", () => {
  it("returns false instead of throwing when the browser refuses to store", () => {
    expect(saveProgress(failingStorage(), defaultProgress())).toBe(false);
    expect(saveProgress(null, defaultProgress())).toBe(false);
  });
});

describe("recordAnswer", () => {
  it("counts a first answer as a new smoke for today", () => {
    const once = recordAnswer(defaultProgress(), "mirage-a", "got", TODAY);
    expect(once.cards["mirage-a"]).toEqual({ box: 2, due: "2026-10-12", lastReviewed: TODAY });
    expect(once.newToday).toEqual({ date: TODAY, count: 1 });
    const twice = recordAnswer(once, "mirage-b", "forgot", TODAY);
    expect(twice.newToday).toEqual({ date: TODAY, count: 2 });
  });

  it("does not count reviews of known cards, or repeats, as new", () => {
    const first = recordAnswer(defaultProgress(), "mirage-a", "forgot", TODAY);
    expect(recordAnswer(first, "mirage-a", "got", TODAY).newToday.count).toBe(1);
  });

  it("restarts the new-smoke count on a new day", () => {
    const yesterday = recordAnswer(defaultProgress(), "mirage-a", "got", "2026-10-09");
    expect(recordAnswer(yesterday, "mirage-b", "got", TODAY).newToday).toEqual({
      date: TODAY,
      count: 1,
    });
  });

  it("keeps progress for smokes that no longer exist", () => {
    const progress = recordAnswer(defaultProgress(), "mirage-removed", "got", "2026-10-09");
    expect(recordAnswer(progress, "mirage-b", "got", TODAY).cards["mirage-removed"]).toBeDefined();
  });
});

describe("export and import", () => {
  it("round-trips progress", () => {
    const progress = recordAnswer(defaultProgress(), "mirage-a", "got", TODAY);
    expect(importProgress(exportProgress(progress))).toEqual({ ok: true, progress });
  });

  it("rejects files that aren't progress exports", () => {
    expect(importProgress("hello")).toEqual({
      ok: false,
      error: "That file isn't a CS Smokes progress export.",
    });
    expect(importProgress(JSON.stringify({ version: 1 })).ok).toBe(false);
  });

  it("names exports by date", () => {
    expect(exportFileName(TODAY)).toBe("cs-smokes-progress-2026-10-10.json");
  });
});
