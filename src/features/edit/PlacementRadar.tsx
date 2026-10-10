import { useRef, useState, type PointerEvent } from "react";
import { hasLevels, type MapInfo } from "../../data/maps";
import type { Level, Lineup, Position, Side } from "../../data/schema";
import { HIT_RADIUS_PX, nearestWithin, pointerToFraction } from "../../lib/radar";
import { Radar } from "../map/Radar";
import { LandingMarker, StandDot, StandLine } from "../map/markers";
import styles from "./Edit.module.css";

export type Spot = "land" | "stand";

export interface PlacementRadarProps {
  map: MapInfo;
  level: Level;
  /** The draft's markers use this side's colour. */
  side: Side;
  stand: Position | null;
  land: Position | null;
  /** The spot a click on empty radar sets. */
  active: Spot;
  /** Other smokes on the map, drawn faded for context. They can't be clicked. */
  context: readonly Lineup[];
  onPlace: (spot: Spot, position: Position) => void;
  /** A press that placed or grabbed a spot has ended. */
  onRelease?: (spot: Spot) => void;
}

const SPOTS = ["land", "stand"] as const;
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** The edit forms' radar: click to place the active spot, drag either spot to adjust it. */
export function PlacementRadar({
  map,
  level,
  side,
  stand,
  land,
  active,
  context,
  onPlace,
  onRelease,
}: PlacementRadarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<Spot | null>(null);
  const withLevels = hasLevels(map);
  const spots = { land, stand };
  const onLevel = (position: Position | null): position is Position =>
    position !== null && (!withLevels || (position.level ?? "upper") === level);

  function locate(event: PointerEvent<HTMLDivElement>, element: HTMLDivElement) {
    const rect = element.getBoundingClientRect();
    const point = pointerToFraction(event.clientX, event.clientY, rect);
    const position: Position = {
      x: round3(point.x),
      y: round3(point.y),
      ...(withLevels ? { level } : {}),
    };
    return { point, position, widthPx: rect.width };
  }

  function handleDown(event: PointerEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const { point, position, widthPx } = locate(event, ref.current);
    const shown = SPOTS.filter((spot) => onLevel(spots[spot]));
    const grabbed = nearestWithin(
      shown,
      (spot) => spots[spot] as Position,
      point,
      HIT_RADIUS_PX / widthPx,
    );
    if (!grabbed) onPlace(active, position);
    setDragging(grabbed ?? active);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    if (dragging && ref.current) onPlace(dragging, locate(event, ref.current).position);
  }

  function handleUp() {
    if (!dragging) return;
    onRelease?.(dragging);
    setDragging(null);
  }

  return (
    <div
      ref={ref}
      className={styles.placement}
      data-testid="placement-radar"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      <Radar map={map} level={level} label={`${map.name} radar: click to place the ${active} spot`}>
        <g className={styles.context}>
          {context
            .filter((lineup) => onLevel(lineup.land))
            .map((lineup) => (
              <LandingMarker key={lineup.id} at={lineup.land} side={lineup.side} />
            ))}
        </g>
        {onLevel(stand) && onLevel(land) && <StandLine from={stand} to={land} />}
        {onLevel(land) && <LandingMarker at={land} side={side} selected />}
        {onLevel(stand) && <StandDot at={stand} side={side} />}
      </Radar>
    </div>
  );
}
