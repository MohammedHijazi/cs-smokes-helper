import ancient from "../../data/maps/ancient.json";
import anubis from "../../data/maps/anubis.json";
import cache from "../../data/maps/cache.json";
import dust2 from "../../data/maps/dust2.json";
import inferno from "../../data/maps/inferno.json";
import mirage from "../../data/maps/mirage.json";
import nuke from "../../data/maps/nuke.json";
import { createDataApi } from "./api";
import type { MapFile, MapId } from "./schema";

export type { LocatedLineup } from "./api";

/** The bundled data. It is validated in CI (npm run validate), so it is trusted here. */
export const MAP_DATA: Record<MapId, MapFile> = {
  ancient: ancient as unknown as MapFile,
  anubis: anubis as unknown as MapFile,
  cache: cache as unknown as MapFile,
  dust2: dust2 as unknown as MapFile,
  inferno: inferno as unknown as MapFile,
  mirage: mirage as unknown as MapFile,
  nuke: nuke as unknown as MapFile,
};

export const { getMapData, findLineup, findExecute, allLineups } = createDataApi(MAP_DATA);
