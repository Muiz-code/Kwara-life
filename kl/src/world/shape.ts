// Fitting a real road shape between two points on the map.
//
// The hand-built Ilorin map already knows where every place sits, and its trip
// distances, times and fares are tuned around those positions. So we keep the
// positions and borrow only the shape of the real road: the OpenStreetMap line
// between the two places is turned, scaled and shifted as one piece (a similarity
// transform, so no bend is squashed) until its two ends sit on the map's own
// junction points. The road then curves the way the real road curves.
import type { Point } from "./types";

/** Raw road shapes keyed by the edge they belong to, as "a|b". */
export type RoadShapes = Record<string, [number, number][]>;

export function fitShape(raw: readonly (readonly [number, number])[], a: Point, b: Point): Point[] {
  if (raw.length < 2) return [a, b];
  const p0 = { x: raw[0][0], y: raw[0][1] };
  const p1 = { x: raw[raw.length - 1][0], y: raw[raw.length - 1][1] };
  const sx = p1.x - p0.x;
  const sy = p1.y - p0.y;
  const sl = Math.hypot(sx, sy);
  if (sl < 1e-6) return [a, b];
  const tx = b.x - a.x;
  const ty = b.y - a.y;
  // One complex multiply by target chord over source chord: turns and scales together.
  const cos = (sx * tx + sy * ty) / (sl * sl);
  const sin = (sx * ty - sy * tx) / (sl * sl);
  const out = raw.map(([x, y]) => {
    const dx = x - p0.x;
    const dy = y - p0.y;
    return { x: a.x + dx * cos - dy * sin, y: a.y + dx * sin + dy * cos };
  });
  // The ends are exact by construction; nudge them anyway so welding is clean.
  out[0] = { x: a.x, y: a.y };
  out[out.length - 1] = { x: b.x, y: b.y };
  return out.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
}

/** Drops points that sit close to the straight line between their neighbours. */
export function simplify(pts: readonly Point[], tolerance: number): Point[] {
  if (pts.length <= 2) return pts.map((p) => ({ ...p }));
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let far = -1;
    let best = tolerance;
    for (let k = i + 1; k < j; k++) {
      const d = perpendicular(pts[k], pts[i], pts[j]);
      if (d > best) {
        best = d;
        far = k;
      }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([i, far], [far, j]);
    }
  }
  return pts.filter((_, i) => keep[i]).map((p) => ({ ...p }));
}

function perpendicular(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = dx * dx + dy * dy;
  let t = l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
