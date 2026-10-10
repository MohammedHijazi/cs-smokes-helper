import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAP_IDS, type MapFile, type MapId } from "../src/data/schema";
import { formatMapFile } from "./format-map";

/** Test helper: a temp data folder with all seven map files (empty unless given). */
export async function makeDataDir(files: Partial<Record<MapId, MapFile>> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "cs-smokes-data-"));
  for (const id of MAP_IDS) {
    const file = files[id] ?? { map: id, lineups: [], executes: [] };
    writeFileSync(join(dir, `${id}.json`), await formatMapFile(file));
  }
  return {
    dir,
    path: (id: MapId) => join(dir, `${id}.json`),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
