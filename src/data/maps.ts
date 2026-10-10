import type { Level, MapId } from "./schema";

export interface MapInfo {
  id: MapId;
  name: string;
  /** Path under public/, e.g. "radars/mirage.webp". */
  radar: string;
  /** Only maps with two levels (Nuke). */
  lowerRadar?: string;
}

export const MAPS: readonly MapInfo[] = [
  { id: "ancient", name: "Ancient", radar: "radars/ancient.webp" },
  { id: "anubis", name: "Anubis", radar: "radars/anubis.webp" },
  { id: "cache", name: "Cache", radar: "radars/cache.webp" },
  { id: "dust2", name: "Dust II", radar: "radars/dust2.webp" },
  { id: "inferno", name: "Inferno", radar: "radars/inferno.webp" },
  { id: "mirage", name: "Mirage", radar: "radars/mirage.webp" },
  { id: "nuke", name: "Nuke", radar: "radars/nuke.webp", lowerRadar: "radars/nuke-lower.webp" },
];

export function getMapInfo(id: string): MapInfo | undefined {
  return MAPS.find((map) => map.id === id);
}

export function hasLevels(map: MapInfo): boolean {
  return map.lowerRadar !== undefined;
}

export function radarPath(map: MapInfo, level: Level = "upper"): string {
  return level === "lower" && map.lowerRadar ? map.lowerRadar : map.radar;
}
