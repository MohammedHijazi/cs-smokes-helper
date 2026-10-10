export interface Point {
  x: number;
  y: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Study: a "where do you stand" tap counts as right within this fraction of the radar width. */
export const CLOSE_ENOUGH = 0.06;

/** Map view: a tap selects a landing marker within this many pixels (a 40 px target). */
export const HIT_RADIUS_PX = 20;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function pointerToFraction(clientX: number, clientY: number, rect: RectLike): Point {
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isClose(a: Point, b: Point): boolean {
  return distance(a, b) <= CLOSE_ENOUGH;
}

export function nearestWithin<T>(
  items: readonly T[],
  pointOf: (item: T) => Point,
  target: Point,
  maxDistance: number,
): T | undefined {
  let best: T | undefined;
  let bestDistance = Infinity;
  for (const item of items) {
    const d = distance(pointOf(item), target);
    if (d <= maxDistance && d < bestDistance) {
      best = item;
      bestDistance = d;
    }
  }
  return best;
}
