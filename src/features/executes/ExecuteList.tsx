import { Link } from "react-router";
import type { Execute, Lineup, MapId } from "../../data/schema";
import styles from "../map/MapPage.module.css";

export function ExecuteList({
  mapId,
  executes,
  lineups,
  search,
  emptyText,
}: {
  mapId: MapId;
  executes: readonly Execute[];
  lineups: readonly Lineup[];
  search: string;
  emptyText: string;
}) {
  if (executes.length === 0) return <p className={styles.empty}>{emptyText}</p>;
  const nameOf = (id: string) => lineups.find((lineup) => lineup.id === id)?.name ?? id;
  return (
    <ul className={styles.list} aria-label="Executes">
      {executes.map((execute) => (
        <li key={execute.id}>
          <Link to={`/maps/${mapId}/executes/${execute.id}${search}`} className={styles.row}>
            <span>
              <strong>{execute.name}</strong>{" "}
              <span className={styles.sideTag} data-side={execute.side}>
                {execute.side}
              </span>
            </span>
            <span className={styles.rowMeta}>{execute.lineupIds.map(nameOf).join(" · ")}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
