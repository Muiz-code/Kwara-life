// World layout: projects real coordinates to map pixels and finds routes.
// Ported from reference/kwara-life.html so distances, fares and times match.
import { PLACES, WAYPOINTS } from "../data/locations";
import { ROADS } from "../data/roads";

export interface Point {
  x: number;
  y: number;
}

/** Pixels per degree. */
const K = 11000;
const ORIGIN = { lat: 8.4879, lng: 4.5644 };
/** North of this the long Malete road is squashed so KWASU fits on the map. */
const SQUASH_FROM = { lat: 8.5383, lng: 4.5524 };
const SQUASH = 0.42;
const PAD = 260;

function rawCity(lat: number, lng: number): Point {
  return { x: (lng - ORIGIN.lng) * K, y: (ORIGIN.lat - lat) * K };
}

function rawPos(lat: number, lng: number): Point {
  if (lat > 8.54) {
    const b = rawCity(SQUASH_FROM.lat, SQUASH_FROM.lng);
    return { x: b.x + (lng - SQUASH_FROM.lng) * K * SQUASH, y: b.y - (lat - SQUASH_FROM.lat) * K * SQUASH };
  }
  return rawCity(lat, lng);
}

interface LayoutNode extends Point {
  id: string;
  way: boolean;
  ox: number;
  oy: number;
}

function layout() {
  const nodes: LayoutNode[] = [
    ...PLACES.map((p) => ({ id: p.id, way: false, lat: p.lat, lng: p.lng })),
    ...WAYPOINTS.map((w) => ({ id: w.id, way: true, lat: w.lat, lng: w.lng })),
  ].map((n) => {
    const p = rawPos(n.lat, n.lng);
    return { id: n.id, way: n.way, x: p.x, y: p.y, ox: p.x, oy: p.y };
  });

  // Push places apart so building tiles don't overlap, while pulling each back to its true spot.
  for (let it = 0; it < 400; it++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const D = a.way && b.way ? 90 : a.way || b.way ? 130 : 215;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < D) {
          const m = (D - d) / 2;
          dx /= d;
          dy /= d;
          a.x -= dx * m;
          a.y -= dy * m * 0.8;
          b.x += dx * m;
          b.y += dy * m * 0.8;
        }
      }
    }
    for (const n of nodes) {
      n.x += (n.ox - n.x) * 0.012;
      n.y += (n.oy - n.y) * 0.012;
    }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x);
    maxY = Math.max(maxY, n.y);
  }
  const pos: Record<string, Point> = {};
  for (const n of nodes) pos[n.id] = { x: Math.round(n.x - minX + PAD), y: Math.round(n.y - minY + PAD + 40) };
  return {
    pos,
    width: Math.round(maxX - minX + PAD * 2),
    height: Math.round(maxY - minY + PAD * 2 + 40),
  };
}

const L = layout();

export const WORLD_W = L.width;
export const WORLD_H = L.height;

/** Where a place's building tile is centred. */
export const placePos = (id: string): Point => L.pos[id];

const WAY_IDS = new Set(WAYPOINTS.map((w) => w.id));

/** Where roads meet a place (in front of the building). */
export function nodePos(id: string): Point {
  const p = L.pos[id];
  if (WAY_IDS.has(id) || id === "po") return { x: p.x, y: p.y };
  return { x: p.x, y: p.y + 46 };
}

/** Where the avatar stands when at a place. */
export function standPos(id: string): Point {
  const p = L.pos[id];
  if (id === "po") return { x: p.x + 56, y: p.y + 44 };
  return { x: p.x + 38, y: p.y + 70 };
}

export const ADJ: Record<string, string[]> = {};
for (const r of ROADS) {
  (ADJ[r.a] ??= []).push(r.b);
  (ADJ[r.b] ??= []).push(r.a);
}

const HIGHWAY = new Set(ROADS.filter((r) => r.highway).flatMap((r) => [`${r.a}|${r.b}`, `${r.b}|${r.a}`]));
export const isHighway = (a: string, b: string) => HIGHWAY.has(`${a}|${b}`);

const dist = (p: Point, q: Point) => Math.hypot(q.x - p.x, q.y - p.y);

/** Dijkstra over the road graph. Returns node ids from start to end inclusive. */
export function shortestPath(from: string, to: string): string[] {
  const ids = Object.keys(L.pos);
  const d: Record<string, number> = {};
  const prev: Record<string, string> = {};
  const open = new Set(ids);
  for (const id of ids) d[id] = Infinity;
  d[from] = 0;
  while (open.size) {
    let u: string | null = null;
    for (const n of open) if (u === null || d[n] < d[u]) u = n;
    if (u === null) break;
    open.delete(u);
    if (u === to || d[u] === Infinity) break;
    for (const v of ADJ[u] ?? []) {
      if (!open.has(v)) continue;
      const alt = d[u] + dist(nodePos(u), nodePos(v));
      if (alt < d[v]) {
        d[v] = alt;
        prev[v] = u;
      }
    }
  }
  const path: string[] = [];
  for (let c: string | undefined = to; c; c = prev[c]) path.unshift(c);
  return path;
}

export interface Route {
  ids: string[];
  pts: Point[];
  /** Length in world pixels. */
  length: number;
  /** Uses the Malete road. */
  highway: boolean;
}

export function route(from: string, to: string): Route {
  const ids = shortestPath(from, to);
  const pts = [standPos(from), ...ids.map(nodePos), standPos(to)];
  return { ids, pts, length: polylineLength(pts), highway: ids.some((id, i) => i > 0 && isHighway(ids[i - 1], id)) };
}

export function polylineLength(pts: Point[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1], pts[i]);
  return d;
}

/** Point a fraction f (0..1) along the polyline, with the segment's x direction for flipping sprites. */
export function pointAlong(pts: Point[], f: number): Point & { dx: number } {
  let target = polylineLength(pts) * f;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    if (target <= seg) {
      const k = seg ? target / seg : 0;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k,
        dx: pts[i].x - pts[i - 1].x,
      };
    }
    target -= seg;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, dx: 1 };
}

/** Ease in-out used for trips; the clock advances with the same curve. */
export const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
