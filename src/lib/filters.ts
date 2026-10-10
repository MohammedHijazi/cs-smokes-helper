import {
  AREAS,
  LEVELS,
  SIDES,
  type Area,
  type Level,
  type Lineup,
  type Side,
} from "../data/schema";

export interface Filters {
  side: Side | "all";
  area: Area | "all";
  level: Level;
}

export const DEFAULT_FILTERS: Filters = { side: "all", area: "all", level: "upper" };

const oneOf = <T extends string>(options: readonly T[], value: string | null): T | undefined =>
  options.find((option) => option === value);

export function parseFilters(params: URLSearchParams): Filters {
  return {
    side: oneOf(SIDES, params.get("side")) ?? "all",
    area: oneOf(AREAS, params.get("area")) ?? "all",
    level: oneOf(LEVELS, params.get("level")) ?? "upper",
  };
}

export function filtersToSearch(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.side !== "all") params.set("side", filters.side);
  if (filters.area !== "all") params.set("area", filters.area);
  if (filters.level !== "upper") params.set("level", filters.level);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function applyFilters(
  lineups: readonly Lineup[],
  filters: Filters,
  withLevels: boolean,
): Lineup[] {
  return lineups.filter(
    (lineup) =>
      (filters.side === "all" || lineup.side === filters.side) &&
      (filters.area === "all" || lineup.area === filters.area) &&
      (!withLevels || (lineup.land.level ?? "upper") === filters.level),
  );
}

export function neighbours(list: readonly Lineup[], id: string): { prev?: Lineup; next?: Lineup } {
  const index = list.findIndex((lineup) => lineup.id === id);
  if (index === -1) return {};
  return { prev: list[index - 1], next: list[index + 1] };
}

/** Filters plus the map view's list tab, as a query string ("smokes" is the default tab). */
export function searchWithTab(filters: Filters, tab: "smokes" | "executes"): string {
  const base = filtersToSearch(filters);
  if (tab === "smokes") return base;
  return base ? `${base}&tab=executes` : "?tab=executes";
}
