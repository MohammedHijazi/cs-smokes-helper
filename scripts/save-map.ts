import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { MAP_IDS, type MapFile, type MapId } from "../src/data/schema";
import { validateDataFiles } from "../src/data/validate";
import { formatMapFile } from "./format-map";
import { loadDataFiles } from "./load-data";

export interface FieldError {
  path: string;
  message: string;
}

export type SaveResult =
  | { status: 200; file: MapFile; text: string }
  | { status: 400; errors: FieldError[] }
  | { status: 404; error: "unknown-map" }
  | { status: 409; error: "changed" | "invalid-on-disk" }
  | { status: 500; error: "write-failed"; message: string };

/** The file operations a save needs; tests swap in failing ones. */
export interface SaveFs {
  readText(path: string): Promise<string>;
  writeText(path: string, text: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export const nodeFs: SaveFs = {
  readText: (path) => readFile(path, "utf8"),
  writeText: (path, text) => writeFile(path, text, "utf8"),
  rename: (from, to) => rename(from, to),
  remove: (path) => rm(path, { force: true }),
};

/** Waits between rename attempts: Windows briefly refuses while an editor or antivirus holds the file. */
export const RENAME_DELAYS_MS = [50, 100, 250, 500];
const RETRYABLE = new Set(["EPERM", "EBUSY"]);

export interface SaveRequest {
  dataDir: string;
  mapId: string;
  /** The map file as the page had it before this edit. */
  base: unknown;
  file: unknown;
  fs?: SaveFs;
  sleep?: (ms: number) => Promise<void>;
}

const isMapId = (value: string): value is MapId => (MAP_IDS as readonly string[]).includes(value);
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Phase 2 spec §4, steps 2–8: stale check, validation, canonical layout, atomic write. */
export async function saveMapFile({
  dataDir,
  mapId,
  base,
  file,
  fs = nodeFs,
  sleep = wait,
}: SaveRequest): Promise<SaveResult> {
  if (!isMapId(mapId)) return { status: 404, error: "unknown-map" };
  const fileName = `${mapId}.json`;
  const path = join(dataDir, fileName);

  let current: unknown;
  try {
    current = JSON.parse(await fs.readText(path));
  } catch {
    return { status: 409, error: "invalid-on-disk" };
  }
  if (!isDeepStrictEqual(current, base)) return { status: 409, error: "changed" };

  const files = loadDataFiles(dataDir).map((entry) =>
    entry.fileName === fileName ? { fileName, content: file } : entry,
  );
  const errors = validateDataFiles(files)
    .filter((error) => error.file === fileName)
    .map(({ path: errorPath, message }) => ({ path: errorPath, message }));
  if (errors.length > 0) return { status: 400, errors };

  const text = await formatMapFile(file);
  const temp = join(dataDir, `.${fileName}.tmp`);
  try {
    await fs.writeText(temp, text);
    await renameWithRetry(fs, temp, path, sleep);
  } catch (error) {
    await fs.remove(temp).catch(() => undefined);
    return { status: 500, error: "write-failed", message: (error as Error).message };
  }
  return { status: 200, file: JSON.parse(text) as MapFile, text };
}

async function renameWithRetry(
  fs: SaveFs,
  from: string,
  to: string,
  sleep: (ms: number) => Promise<void>,
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? "";
      if (attempt >= RENAME_DELAYS_MS.length || !RETRYABLE.has(code)) throw error;
      await sleep(RENAME_DELAYS_MS[attempt]);
    }
  }
}
