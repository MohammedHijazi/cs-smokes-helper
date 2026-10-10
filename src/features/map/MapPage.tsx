import type { ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { NotFound } from "../../app/NotFound";
import { findExecute, findLineup, getMapData } from "../../data";
import { getMapInfo, hasLevels } from "../../data/maps";
import type { Level, Lineup, Position } from "../../data/schema";
import {
  applyFilters,
  filtersToSearch,
  neighbours,
  parseFilters,
  type Filters,
} from "../../lib/filters";
import { HIT_RADIUS_PX, nearestWithin, type Point } from "../../lib/radar";
import { ExecuteList } from "../executes/ExecuteList";
import { ExecuteView } from "../executes/ExecuteView";
import { SmokeCard } from "../smoke/SmokeCard";
import { FiltersBar, LevelSwitch } from "./FiltersBar";
import { LineupList } from "./LineupList";
import { Radar } from "./Radar";
import { LandingMarker, StandDot, StandLine } from "./markers";
import styles from "./MapPage.module.css";

type Tab = "smokes" | "executes";

const isOn = (position: Position, level: Level, withLevels: boolean) =>
  !withLevels || (position.level ?? "upper") === level;

/** Filters plus the list tab, as a query string. */
function searchFor(filters: Filters, tab: Tab): string {
  const base = filtersToSearch(filters);
  if (tab === "smokes") return base;
  return base ? `${base}&tab=executes` : "?tab=executes";
}

export function MapPage() {
  const { mapId = "", lineupId, executeId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const map = getMapInfo(mapId);
  if (!map) return <NotFound />;

  const data = getMapData(map.id);
  const withLevels = hasLevels(map);
  const filters = parseFilters(params);
  const tab: Tab = params.get("tab") === "executes" ? "executes" : "smokes";
  const search = filtersToSearch(filters);
  const backToMap = (toTab: Tab) => `/maps/${map.id}${searchFor(filters, toTab)}`;

  const selected = lineupId ? findLineup(map.id, lineupId) : undefined;
  if (lineupId && !selected) {
    return <NotFound backTo={{ href: backToMap("smokes"), label: `Back to ${map.name}` }} />;
  }
  const execute = executeId ? findExecute(map.id, executeId) : undefined;
  if (executeId && !execute) {
    return <NotFound backTo={{ href: backToMap("executes"), label: `Back to ${map.name}` }} />;
  }

  const visible = applyFilters(data.lineups, filters, withLevels);
  const visibleExecutes = data.executes.filter(
    (e) => filters.side === "all" || e.side === filters.side,
  );
  const executeLineups = execute
    ? execute.lineupIds
        .map((id) => findLineup(map.id, id))
        .filter((lineup): lineup is Lineup => lineup !== undefined)
    : [];

  const replaceSearch = (nextSearch: string) => navigate({ search: nextSearch }, { replace: true });
  const smokeHref = (lineup: Lineup) => `/maps/${map.id}/smokes/${lineup.id}${search}`;
  const on = (position: Position) => isOn(position, filters.level, withLevels);

  // A deep-linked smoke stays on the radar even when the filters exclude it.
  const markers =
    selected && !visible.includes(selected) && on(selected.land) ? [...visible, selected] : visible;

  function handleTap(point: Point, widthPx: number) {
    const hit = nearestWithin(markers, (lineup) => lineup.land, point, HIT_RADIUS_PX / widthPx);
    if (hit) navigate(smokeHref(hit));
  }

  let radarContent: ReactNode;
  if (execute) {
    radarContent = executeLineups.map((lineup, index) => (
      <g key={lineup.id}>
        {on(lineup.stand) && on(lineup.land) && <StandLine from={lineup.stand} to={lineup.land} />}
        {on(lineup.land) && (
          <LandingMarker at={lineup.land} side={lineup.side} label={String(index + 1)} />
        )}
        {on(lineup.stand) && <StandDot at={lineup.stand} side={lineup.side} />}
      </g>
    ));
  } else {
    radarContent = (
      <>
        {markers.map((lineup) => (
          <LandingMarker
            key={lineup.id}
            at={lineup.land}
            side={lineup.side}
            selected={lineup.id === selected?.id}
          />
        ))}
        {selected && on(selected.stand) && on(selected.land) && (
          <StandLine from={selected.stand} to={selected.land} />
        )}
        {selected && on(selected.stand) && <StandDot at={selected.stand} side={selected.side} />}
      </>
    );
  }

  let panel: ReactNode;
  if (execute) {
    panel = (
      <ExecuteView
        map={map}
        execute={execute}
        lineups={executeLineups}
        closeHref={backToMap("executes")}
      />
    );
  } else if (selected) {
    const { prev, next } = neighbours(visible, selected.id);
    panel = (
      <SmokeCard
        map={map}
        lineup={selected}
        closeHref={backToMap("smokes")}
        prevHref={prev && smokeHref(prev)}
        nextHref={next && smokeHref(next)}
      />
    );
  } else {
    panel = (
      <>
        <div role="tablist" aria-label="List" className={styles.tabs}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "smokes"}
            onClick={() => replaceSearch(searchFor(filters, "smokes"))}
          >
            Smokes ({visible.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "executes"}
            onClick={() => replaceSearch(searchFor(filters, "executes"))}
          >
            Executes ({visibleExecutes.length})
          </button>
        </div>
        {tab === "smokes" ? (
          <LineupList
            mapId={map.id}
            lineups={visible}
            search={search}
            emptyText={
              data.lineups.length === 0
                ? "No smokes on this map yet."
                : "No smokes match these filters."
            }
          />
        ) : (
          <ExecuteList
            mapId={map.id}
            executes={visibleExecutes}
            lineups={data.lineups}
            search={search}
            emptyText={
              data.executes.length === 0
                ? "No executes on this map yet."
                : "No executes match these filters."
            }
          />
        )}
      </>
    );
  }

  return (
    <div className={styles.page} data-open={selected ? "true" : "false"}>
      <section className={styles.radarCol}>
        <div className={styles.heading}>
          <Link to="/" className={styles.back}>
            ← Maps
          </Link>
          <h1>{map.name}</h1>
        </div>
        {execute ? (
          withLevels && (
            <LevelSwitch
              value={filters.level}
              onSelect={(level) => replaceSearch(searchFor({ ...filters, level }, tab))}
            />
          )
        ) : (
          <FiltersBar
            map={map}
            filters={filters}
            onChange={(next) => replaceSearch(searchFor(next, tab))}
          />
        )}
        <Radar
          map={map}
          level={filters.level}
          label={`${map.name} radar`}
          onTap={execute ? undefined : handleTap}
        >
          {radarContent}
        </Radar>
      </section>
      <section className={styles.panel}>{panel}</section>
    </div>
  );
}
