import type { Execute, Side } from "../../data/schema";

/** The execute form's state. */
export interface ExecuteDraft {
  name: string;
  side: Side;
  notes: string;
  /** Smoke ids in throw order. */
  lineupIds: string[];
}

export type ExecuteField = "name" | "side" | "lineupIds" | "notes";

/** Messages by field; "form" holds the ones that belong to no single field. */
export type ExecuteErrors = Partial<Record<ExecuteField | "form", string[]>>;

export function emptyExecuteDraft(side: Side): ExecuteDraft {
  return { name: "", side, notes: "", lineupIds: [] };
}

export function draftFromExecute(execute: Execute): ExecuteDraft {
  return {
    name: execute.name,
    side: execute.side,
    notes: execute.notes ?? "",
    lineupIds: [...execute.lineupIds],
  };
}

export function executeFromDraft(draft: ExecuteDraft, id: string): Execute {
  const notes = draft.notes.trim();
  return {
    id,
    name: draft.name.trim(),
    side: draft.side,
    lineupIds: [...draft.lineupIds],
    ...(notes === "" ? {} : { notes }),
  };
}

/** The list with the item at `index` moved `delta` places; unchanged if that leaves the list. */
export function moved<T>(list: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  const next = [...list];
  if (target < 0 || target >= list.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const FIELDS: readonly ExecuteField[] = ["name", "side", "lineupIds", "notes"];

/** Sorts validation errors onto the form; `index` is the execute's place in `executes`. */
export function errorsForExecute(
  errors: readonly { path: string; message: string }[],
  index: number,
): ExecuteErrors {
  const result: ExecuteErrors = {};
  const prefix = `executes[${index}].`;
  for (const { path, message } of errors) {
    const head = path.startsWith(prefix) ? path.slice(prefix.length).split(/[.[]/)[0] : "";
    const field = FIELDS.find((name) => name === head);
    if (field) (result[field] ??= []).push(message);
    else (result.form ??= []).push(path === "" ? message : `${path}: ${message}`);
  }
  return result;
}
