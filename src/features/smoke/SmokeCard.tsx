import type { ReactNode } from "react";
import { Link } from "react-router";
import type { MapInfo } from "../../data/maps";
import type { Lineup } from "../../data/schema";
import { techniqueText } from "../../lib/technique";
import { effectiveStart, parseYouTubeUrl, watchUrl } from "../../lib/youtube";
import { Radar } from "../map/Radar";
import { LandingMarker, StandDot, StandLine } from "../map/markers";
import { StatusBadge } from "./StatusBadge";
import { VideoPlayer } from "./VideoPlayer";
import styles from "./SmokeCard.module.css";

export interface SmokeCardProps {
  map: MapInfo;
  lineup: Lineup;
  /** "page": header and navigation. "embedded": content only (used inside execute rows). */
  variant?: "page" | "embedded";
  closeHref?: string;
  prevHref?: string;
  nextHref?: string;
  /** Dev-only edit buttons, shown under the header (page variant only). */
  actions?: ReactNode;
}

export function SmokeCard({
  map,
  lineup,
  variant = "page",
  closeHref,
  prevHref,
  nextHref,
  actions,
}: SmokeCardProps) {
  const youtube = parseYouTubeUrl(lineup.video.url);
  const level = lineup.land.level ?? "upper";
  const standOnSameLevel = (lineup.stand.level ?? "upper") === level;
  const title = `${lineup.name} from ${lineup.from}`;

  return (
    <article className={styles.card} aria-label={title}>
      {variant === "page" && (
        <header className={styles.header}>
          {closeHref && (
            <Link to={closeHref} className={styles.close} aria-label="Back to the list">
              ←
            </Link>
          )}
          <div className={styles.titles}>
            <h2>{lineup.name}</h2>
            <p className={styles.from}>from {lineup.from}</p>
          </div>
          <span className={styles.side} data-side={lineup.side}>
            {lineup.side}
          </span>
          <nav className={styles.pager} aria-label="Smoke navigation">
            <PagerLink href={prevHref} label="Previous smoke" text="‹" />
            <PagerLink href={nextHref} label="Next smoke" text="›" />
          </nav>
        </header>
      )}
      {variant === "page" && actions}

      <VideoPlayer video={lineup.video} title={title} />
      <p className={styles.technique}>{techniqueText(lineup.throw)}</p>
      {lineup.notes && <p className={styles.notes}>{lineup.notes}</p>}

      <div className={styles.meta}>
        <div className={styles.mini}>
          <Radar map={map} level={level} label={`${lineup.name} on the ${map.name} radar`}>
            {standOnSameLevel && <StandLine from={lineup.stand} to={lineup.land} />}
            <LandingMarker at={lineup.land} side={lineup.side} selected />
            {standOnSameLevel && <StandDot at={lineup.stand} side={lineup.side} />}
          </Radar>
        </div>
        <div className={styles.facts}>
          <StatusBadge status={lineup.status} />
          <span className={styles.checked}>Last checked {lineup.checkedOn}</span>
          {youtube && (
            <a
              href={watchUrl(youtube.id, effectiveStart(lineup.video))}
              target="_blank"
              rel="noreferrer"
            >
              Open on YouTube ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function PagerLink({ href, label, text }: { href?: string; label: string; text: string }) {
  if (!href) {
    return (
      <span role="link" aria-label={label} aria-disabled="true" className={styles.pagerLink}>
        {text}
      </span>
    );
  }
  return (
    <Link to={href} aria-label={label} className={styles.pagerLink}>
      {text}
    </Link>
  );
}
