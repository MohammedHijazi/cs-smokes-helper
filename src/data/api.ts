import { MAP_IDS, type Execute, type Lineup, type MapFile, type MapId } from "./schema";

export interface LocatedLineup {
  map: MapId;
  lineup: Lineup;
}

export function createDataApi(data: Record<MapId, MapFile>) {
  return {
    getMapData: (id: MapId): MapFile => data[id],
    findLineup: (map: MapId, id: string): Lineup | undefined =>
      data[map].lineups.find((lineup) => lineup.id === id),
    findExecute: (map: MapId, id: string): Execute | undefined =>
      data[map].executes.find((execute) => execute.id === id),
    allLineups: (): LocatedLineup[] =>
      MAP_IDS.flatMap((map) => data[map].lineups.map((lineup) => ({ map, lineup }))),
  };
}
