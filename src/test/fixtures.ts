import type { Execute, Lineup, MapFile, MapId } from "../data/schema";

export function makeLineup(overrides: Partial<Lineup> = {}): Lineup {
  return {
    id: "mirage-window-from-t-spawn",
    name: "Window",
    from: "T Spawn",
    side: "T",
    area: "Mid",
    throw: { movement: "stand", jump: true, click: "left" },
    stand: { x: 0.81, y: 0.62 },
    land: { x: 0.44, y: 0.47 },
    video: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", start: 95, end: 112 },
    notes: "Aim at the top-left corner of the antenna",
    status: "unreviewed",
    checkedOn: "2026-10-10",
    ...overrides,
  };
}

export function makeExecute(overrides: Partial<Execute> = {}): Execute {
  return {
    id: "mirage-a-execute",
    name: "A execute",
    side: "T",
    lineupIds: ["mirage-ct-from-t-ramp", "mirage-jungle-from-t-ramp"],
    ...overrides,
  };
}

export function makeMapFile(map: MapId, lineups: Lineup[] = [], executes: Execute[] = []): MapFile {
  return { map, lineups, executes };
}
