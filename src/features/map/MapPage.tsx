import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { NotFound } from "../../app/NotFound";
import { findLineup, getMapData } from "../../data";
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
import { SmokeCard } from "../smoke/SmokeCard";
import { FiltersBar } from "./FiltersBar";
import { LineupList } from "./LineupList";
import { Radar } from "./Radar";
import { LandingMarker, StandDot, StandLine } from "./markers";
import styles from "./MapPage.module.css";

const isOn = (position: Position, level: Level, withLevels: boolean) =>
  !withLevels || (position.level ?? "upper") === level;

export function MapPage() {
  const { mapId = "", lineupId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const map = getMapInfo(mapId);
  if (!map) return <NotFound />;

  const data = getMapData(map.id);
  const withLevels = hasLevels(map);
  const filters = parseFilters(params);
  const search = filtersToSearch(filters);
  const mapHref = `/maps/${map.id}${search}`;
  const visible = applyFilters(data.lineups, filters, withLevels);
  const selected = lineupId ? findLineup(map.id, lineupId) : undefined;
  if (lineupId && !selected) {
    return <NotFound backTo={{ href: mapHref, label: `Back to ${map.name}` }} />;
  }

  const smokeHref = (lineup: Lineup) => `/maps/${map.id}/smokes/${lineup.id}${search}`;
  // A deep-linked smoke stays on the radar even when the filters exclude it.
  const markers =
    selected && !visible.includes(selected) && isOn(selected.land, filters.level, withLevels)
      ? [...visible, selected]
      : visible;
  const { prev, next } = selected ? neighbours(visible, selected.id) : {};

  function changeFilters(nextFilters: Filters) {
    navigate({ search: filtersToSearch(nextFilters) }, { replace: true });
  }

  function handleTap(point: Point, widthPx: number) {
    const hit = nearestWithin(markers, (lineup) => lineup.land, point, HIT_RADIUS_PX / widthPx);
    if (hit) navigate(smokeHref(hit));
  }

  const standVisible = selected !== undefined && isOn(selected.stand, filters.level, withLevels);
  const lineVisible =
    selected !== undefined && standVisible && isOn(selected.land, filters.level, withLevels);

  return (
    <div className={styles.page} data-open={selected ? "true" : "false"}>
      <section className={styles.radarCol}>
        <div className={styles.heading}>
          <Link to="/" className={styles.back}>
            ← Maps
          </Link>
          <h1>{map.name}</h1>
        </div>
        <FiltersBar map={map} filters={filters} onChange={changeFilters} />
        <Radar map={map} level={filters.level} label={`${map.name} radar`} onTap={handleTap}>
          {markers.map((lineup) => (
            <LandingMarker
              key={lineup.id}
              at={lineup.land}
              side={lineup.side}
              selected={lineup.id === selected?.id}
            />
          ))}
          {selected && lineVisible && <StandLine from={selected.stand} to={selected.land} />}
          {selected && standVisible && <StandDot at={selected.stand} side={selected.side} />}
        </Radar>
      </section>
      <section className={styles.panel}>
        {selected ? (
          <SmokeCard
            map={map}
            lineup={selected}
            closeHref={mapHref}
            prevHref={prev && smokeHref(prev)}
            nextHref={next && smokeHref(next)}
          />
        ) : (
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
        )}
      </section>
    </div>
  );
}
