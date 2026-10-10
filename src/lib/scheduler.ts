import type { LocatedLineup } from "../data/api";
import { MAP_IDS, type MapId, type Side } from "../data/schema";
import { addDays } from "./dates";
import { shuffle, type Rng } from "./random";

export type Box = 1 | 2 | 3 | 4 | 5;
export const INTERVAL_DAYS: Readonly<Record<Box, number>> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };
export type Rating = "forgot" | "got";

export interface CardState {
  box: Box;
  due: string;
  lastReviewed: string;
}

export interface NewToday {
  date: string;
  count: number;
}

export interface StudyFilter {
  maps: readonly MapId[];
  sides: readonly Side[];
}

export interface QueueItem extends LocatedLineup {
  isNew: boolean;
}

type Cards = Readonly<Record<string, CardState>>;

/** A new smoke counts as box 1. A card's schedule changes at most once per day. */
export function applyRating(card: CardState | undefined, rating: Rating, today: string): CardState {
  if (card && card.lastReviewed === today) return card;
  const current = card?.box ?? 1;
  const box: Box = rating === "got" ? (Math.min(current + 1, 5) as Box) : 1;
  return { box, due: addDays(today, INTERVAL_DAYS[box]), lastReviewed: today };
}

export function isKnown(card?: CardState): boolean {
  return card !== undefined && card.box >= 4;
}

export function isDue(card: CardState, today: string): boolean {
  return card.due <= today;
}

export function newAllowance(newToday: NewToday, newPerDay: number, today: string): number {
  const used = newToday.date === today ? newToday.count : 0;
  return Math.max(0, newPerDay - used);
}

/** Smokes that can be studied with these settings: not broken, on a chosen map and side. */
export function eligible(
  candidates: readonly LocatedLineup[],
  filter: StudyFilter,
): LocatedLineup[] {
  return candidates.filter(
    ({ map, lineup }) =>
      lineup.status !== "broken" && filter.maps.includes(map) && filter.sides.includes(lineup.side),
  );
}

export interface QueueInput {
  candidates: readonly LocatedLineup[];
  cards: Cards;
  filter: StudyFilter;
  allowance: number;
  today: string;
  rng?: Rng;
}

const dueIn = (pool: readonly LocatedLineup[], cards: Cards, today: string) =>
  pool.filter(({ lineup }) => {
    const card = cards[lineup.id];
    return card !== undefined && isDue(card, today);
  });

const freshIn = (pool: readonly LocatedLineup[], cards: Cards) =>
  pool.filter(({ lineup }) => cards[lineup.id] === undefined);

/** Due cards in random order, then new smokes round-robin across maps (file order within a map). */
export function buildQueue({
  candidates,
  cards,
  filter,
  allowance,
  today,
  rng,
}: QueueInput): QueueItem[] {
  const pool = eligible(candidates, filter);
  const fresh = freshIn(pool, cards);
  const byMap = MAP_IDS.map((map) => fresh.filter((entry) => entry.map === map)).filter(
    (list) => list.length > 0,
  );
  const picked: LocatedLineup[] = [];
  for (
    let round = 0;
    picked.length < allowance && byMap.some((list) => round < list.length);
    round++
  ) {
    for (const list of byMap) {
      if (picked.length >= allowance) break;
      if (round < list.length) picked.push(list[round]);
    }
  }
  return [
    ...shuffle(dueIn(pool, cards, today), rng).map((entry) => ({ ...entry, isNew: false })),
    ...picked.map((entry) => ({ ...entry, isNew: true })),
  ];
}

export function studyCounts({
  candidates,
  cards,
  filter,
  allowance,
  today,
}: Omit<QueueInput, "rng">): { due: number; fresh: number } {
  const pool = eligible(candidates, filter);
  return {
    due: dueIn(pool, cards, today).length,
    fresh: Math.min(freshIn(pool, cards).length, allowance),
  };
}

/** The earliest review after today among studyable smokes, if there is one. */
export function nextDueDate(
  candidates: readonly LocatedLineup[],
  cards: Cards,
  filter: StudyFilter,
  today: string,
): string | undefined {
  return eligible(candidates, filter)
    .map(({ lineup }) => cards[lineup.id]?.due)
    .filter((due): due is string => due !== undefined && due > today)
    .sort()[0];
}

/** Known and total smokes, leaving out broken ones. */
export function knownCount(
  lineups: readonly { id: string; status: string }[],
  cards: Cards,
): { known: number; total: number } {
  const active = lineups.filter((lineup) => lineup.status !== "broken");
  return {
    known: active.filter((lineup) => isKnown(cards[lineup.id])).length,
    total: active.length,
  };
}
