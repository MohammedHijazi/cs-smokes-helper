import { useRef, type MouseEvent, type ReactNode } from "react";
import { radarPath, type MapInfo } from "../../data/maps";
import type { Level } from "../../data/schema";
import { assetUrl } from "../../lib/assets";
import { pointerToFraction, type Point } from "../../lib/radar";
import styles from "./Radar.module.css";

export interface RadarProps {
  map: MapInfo;
  level?: Level;
  /** Accessible name of the radar image, e.g. "Mirage radar". */
  label: string;
  onTap?: (point: Point, widthPx: number) => void;
  /** SVG content drawn in a 0–1000 coordinate space (see markers.tsx). */
  children?: ReactNode;
  className?: string;
}

export function Radar({ map, level = "upper", label, onTap, children, className }: RadarProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!onTap || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    onTap(pointerToFraction(event.clientX, event.clientY, rect), rect.width);
  }

  return (
    <div
      ref={ref}
      className={[styles.radar, className].filter(Boolean).join(" ")}
      onClick={handleClick}
      data-testid="radar"
    >
      <img src={assetUrl(radarPath(map, level))} alt={label} draggable={false} />
      <svg viewBox="0 0 1000 1000" className={styles.overlay} aria-hidden="true">
        {children}
      </svg>
    </div>
  );
}
