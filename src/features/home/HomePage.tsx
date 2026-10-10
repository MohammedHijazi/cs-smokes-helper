import { Link } from "react-router";
import { getMapData } from "../../data";
import { MAPS } from "../../data/maps";
import { assetUrl } from "../../lib/assets";
import styles from "./HomePage.module.css";

export function HomePage() {
  return (
    <section>
      <h1 className={styles.title}>Maps</h1>
      <ul className={styles.grid} aria-label="Maps">
        {MAPS.map((map) => {
          const total = getMapData(map.id).lineups.filter((l) => l.status !== "broken").length;
          return (
            <li key={map.id}>
              <Link to={`/maps/${map.id}`} className={styles.tile}>
                <img src={assetUrl(map.radar)} alt="" loading="lazy" className={styles.thumb} />
                <span className={styles.name}>{map.name}</span>
                <span className={styles.count}>
                  {total} {total === 1 ? "smoke" : "smokes"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
