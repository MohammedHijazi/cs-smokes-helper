import { useSyncExternalStore } from "react";
import { MAP_IDS, type Execute, type Lineup, type MapFile, type MapId } from "./schema";

export interface LocatedLineup {
  map: MapId;
  lineup: Lineup;
}

export function createDataApi(initial: Record<MapId, MapFile>) {
  // A copy: replacing a map never changes the caller's object (page tests share fixture data).
  const data = { ...initial };
  let version = 0;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const getVersion = () => version;

  return {
    getMapData: (id: MapId): MapFile => data[id],
    findLineup: (map: MapId, id: string): Lineup | undefined =>
      data[map].lineups.find((lineup) => lineup.id === id),
    findExecute: (map: MapId, id: string): Execute | undefined =>
      data[map].executes.find((execute) => execute.id === id),
    allLineups: (): LocatedLineup[] =>
      MAP_IDS.flatMap((map) => data[map].lineups.map((lineup) => ({ map, lineup }))),
    /** Edit mode: swaps in a saved map file and re-renders the screens that read data. */
    replaceMapFile(id: MapId, file: MapFile): void {
      data[id] = file;
      version += 1;
      listeners.forEach((listener) => listener());
    },
    /** Re-renders the calling component after every replaceMapFile. */
    useDataVersion: (): number => useSyncExternalStore(subscribe, getVersion),
  };
}
