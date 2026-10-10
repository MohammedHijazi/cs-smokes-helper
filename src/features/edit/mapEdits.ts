import type { Execute, Lineup, MapFile, MapId, Side } from "../../data/schema";

/** Lowercase, accents dropped, every run of other characters → "-"; "smoke" if nothing is left. */
export function slug(text: string): string {
  const result = text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return result || "smoke";
}

/** Every lineup and execute id in these files: they share one id space. */
export function takenIds(files: readonly MapFile[]): Set<string> {
  return new Set(
    files.flatMap((file) => [
      ...file.lineups.map((lineup) => lineup.id),
      ...file.executes.map((execute) => execute.id),
    ]),
  );
}

/** `base`, or `base-2`, `base-3`, … — the first one not taken. */
export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function newLineupId(
  map: MapId,
  name: string,
  from: string,
  taken: ReadonlySet<string>,
): string {
  return uniqueId(`${map}-${slug(name)}-from-${slug(from)}`, taken);
}

export function newExecuteId(map: MapId, name: string, taken: ReadonlySet<string>): string {
  return uniqueId(`${map}-${slug(name)}`, taken);
}

function upsert<T extends { id: string }>(list: readonly T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  return index === -1 ? [...list, item] : list.map((entry, i) => (i === index ? item : entry));
}

/** Replaces the smoke with the same id, or appends it. */
export function upsertLineup(file: MapFile, lineup: Lineup): MapFile {
  return { ...file, lineups: upsert(file.lineups, lineup) };
}

/** Replaces the execute with the same id, or appends it. */
export function upsertExecute(file: MapFile, execute: Execute): MapFile {
  return { ...file, executes: upsert(file.executes, execute) };
}

/** Deletes an execute; its smokes stay. */
export function deleteExecute(file: MapFile, id: string): MapFile {
  return { ...file, executes: file.executes.filter((execute) => execute.id !== id) };
}

export interface LineupDeletion {
  file: MapFile;
  /** Executes that keep going without the smoke. */
  shortened: Execute[];
  /** Executes deleted because fewer than 2 smokes would be left. */
  removed: Execute[];
}

export function deleteLineup(file: MapFile, id: string): LineupDeletion {
  const shortened: Execute[] = [];
  const removed: Execute[] = [];
  const executes: Execute[] = [];
  for (const execute of file.executes) {
    if (!execute.lineupIds.includes(id)) {
      executes.push(execute);
      continue;
    }
    const lineupIds = execute.lineupIds.filter((lineupId) => lineupId !== id);
    if (lineupIds.length < 2) {
      removed.push(execute);
    } else {
      shortened.push(execute);
      executes.push({ ...execute, lineupIds });
    }
  }
  const lineups = file.lineups.filter((lineup) => lineup.id !== id);
  return { file: { ...file, lineups, executes }, shortened, removed };
}

/** The confirmation shown before deleting a smoke (spec §6). */
export function deleteConfirmText(lineup: Lineup, { shortened, removed }: LineupDeletion): string {
  const names = (list: Execute[]) => list.map((execute) => `'${execute.name}'`).join(", ");
  let text = `Delete '${lineup.name} from ${lineup.from}'?`;
  if (shortened.length > 0) text += ` It is also removed from ${names(shortened)}.`;
  if (removed.length === 1) {
    text += ` ${names(removed)} is deleted too, because it would have fewer than 2 smokes.`;
  } else if (removed.length > 1) {
    text += ` ${names(removed)} are deleted too, because they would have fewer than 2 smokes.`;
  }
  return text;
}

export function markReviewed(lineup: Lineup, today: string): Lineup {
  return { ...lineup, status: "ok", checkedOn: today };
}

/** The next unreviewed smoke after `currentId` in `list`, wrapping round; never the current one. */
export function nextUnreviewed(list: readonly Lineup[], currentId: string): Lineup | undefined {
  const start = list.findIndex((lineup) => lineup.id === currentId);
  for (let step = 1; step <= list.length; step += 1) {
    const lineup = list[(start + step) % list.length];
    if (lineup.id !== currentId && lineup.status === "unreviewed") return lineup;
  }
  return undefined;
}

/** The ids whose smokes are on `side`, in the same order. */
export function idsOnSide(
  ids: readonly string[],
  side: Side,
  lineups: readonly Lineup[],
): string[] {
  return ids.filter((id) => lineups.find((lineup) => lineup.id === id)?.side === side);
}
