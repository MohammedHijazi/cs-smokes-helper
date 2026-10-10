import { createDataApi } from "../data/api";
import { MAP_IDS, type MapFile, type MapId } from "../data/schema";
import { makeExecute, makeLineup } from "./fixtures";

const empty = (map: MapId): MapFile => ({ map, lineups: [], executes: [] });

/** Small, stable data for page tests. Real data changes as smokes are seeded. */
export const FIXTURE_DATA: Record<MapId, MapFile> = {
  ancient: empty("ancient"),
  anubis: empty("anubis"),
  cache: empty("cache"),
  dust2: empty("dust2"),
  inferno: empty("inferno"),
  mirage: {
    map: "mirage",
    lineups: [
      makeLineup({
        id: "mirage-window-from-t-spawn",
        stand: { x: 0.8, y: 0.6 },
        land: { x: 0.45, y: 0.45 },
      }),
      makeLineup({
        id: "mirage-ct-from-t-ramp",
        name: "CT",
        from: "T Ramp",
        area: "A",
        throw: { movement: "run", jump: true, click: "left" },
        stand: { x: 0.7, y: 0.3 },
        land: { x: 0.3, y: 0.2 },
      }),
      makeLineup({
        id: "mirage-jungle-from-t-ramp",
        name: "Jungle",
        from: "T Ramp",
        area: "A",
        throw: { movement: "stand", jump: false, click: "left" },
        stand: { x: 0.72, y: 0.32 },
        land: { x: 0.35, y: 0.3 },
      }),
      makeLineup({
        id: "mirage-top-mid-from-ct-spawn",
        name: "Top Mid",
        from: "CT Spawn",
        side: "CT",
        area: "Mid",
        throw: { movement: "stand", jump: false, click: "right" },
        stand: { x: 0.2, y: 0.4 },
        land: { x: 0.6, y: 0.5 },
        video: { url: "https://csnades.gg/mirage/smokes/top-mid" },
        status: "ok",
      }),
      makeLineup({
        id: "mirage-market-window-from-b-apps",
        name: "Market Window",
        from: "B Apartments",
        area: "B",
        stand: { x: 0.5, y: 0.85 },
        land: { x: 0.25, y: 0.75 },
        status: "broken",
      }),
    ],
    executes: [
      makeExecute({
        id: "mirage-a-execute",
        name: "A execute",
        lineupIds: ["mirage-ct-from-t-ramp", "mirage-jungle-from-t-ramp"],
      }),
    ],
  },
  nuke: {
    map: "nuke",
    lineups: [
      makeLineup({
        id: "nuke-outside-from-t-roof",
        name: "Outside",
        from: "T Roof",
        area: "Other",
        stand: { x: 0.2, y: 0.5, level: "upper" },
        land: { x: 0.5, y: 0.5, level: "upper" },
      }),
      makeLineup({
        id: "nuke-ramp-from-lobby",
        name: "Ramp",
        from: "Lobby",
        area: "B",
        stand: { x: 0.3, y: 0.6, level: "upper" },
        land: { x: 0.4, y: 0.7, level: "lower" },
      }),
    ],
    executes: [],
  },
};

let mockedApi: ReturnType<typeof createDataApi> | undefined;

/** Drop-in replacement for src/data/index.ts in page tests. */
export function mockDataModule() {
  mockedApi = createDataApi(FIXTURE_DATA);
  return { MAP_DATA: FIXTURE_DATA, ...mockedApi };
}

/** Undoes edit-mode saves between tests: puts the fixture files back into the mocked data module. */
export function restoreFixtureData(): void {
  for (const id of MAP_IDS) mockedApi?.replaceMapFile(id, FIXTURE_DATA[id]);
}
