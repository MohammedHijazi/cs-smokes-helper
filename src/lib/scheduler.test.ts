import { describe, expect, it } from "vitest";
import type { LocatedLineup } from "../data/api";
import type { MapId, Side, Status } from "../data/schema";
import { makeLineup } from "../test/fixtures";
import {
  INTERVAL_DAYS,
  applyRating,
  buildQueue,
  isKnown,
  knownCount,
  newAllowance,
  nextDueDate,
  studyCounts,
  type Box,
  type CardState,
} from "./scheduler";

const TODAY = "2026-10-10";
const card = (box: Box, due: string, lastReviewed = "2026-10-01"): CardState => ({
  box,
  due,
  lastReviewed,
});
const item = (
  map: MapId,
  id: string,
  side: Side = "T",
  status: Status = "unreviewed",
): LocatedLineup => ({
  map,
  lineup: makeLineup({ id, side, status }),
});
const ALL_MAPS: MapId[] = ["ancient", "anubis", "cache", "dust2", "inferno", "mirage", "nuke"];
const ALL = { maps: ALL_MAPS, sides: ["T", "CT"] as Side[] };
const ids = (queue: readonly LocatedLineup[]) => queue.map((q) => q.lineup.id);

const candidates = [
  item("mirage", "mirage-a"),
  item("mirage", "mirage-b"),
  item("mirage", "mirage-c"),
  item("ancient", "ancient-a"),
  item("ancient", "ancient-b"),
  item("nuke", "nuke-a", "CT"),
  item("mirage", "mirage-broken", "T", "broken"),
];

describe("applyRating", () => {
  it("uses intervals of 1, 2, 4, 8 and 16 days", () => {
    expect(INTERVAL_DAYS).toEqual({ 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 });
  });

  it("treats a new smoke as box 1", () => {
    expect(applyRating(undefined, "got", TODAY)).toEqual(card(2, "2026-10-12", TODAY));
    expect(applyRating(undefined, "forgot", TODAY)).toEqual(card(1, "2026-10-11", TODAY));
  });

  it("moves up one box on Got it, using the new box's interval", () => {
    expect(applyRating(card(3, TODAY, "2026-10-06"), "got", TODAY)).toEqual(
      card(4, "2026-10-18", TODAY),
    );
  });

  it("stays in box 5 and comes back after 16 days", () => {
    expect(applyRating(card(5, TODAY, "2026-09-24"), "got", TODAY)).toEqual(
      card(5, "2026-10-26", TODAY),
    );
  });

  it("goes back to box 1 on Forgot, due tomorrow", () => {
    expect(applyRating(card(4, TODAY, "2026-10-02"), "forgot", TODAY)).toEqual(
      card(1, "2026-10-11", TODAY),
    );
  });

  it("changes a schedule at most once per day", () => {
    const reviewed = applyRating(undefined, "forgot", TODAY);
    expect(applyRating(reviewed, "got", TODAY)).toBe(reviewed);
  });

  it("schedules across a year end on calendar days", () => {
    expect(applyRating(card(4, "2026-12-27", "2026-12-19"), "got", "2026-12-27").due).toBe(
      "2027-01-12",
    );
  });
});

describe("isKnown", () => {
  it("means box 4 or higher", () => {
    expect(isKnown(card(4, TODAY))).toBe(true);
    expect(isKnown(card(3, TODAY))).toBe(false);
    expect(isKnown(undefined)).toBe(false);
  });
});

describe("newAllowance", () => {
  it("subtracts today's new smokes", () => {
    expect(newAllowance({ date: TODAY, count: 4 }, 10, TODAY)).toBe(6);
  });
  it("starts again on a new day", () => {
    expect(newAllowance({ date: "2026-10-09", count: 10 }, 10, TODAY)).toBe(10);
  });
  it("never goes below zero", () => {
    expect(newAllowance({ date: TODAY, count: 12 }, 10, TODAY)).toBe(0);
  });
});

describe("buildQueue", () => {
  it("puts due cards first, then new smokes round-robin across maps", () => {
    const cards = { "mirage-a": card(2, TODAY), "ancient-a": card(1, "2026-10-11", TODAY) };
    const queue = buildQueue({ candidates, cards, filter: ALL, allowance: 10, today: TODAY });
    expect(ids(queue)).toEqual(["mirage-a", "ancient-b", "mirage-b", "nuke-a", "mirage-c"]);
    expect(queue.map((q) => q.isNew)).toEqual([false, true, true, true, true]);
  });

  it("stops adding new smokes at the allowance", () => {
    const queue = buildQueue({ candidates, cards: {}, filter: ALL, allowance: 2, today: TODAY });
    expect(ids(queue)).toEqual(["ancient-a", "mirage-a"]);
  });

  it("leaves out broken smokes and smokes outside the chosen maps and sides", () => {
    const filter = { maps: ["mirage", "nuke"] as MapId[], sides: ["T"] as Side[] };
    const queue = buildQueue({ candidates, cards: {}, filter, allowance: 10, today: TODAY });
    expect(ids(queue)).toEqual(["mirage-a", "mirage-b", "mirage-c"]);
  });

  it("shuffles the due cards", () => {
    const cards = {
      "mirage-a": card(1, TODAY),
      "mirage-b": card(1, TODAY),
      "mirage-c": card(1, TODAY),
    };
    const filter = { maps: ["mirage"] as MapId[], sides: ["T"] as Side[] };
    const queue = buildQueue({
      candidates,
      cards,
      filter,
      allowance: 0,
      today: TODAY,
      rng: () => 0,
    });
    expect(ids(queue)).toEqual(["mirage-b", "mirage-c", "mirage-a"]);
  });
});

describe("studyCounts", () => {
  it("counts due cards and how many new smokes today allows", () => {
    const cards = { "mirage-a": card(2, "2026-10-09") };
    expect(studyCounts({ candidates, cards, filter: ALL, allowance: 3, today: TODAY })).toEqual({
      due: 1,
      fresh: 3,
    });
    expect(studyCounts({ candidates, cards, filter: ALL, allowance: 0, today: TODAY })).toEqual({
      due: 1,
      fresh: 0,
    });
  });
});

describe("nextDueDate", () => {
  it("finds the earliest future review among studyable smokes", () => {
    const cards = {
      "mirage-a": card(2, "2026-10-14", TODAY),
      "mirage-b": card(1, "2026-10-11", TODAY),
      "mirage-broken": card(1, "2026-10-11", TODAY),
    };
    expect(nextDueDate(candidates, cards, ALL, TODAY)).toBe("2026-10-11");
    expect(nextDueDate(candidates, {}, ALL, TODAY)).toBeUndefined();
  });
});

describe("knownCount", () => {
  it("counts known smokes among those that aren't broken", () => {
    const lineups = [
      makeLineup({ id: "mirage-a" }),
      makeLineup({ id: "mirage-b" }),
      makeLineup({ id: "mirage-c", status: "broken" }),
    ];
    const cards = { "mirage-a": card(4, "2026-10-20"), "mirage-c": card(5, "2026-10-20") };
    expect(knownCount(lineups, cards)).toEqual({ known: 1, total: 2 });
  });
});
