import type {
  Area,
  Lineup,
  MapFile,
  Position,
  Side,
  Status,
  Throw,
  Video,
} from "../../data/schema";
import { parseYouTubeUrl } from "../../lib/youtube";

/** The smoke form's state. Clip times stay text while typed; "" means not set. */
export interface SmokeDraft {
  url: string;
  start: string;
  end: string;
  name: string;
  from: string;
  side: Side | null;
  area: Area | null;
  movement: Throw["movement"];
  jump: boolean;
  click: Throw["click"];
  stand: Position | null;
  land: Position | null;
  notes: string;
  status: Status;
}

export type DraftField =
  | "url"
  | "start"
  | "end"
  | "name"
  | "from"
  | "side"
  | "area"
  | "stand"
  | "land"
  | "notes"
  | "status";

/** Messages by field; "form" holds the ones that belong to no single field. */
export type DraftErrors = Partial<Record<DraftField | "form", string[]>>;

export function emptyDraft(preset: { side?: Side; area?: Area } = {}): SmokeDraft {
  return {
    url: "",
    start: "",
    end: "",
    name: "",
    from: "",
    side: preset.side ?? null,
    area: preset.area ?? null,
    movement: "stand",
    jump: false,
    click: "left",
    stand: null,
    land: null,
    notes: "",
    status: "unreviewed",
  };
}

export function draftFromLineup(lineup: Lineup): SmokeDraft {
  return {
    url: lineup.video.url,
    start: lineup.video.start === undefined ? "" : String(lineup.video.start),
    end: lineup.video.end === undefined ? "" : String(lineup.video.end),
    name: lineup.name,
    from: lineup.from,
    side: lineup.side,
    area: lineup.area,
    movement: lineup.throw.movement,
    jump: lineup.throw.jump,
    click: lineup.throw.click,
    stand: lineup.stand,
    land: lineup.land,
    notes: lineup.notes ?? "",
    status: lineup.status,
  };
}

/**
 * The draft with a new link. Start follows the link's `t` while Start is empty or still equal to
 * the previous link's `t`, so typing a link character by character ends with the whole value.
 */
export function withUrl(draft: SmokeDraft, url: string): SmokeDraft {
  const before = parseYouTubeUrl(draft.url.trim())?.t;
  const after = parseYouTubeUrl(url.trim())?.t;
  const followsLink =
    draft.start === "" || (before !== undefined && draft.start === String(before));
  if (!followsLink) return { ...draft, url };
  return { ...draft, url, start: after === undefined ? "" : String(after) };
}

const WHOLE_SECONDS = /^\d+$/;

/** Whole seconds from a clip field; undefined when empty or not a whole number. */
export function seconds(text: string): number | undefined {
  const trimmed = text.trim();
  return WHOLE_SECONDS.test(trimmed) ? Number(trimmed) : undefined;
}

/** 95 → "1:35", 3723 → "1:02:03". */
export function clock(total: number): string {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
}

export interface BuildContext {
  id: string;
  /** The smoke being edited; undefined when adding. */
  original?: Lineup;
  today: string;
}

export type BuildResult = { ok: true; lineup: Lineup } | { ok: false; errors: DraftErrors };

/** The form as a lineup, or what must be fixed before the shared validation can run. */
export function lineupFromDraft(
  draft: SmokeDraft,
  { id, original, today }: BuildContext,
): BuildResult {
  const errors: DraftErrors = {};
  const add = (field: DraftField, message: string) => (errors[field] ??= []).push(message);
  const url = draft.url.trim();
  const youtube = parseYouTubeUrl(url) !== null;
  const start = draft.start.trim();
  const end = draft.end.trim();

  if (url === "") add("url", "Paste a video link");
  if (youtube && start !== "" && seconds(start) === undefined)
    add("start", "must be whole seconds");
  if (youtube && end !== "" && seconds(end) === undefined) add("end", "must be whole seconds");
  if (draft.name.trim() === "") add("name", "Enter the spot the smoke covers");
  if (draft.from.trim() === "") add("from", "Enter where it is thrown from");
  if (draft.side === null) add("side", "Choose a side");
  if (draft.area === null) add("area", "Choose an area");
  if (draft.land === null) add("land", "Place the land spot on the radar");
  if (draft.stand === null) add("stand", "Place the stand spot on the radar");

  const { side, area, land, stand } = draft;
  if (side === null || area === null || land === null || stand === null)
    return { ok: false, errors };
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const video: Video = { url };
  if (youtube && start !== "") video.start = Number(start);
  if (youtube && end !== "") video.end = Number(end);
  const notes = draft.notes.trim();

  return {
    ok: true,
    lineup: {
      id,
      name: draft.name.trim(),
      from: draft.from.trim(),
      side,
      area,
      throw: { movement: draft.movement, jump: draft.jump, click: draft.click },
      stand,
      land,
      video,
      ...(notes === "" ? {} : { notes }),
      status: draft.status,
      checkedOn:
        original !== undefined && original.status === draft.status ? original.checkedOn : today,
    },
  };
}

const NESTED_FIELDS: Record<string, DraftField> = {
  // "video" alone: start or end on a link that isn't YouTube.
  video: "url",
  "video.url": "url",
  "video.start": "start",
  "video.end": "end",
};
const TOP_FIELDS: readonly DraftField[] = [
  "name",
  "from",
  "side",
  "area",
  "stand",
  "land",
  "notes",
  "status",
];

function fieldFor(rest: string): DraftField | undefined {
  if (Object.hasOwn(NESTED_FIELDS, rest)) return NESTED_FIELDS[rest];
  const head = rest.split(/[.[]/)[0];
  return TOP_FIELDS.find((field) => field === head);
}

/** Sorts validation errors for `file` onto the form; `index` is the smoke's place in `lineups`. */
export function errorsForDraft(
  errors: readonly { path: string; message: string }[],
  index: number,
  file: MapFile,
): DraftErrors {
  const result: DraftErrors = {};
  const prefix = `lineups[${index}].`;
  for (const { path, message } of errors) {
    const field = path.startsWith(prefix) ? fieldFor(path.slice(prefix.length)) : undefined;
    if (field) (result[field] ??= []).push(message);
    else (result.form ??= []).push(describeElsewhere(path, message, file));
  }
  return result;
}

function describeElsewhere(path: string, message: string, file: MapFile): string {
  const match = /^executes\[(\d+)\]/.exec(path);
  const execute = match ? file.executes[Number(match[1])] : undefined;
  if (execute) return `Execute '${execute.name}': ${message}`;
  return path === "" ? message : `${path}: ${message}`;
}
