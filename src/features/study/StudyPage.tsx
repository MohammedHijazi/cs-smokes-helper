import { useState } from "react";
import { Link } from "react-router";
import { useProgress } from "../../app/progress";
import { allLineups, getMapData, useDataVersion } from "../../data";
import { MAPS } from "../../data/maps";
import { MAP_IDS, SIDES, type MapId, type Side } from "../../data/schema";
import {
  buildQueue,
  eligible,
  newAllowance,
  nextDueDate,
  studyCounts,
  type StudyFilter,
} from "../../lib/scheduler";
import { techniqueText } from "../../lib/technique";
import { StudyCard } from "./StudyCard";
import {
  answerSession,
  currentItem,
  isFinished,
  isRepeat,
  startSession,
  type Session,
} from "./session";
import styles from "./Study.module.css";

/** Adds or removes `value`, keeping the result in `order`. */
function toggled<T>(list: readonly T[], value: T, order: readonly T[]): T[] {
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  return order.filter((v) => next.includes(v));
}

export function StudyPage() {
  useDataVersion();
  const { progress, today, answer, updateSettings } = useProgress();
  const [session, setSession] = useState<Session | null>(null);
  const candidates = allLineups();
  const filter: StudyFilter = { maps: progress.settings.maps, sides: progress.settings.sides };
  const allowance = newAllowance(progress.newToday, progress.settings.newPerDay, today);

  if (session && !isFinished(session)) {
    const item = currentItem(session)!;
    const sameMap = getMapData(item.map)
      .lineups.filter((lineup) => lineup.id !== item.lineup.id)
      .map((lineup) => techniqueText(lineup.throw));
    return (
      <section className={styles.page}>
        <p className={styles.progressLine}>
          Card {session.index + 1} of {session.items.length}
          {isRepeat(session) ? " · repeat" : ""}
        </p>
        <StudyCard
          key={`${session.index}:${item.lineup.id}`}
          item={item}
          sameMapTechniques={sameMap}
          onRate={(rating) => {
            answer(item.lineup.id, rating);
            setSession(answerSession(session, rating));
          }}
        />
      </section>
    );
  }

  const next = nextDueDate(candidates, progress.cards, filter, today);

  if (session) {
    return (
      <section className={styles.page}>
        <h1>Session done</h1>
        <p>
          Got it: {session.got} · Forgot: {session.forgot}
        </p>
        <p>{next ? `Next review: ${next}` : "Nothing is scheduled yet."}</p>
        <div className={styles.row}>
          <button type="button" onClick={() => setSession(null)}>
            Study setup
          </button>
          <Link to="/">Back to maps</Link>
        </div>
      </section>
    );
  }

  const { due, fresh } = studyCounts({
    candidates,
    cards: progress.cards,
    filter,
    allowance,
    today,
  });
  const empty = due + fresh === 0;

  return (
    <section className={styles.page}>
      <h1>Study</h1>
      <fieldset className={styles.fieldset}>
        <legend>Maps</legend>
        {MAPS.map((map) => (
          <label key={map.id} className={styles.check}>
            <input
              type="checkbox"
              checked={progress.settings.maps.includes(map.id)}
              onChange={() =>
                updateSettings({ maps: toggled<MapId>(progress.settings.maps, map.id, MAP_IDS) })
              }
            />
            {map.name}
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend>Sides</legend>
        {SIDES.map((side) => (
          <label key={side} className={styles.check}>
            <input
              type="checkbox"
              checked={progress.settings.sides.includes(side)}
              onChange={() =>
                updateSettings({ sides: toggled<Side>(progress.settings.sides, side, SIDES) })
              }
            />
            {side}
          </label>
        ))}
      </fieldset>
      <p className={styles.counts}>
        {due} due · {fresh} new
      </p>
      {empty && (
        <p>
          {eligible(candidates, filter).length === 0
            ? "No smokes match these choices."
            : `Nothing to study right now.${next ? ` Next review: ${next}.` : ""}`}
        </p>
      )}
      <button
        type="button"
        className={styles.start}
        disabled={empty}
        onClick={() =>
          setSession(
            startSession(
              buildQueue({ candidates, cards: progress.cards, filter, allowance, today }),
            ),
          )
        }
      >
        Start
      </button>
    </section>
  );
}
