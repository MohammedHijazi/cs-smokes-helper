import { effectiveStart, parseYouTubeUrl } from "../lib/youtube";
import { MAP_IDS, mapFileSchema, type MapFile, type MapId } from "./schema";

export interface DataFile {
  fileName: string;
  content: unknown;
  /** Set when the file could not be parsed as JSON. */
  parseError?: string;
}

export interface DataError {
  file: string;
  /** JSON path such as "lineups[0].video.end"; "" for the whole file. */
  path: string;
  message: string;
}

const isMapId = (value: string): value is MapId => (MAP_IDS as readonly string[]).includes(value);

export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((text, key) => {
    if (typeof key === "number") return `${text}[${key}]`;
    return text ? `${text}.${String(key)}` : String(key);
  }, "");
}

export function validateDataFiles(files: readonly DataFile[]): DataError[] {
  const errors: DataError[] = [];
  const seenIds = new Map<string, string>();
  const present = new Set<MapId>();

  for (const { fileName, content, parseError } of files) {
    const mapId = fileName.replace(/\.json$/, "");
    if (!fileName.endsWith(".json") || !isMapId(mapId)) {
      errors.push({
        file: fileName,
        path: "",
        message: `unexpected file; expected one of ${MAP_IDS.map((id) => `${id}.json`).join(", ")}`,
      });
      continue;
    }
    present.add(mapId);
    if (parseError !== undefined) {
      errors.push({ file: fileName, path: "", message: `not valid JSON: ${parseError}` });
      continue;
    }
    const result = mapFileSchema.safeParse(content);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file: fileName, path: formatPath(issue.path), message: issue.message });
      }
      continue;
    }
    errors.push(...checkMapFile(fileName, mapId, result.data, seenIds));
  }

  for (const id of MAP_IDS) {
    if (!present.has(id)) errors.push({ file: `${id}.json`, path: "", message: "file is missing" });
  }
  return errors;
}

function checkMapFile(
  file: string,
  mapId: MapId,
  data: MapFile,
  seenIds: Map<string, string>,
): DataError[] {
  const errors: DataError[] = [];
  const add = (path: string, message: string) => errors.push({ file, path, message });

  if (data.map !== mapId) add("map", `must be "${mapId}" to match the file name`);

  const claimId = (id: string, path: string) => {
    if (!id.startsWith(`${mapId}-`)) add(`${path}.id`, `must start with "${mapId}-"`);
    const previous = seenIds.get(id);
    if (previous) add(`${path}.id`, `duplicate id "${id}" (also at ${previous})`);
    else seenIds.set(id, `${file} → ${path}`);
  };

  const needsLevels = mapId === "nuke";
  data.lineups.forEach((lineup, i) => {
    const path = `lineups[${i}]`;
    claimId(lineup.id, path);
    for (const key of ["stand", "land"] as const) {
      const hasLevel = lineup[key].level !== undefined;
      if (needsLevels && !hasLevel) add(`${path}.${key}.level`, "is required on Nuke");
      if (!needsLevels && hasLevel) add(`${path}.${key}.level`, "is only allowed on Nuke");
    }
    const { video } = lineup;
    const isYouTube = parseYouTubeUrl(video.url) !== null;
    if (!isYouTube && (video.start !== undefined || video.end !== undefined)) {
      add(`${path}.video`, "start and end are only allowed on YouTube URLs");
    }
    if (isYouTube && video.end !== undefined && video.end <= effectiveStart(video)) {
      add(`${path}.video.end`, `must be greater than the start (${effectiveStart(video)}s)`);
    }
  });

  const lineupsById = new Map(data.lineups.map((lineup) => [lineup.id, lineup]));
  data.executes.forEach((execute, i) => {
    const path = `executes[${i}]`;
    claimId(execute.id, path);
    const listed = new Set<string>();
    execute.lineupIds.forEach((id, j) => {
      const ref = `${path}.lineupIds[${j}]`;
      if (listed.has(id)) {
        add(ref, `"${id}" is listed twice`);
        return;
      }
      listed.add(id);
      const lineup = lineupsById.get(id);
      if (!lineup) add(ref, `"${id}" is not a smoke in ${file}`);
      else if (lineup.side !== execute.side) {
        add(ref, `"${id}" is a ${lineup.side} smoke but the execute is ${execute.side}`);
      }
    });
  });

  return errors;
}
