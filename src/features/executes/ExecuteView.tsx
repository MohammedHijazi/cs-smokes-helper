import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import type { MapInfo } from "../../data/maps";
import type { Execute, Lineup } from "../../data/schema";
import { SmokeCard } from "../smoke/SmokeCard";
import styles from "./ExecuteView.module.css";

export function ExecuteView({
  map,
  execute,
  lineups,
  closeHref,
  actions,
}: {
  map: MapInfo;
  execute: Execute;
  /** The execute's smokes, in throw order. */
  lineups: readonly Lineup[];
  closeHref: string;
  /** Dev-only edit buttons, shown under the header. */
  actions?: ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <article className={styles.view} aria-label={execute.name}>
      <header className={styles.header}>
        <Link to={closeHref} className={styles.close} aria-label="Back to the list">
          ←
        </Link>
        <h2>{execute.name}</h2>
        <span className={styles.side} data-side={execute.side}>
          {execute.side}
        </span>
      </header>
      {actions}
      {execute.notes && <p className={styles.notes}>{execute.notes}</p>}
      <ol className={styles.steps}>
        {lineups.map((lineup, index) => {
          const expanded = openId === lineup.id;
          return (
            <li key={lineup.id}>
              <button
                type="button"
                className={styles.step}
                aria-expanded={expanded}
                onClick={() => setOpenId(expanded ? null : lineup.id)}
              >
                <span className={styles.number}>{index + 1}</span>
                {lineup.name} <span className={styles.from}>from {lineup.from}</span>
              </button>
              {expanded && <SmokeCard map={map} lineup={lineup} variant="embedded" />}
            </li>
          );
        })}
      </ol>
    </article>
  );
}
