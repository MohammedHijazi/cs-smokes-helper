import type { Lineup, Position } from "../../data/schema";
import { LandingMarker, StandDot, StandLine } from "../map/markers";

/** An execute's smokes on a radar, numbered in throw order. */
export function ExecuteMarkers({
  lineups,
  isShown,
}: {
  lineups: readonly Lineup[];
  /** Whether a spot is on the level being shown. */
  isShown: (position: Position) => boolean;
}) {
  return (
    <>
      {lineups.map((lineup, index) => (
        <g key={lineup.id}>
          {isShown(lineup.stand) && isShown(lineup.land) && (
            <StandLine from={lineup.stand} to={lineup.land} />
          )}
          {isShown(lineup.land) && (
            <LandingMarker at={lineup.land} side={lineup.side} label={String(index + 1)} />
          )}
          {isShown(lineup.stand) && <StandDot at={lineup.stand} side={lineup.side} />}
        </g>
      ))}
    </>
  );
}
