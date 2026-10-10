import { Link } from "react-router";
import type { Lineup, MapId } from "../../data/schema";
import { techniqueText } from "../../lib/technique";
import { StatusBadge } from "../smoke/StatusBadge";
import styles from "./MapPage.module.css";

export function LineupList({
  mapId,
  lineups,
  search,
  emptyText,
}: {
  mapId: MapId;
  lineups: readonly Lineup[];
  search: string;
  emptyText: string;
}) {
  if (lineups.length === 0) return <p className={styles.empty}>{emptyText}</p>;
  return (
    <ul className={styles.list} aria-label="Smokes">
      {lineups.map((lineup) => (
        <li key={lineup.id}>
          <Link to={`/maps/${mapId}/smokes/${lineup.id}${search}`} className={styles.row}>
            <span>
              <strong>{lineup.name}</strong>{" "}
              <span className={styles.rowFrom}>from {lineup.from}</span>
            </span>
            <span className={styles.rowMeta}>
              <span className={styles.sideTag} data-side={lineup.side}>
                {lineup.side}
              </span>
              <span>{techniqueText(lineup.throw)}</span>
              {lineup.status !== "ok" && <StatusBadge status={lineup.status} />}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
