import { useState } from "react";
import { getMapInfo, hasLevels } from "../../data/maps";
import type { Level, Position } from "../../data/schema";
import { isClose, type Point } from "../../lib/radar";
import type { Rng } from "../../lib/random";
import type { QueueItem, Rating } from "../../lib/scheduler";
import { techniqueChoices, techniqueText } from "../../lib/technique";
import { LevelSwitch } from "../map/FiltersBar";
import { Radar } from "../map/Radar";
import { LandingMarker, StandDot, StandLine, TapMark } from "../map/markers";
import { StatusBadge } from "../smoke/StatusBadge";
import { VideoPlayer } from "../smoke/VideoPlayer";
import styles from "./Study.module.css";

export interface StudyCardProps {
  item: QueueItem;
  /** Technique texts of the map's other smokes, used for distractors. */
  sameMapTechniques: readonly string[];
  onRate: (rating: Rating) => void;
  rng?: Rng;
}

export function StudyCard({ item, sameMapTechniques, onRate, rng }: StudyCardProps) {
  const { lineup } = item;
  const map = getMapInfo(item.map)!;
  const withLevels = hasLevels(map);
  const correct = techniqueText(lineup.throw);

  const [level, setLevel] = useState<Level>(lineup.stand.level ?? "upper");
  const [tap, setTap] = useState<Point | null>(null);
  const [standShown, setStandShown] = useState(false);
  const [choices] = useState(() => techniqueChoices(correct, sameMapTechniques, rng));
  const [picked, setPicked] = useState<string | null>(null);

  const on = (position: Position) => !withLevels || (position.level ?? "upper") === level;
  const tapRight = tap !== null && isClose(tap, lineup.stand);

  return (
    <article className={styles.card} aria-label={`Study: ${lineup.name} from ${lineup.from}`}>
      <header className={styles.prompt}>
        <p className={styles.mapName}>
          {map.name} ·{" "}
          <span className={styles.side} data-side={lineup.side}>
            {lineup.side}
          </span>
        </p>
        <h2>
          {lineup.name} — from {lineup.from}
        </h2>
        {lineup.status === "unreviewed" && <StatusBadge status="unreviewed" />}
      </header>

      <section className={styles.step}>
        <h3>1. Where do you stand?</h3>
        {withLevels && <LevelSwitch value={level} onSelect={setLevel} />}
        <Radar
          map={map}
          level={level}
          label={`${map.name} radar`}
          onTap={
            standShown
              ? undefined
              : (point) => {
                  setTap(point);
                  setStandShown(true);
                }
          }
        >
          {on(lineup.land) && <LandingMarker at={lineup.land} side={lineup.side} />}
          {standShown && on(lineup.stand) && on(lineup.land) && (
            <StandLine from={lineup.stand} to={lineup.land} />
          )}
          {standShown && on(lineup.stand) && <StandDot at={lineup.stand} side={lineup.side} />}
          {tap && <TapMark at={tap} correct={tapRight} />}
        </Radar>
        {standShown ? (
          <p className={styles.result}>
            {tap === null
              ? "The dot shows where to stand."
              : tapRight
                ? "✓ Right spot"
                : "✗ Not quite — the dot shows where to stand."}
          </p>
        ) : (
          <button type="button" onClick={() => setStandShown(true)}>
            Skip
          </button>
        )}
      </section>

      {standShown && (
        <section className={styles.step}>
          <h3>2. How do you throw it?</h3>
          <div className={styles.choices} role="group" aria-label="Technique">
            {choices.map((choice) => (
              <button
                key={choice}
                type="button"
                disabled={picked !== null}
                data-result={
                  picked === null
                    ? undefined
                    : choice === correct
                      ? "correct"
                      : choice === picked
                        ? "wrong"
                        : undefined
                }
                onClick={() => setPicked(choice)}
              >
                {choice}
              </button>
            ))}
          </div>
          {picked && (
            <p className={styles.result}>{picked === correct ? "✓ Right" : `✗ It's ${correct}`}</p>
          )}
        </section>
      )}

      {picked && (
        <section className={styles.step}>
          <h3>3. Check your aim</h3>
          <VideoPlayer video={lineup.video} title={`${lineup.name} from ${lineup.from}`} />
          {lineup.notes && <p className={styles.notes}>{lineup.notes}</p>}
          <div className={styles.rating}>
            <button type="button" onClick={() => onRate("forgot")}>
              Forgot
            </button>
            <button type="button" onClick={() => onRate("got")}>
              Got it
            </button>
          </div>
        </section>
      )}
    </article>
  );
}
