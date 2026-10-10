import type { Side } from "../../data/schema";
import type { Point } from "../../lib/radar";
import styles from "./Radar.module.css";

/** Fraction (0–1) → overlay units (0–1000), one decimal. */
const units = (fraction: number) => Math.round(fraction * 10000) / 10;

export function LandingMarker({
  at,
  side,
  selected = false,
  label,
}: {
  at: Point;
  side: Side;
  selected?: boolean;
  label?: string;
}) {
  const cx = units(at.x);
  const cy = units(at.y);
  return (
    <g
      className={styles.landing}
      data-testid="landing-marker"
      data-side={side}
      data-selected={selected ? "true" : undefined}
    >
      <circle cx={cx} cy={cy} r={24} />
      {label && (
        <text x={cx} y={cy} dy="0.35em" textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}

export function StandDot({ at, side }: { at: Point; side: Side }) {
  return (
    <circle
      className={styles.stand}
      data-testid="stand-dot"
      data-side={side}
      cx={units(at.x)}
      cy={units(at.y)}
      r={10}
    />
  );
}

export function StandLine({ from, to }: { from: Point; to: Point }) {
  return (
    <line
      className={styles.line}
      data-testid="stand-line"
      x1={units(from.x)}
      y1={units(from.y)}
      x2={units(to.x)}
      y2={units(to.y)}
    />
  );
}

export function TapMark({ at, correct }: { at: Point; correct: boolean }) {
  const x = units(at.x);
  const y = units(at.y);
  const d = 14;
  return (
    <g className={styles.tap} data-testid="tap-mark" data-correct={String(correct)}>
      <line x1={x - d} y1={y - d} x2={x + d} y2={y + d} />
      <line x1={x - d} y1={y + d} x2={x + d} y2={y - d} />
    </g>
  );
}
