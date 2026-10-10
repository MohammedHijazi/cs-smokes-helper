import { getMapData, replaceMapFile } from "../../data";
import { MAP_IDS, type MapFile, type MapId } from "../../data/schema";
import { validateDataFiles } from "../../data/validate";

export interface FieldError {
  path: string;
  message: string;
}

export type SaveOutcome =
  | { ok: true; file: MapFile }
  | { ok: false; kind: "invalid"; errors: FieldError[] }
  | {
      ok: false;
      kind: "changed" | "invalid-on-disk" | "unreachable" | "write-failed" | "unexpected";
      message: string;
    };

interface ServerBody {
  file?: MapFile;
  errors?: FieldError[];
  error?: string;
  message?: string;
}

export const CHANGED_MESSAGE =
  "This map changed outside this page (another tab, a hand edit or git). Reload to get the latest version.";

/** Problems in `next` by the checks behind npm run validate, with the other maps as they are now. */
export function checkLocally(map: MapId, next: MapFile): FieldError[] {
  const fileName = `${map}.json`;
  const files = MAP_IDS.map((id) => ({
    fileName: `${id}.json`,
    content: id === map ? next : getMapData(id),
  }));
  return validateDataFiles(files)
    .filter((error) => error.file === fileName)
    .map(({ path, message }) => ({ path, message }));
}

/** Spec §4 (client): check locally, PUT the file, then swap the saved file into the page's data. */
export async function saveMap(map: MapId, next: MapFile): Promise<SaveOutcome> {
  const local = checkLocally(map, next);
  if (local.length > 0) return { ok: false, kind: "invalid", errors: local };

  let response: Response;
  try {
    response = await fetch(`/__edit/maps/${map}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base: getMapData(map), file: next }),
    });
  } catch {
    return {
      ok: false,
      kind: "unreachable",
      message: "Can't reach the dev server — is npm run dev running?",
    };
  }
  const body = (await response.json().catch(() => ({}))) as ServerBody;
  const path = `data/maps/${map}.json`;

  if (response.status === 200 && body.file) {
    replaceMapFile(map, body.file);
    return { ok: true, file: body.file };
  }
  if (response.status === 400) return { ok: false, kind: "invalid", errors: body.errors ?? [] };
  if (response.status === 409 && body.error === "invalid-on-disk") {
    return {
      ok: false,
      kind: "invalid-on-disk",
      message: `${path} isn't valid JSON — fix or restore it first.`,
    };
  }
  if (response.status === 409) {
    return {
      ok: false,
      kind: "changed",
      message: CHANGED_MESSAGE,
    };
  }
  if (response.status === 500) {
    return {
      ok: false,
      kind: "write-failed",
      message: `Couldn't write ${path}: ${body.message ?? "unknown error"}`,
    };
  }
  return {
    ok: false,
    kind: "unexpected",
    message: `The dev server answered with status ${response.status}.`,
  };
}

/** A failed save as one line, for places without form fields (card and execute buttons). */
export function describeProblem(outcome: Extract<SaveOutcome, { ok: false }>): string {
  if (outcome.kind !== "invalid") return outcome.message;
  return outcome.errors
    .map(({ path, message }) => (path === "" ? message : `${path}: ${message}`))
    .join(" ");
}
