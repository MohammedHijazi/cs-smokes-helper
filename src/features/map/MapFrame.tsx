import type { ReactNode } from "react";
import { Link } from "react-router";
import type { MapInfo } from "../../data/maps";
import styles from "./MapPage.module.css";

/** The map screens' frame: heading, controls and radar on the left; the panel on the right. */
export function MapFrame({
  map,
  open = false,
  controls,
  radar,
  panel,
}: {
  map: MapInfo;
  /** On phones, hides the radar column while a card fills the screen. */
  open?: boolean;
  controls?: ReactNode;
  radar: ReactNode;
  panel: ReactNode;
}) {
  return (
    <div className={styles.page} data-open={open ? "true" : "false"}>
      <section className={styles.radarCol}>
        <div className={styles.heading}>
          <Link to="/" className={styles.back}>
            ← Maps
          </Link>
          <h1>{map.name}</h1>
        </div>
        {controls}
        {radar}
      </section>
      <section className={styles.panel}>{panel}</section>
    </div>
  );
}
