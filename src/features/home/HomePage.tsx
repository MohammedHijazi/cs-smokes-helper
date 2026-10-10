import { Link } from "react-router";
import { useProgress } from "../../app/progress";
import { allLineups, getMapData, useDataVersion } from "../../data";
import { MAPS } from "../../data/maps";
import { assetUrl } from "../../lib/assets";
import { knownCount, newAllowance, studyCounts } from "../../lib/scheduler";
import styles from "./HomePage.module.css";

export function HomePage() {
  useDataVersion();
  const { progress, today } = useProgress();
  const { due, fresh } = studyCounts({
    candidates: allLineups(),
    cards: progress.cards,
    filter: { maps: progress.settings.maps, sides: progress.settings.sides },
    allowance: newAllowance(progress.newToday, progress.settings.newPerDay, today),
    today,
  });

  return (
    <section>
      <div className={styles.top}>
        <h1 className={styles.title}>Maps</h1>
        <Link to="/study" className={styles.study}>
          Study · {due + fresh} due
        </Link>
      </div>
      <ul className={styles.grid} aria-label="Maps">
        {MAPS.map((map) => {
          const { known, total } = knownCount(getMapData(map.id).lineups, progress.cards);
          return (
            <li key={map.id}>
              <Link to={`/maps/${map.id}`} className={styles.tile}>
                <img src={assetUrl(map.radar)} alt="" loading="lazy" className={styles.thumb} />
                <span className={styles.name}>{map.name}</span>
                <span className={styles.count}>
                  {known}/{total} known
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
