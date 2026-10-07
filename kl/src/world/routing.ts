// Routing on real road shapes. Every road is a polyline; its points become graph
// vertices, roads that touch are welded together, and each place is snapped to the
// nearest point on the nearest road (its gate). A trip then follows the real road
// line, so distance, time and fare come from real road length.
import type { MapRoad, Point, WorldMap } from "./types";

const dist = (p: Point, q: Point) => Math.hypot(q.x - p.x, q.y - p.y);

export function polylineLength(pts: Point[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1], pts[i]);
  return d;
}

export interface Projection {
  /** Nearest point on the segment. */
  p: Point;
  /** How far along the segment it falls, 0 to 1. */
  t: number;
  d: number;
}

export function projectOnSegment(p: Point, a: Point, b: Point): Projection {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = dx * dx + dy * dy;
  let t = l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  const q = { x: a.x + t * dx, y: a.y + t * dy };
  return { p: q, t, d: dist(p, q) };
}

export const segmentDistance = (p: Point, a: Point, b: Point) => projectOnSegment(p, a, b).d;

/** How close two road ends must be before we treat them as the same junction. */
const WELD = 8;

interface Vertex {
  id: number;
  x: number;
  y: number;
  edges: { to: number; w: number; road: number }[];
}

export interface RoadGraph {
  verts: Vertex[];
  /** Vertex id of each place's gate, and the gate point itself. */
  gate: Record<string, { v: number; p: Point; road: number }>;
}

/** Grid index so welding and snapping stay fast on big maps. */
class Grid {
  private cell = new Map<string, number[]>();
  constructor(private size: number) {}
  private key = (x: number, y: number) => `${Math.floor(x / this.size)},${Math.floor(y / this.size)}`;
  add(x: number, y: number, id: number) {
    const k = this.key(x, y);
    const a = this.cell.get(k);
    if (a) a.push(id);
    else this.cell.set(k, [id]);
  }
  near(x: number, y: number, rings = 1): number[] {
    const cx = Math.floor(x / this.size);
    const cy = Math.floor(y / this.size);
    const out: number[] = [];
    for (let i = -rings; i <= rings; i++) {
      for (let j = -rings; j <= rings; j++) {
        const a = this.cell.get(`${cx + i},${cy + j}`);
        if (a) out.push(...a);
      }
    }
    return out;
  }
}

/**
 * Builds the road graph for a map. Roads crossing at a shared point become one
 * junction; a road that merely passes near another is not joined, the same way a
 * flyover does not meet the road below it.
 */
export function buildGraph(map: WorldMap): RoadGraph {
  const verts: Vertex[] = [];
  const grid = new Grid(64);

  const vertexAt = (p: Point): number => {
    for (const id of grid.near(p.x, p.y)) {
      if (dist(verts[id], p) <= WELD) return id;
    }
    const v: Vertex = { id: verts.length, x: p.x, y: p.y, edges: [] };
    verts.push(v);
    grid.add(p.x, p.y, v.id);
    return v.id;
  };

  const link = (a: number, b: number, road: number) => {
    if (a === b) return;
    const w = dist(verts[a], verts[b]);
    if (!verts[a].edges.some((e) => e.to === b)) verts[a].edges.push({ to: b, w, road });
    if (!verts[b].edges.some((e) => e.to === a)) verts[b].edges.push({ to: a, w, road });
  };

  map.roads.forEach((r, ri) => {
    let prev = vertexAt(r.pts[0]);
    for (let i = 1; i < r.pts.length; i++) {
      const v = vertexAt(r.pts[i]);
      link(prev, v, ri);
      prev = v;
    }
  });

  // Snap every place to the nearest point on a road, splitting that road segment.
  const gate: RoadGraph["gate"] = {};
  for (const pl of map.places) {
    let best: { d: number; p: Point; a: number; b: number; road: number } | null = null;
    map.roads.forEach((r, ri) => {
      for (let i = 1; i < r.pts.length; i++) {
        const pr = projectOnSegment(pl, r.pts[i - 1], r.pts[i]);
        if (!best || pr.d < best.d) {
          best = { d: pr.d, p: pr.p, a: vertexIdNear(r.pts[i - 1]), b: vertexIdNear(r.pts[i]), road: ri };
        }
      }
    });
    if (!best) continue;
    const hit = best as { d: number; p: Point; a: number; b: number; road: number };
    const v = vertexAt(hit.p);
    // Splice the gate into the segment it landed on.
    link(hit.a, v, hit.road);
    link(v, hit.b, hit.road);
    gate[pl.id] = { v, p: { x: verts[v].x, y: verts[v].y }, road: hit.road };
  }

  function vertexIdNear(p: Point): number {
    for (const id of grid.near(p.x, p.y)) if (dist(verts[id], p) <= WELD) return id;
    return vertexAt(p);
  }

  return { verts, gate };
}

/** Binary heap keyed by distance. */
class Heap {
  private a: [number, number][] = [];
  get size() {
    return this.a.length;
  }
  push(d: number, v: number) {
    const a = this.a;
    a.push([d, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export interface MapRoute {
  /** The two place ids. */
  ids: string[];
  /** The line the trip follows, in world pixels. */
  pts: Point[];
  /** Length in world pixels. */
  length: number;
  /** Uses a long out-of-town road. */
  highway: boolean;
  /** Roads used, in order, with no repeats side by side. */
  roads: MapRoad[];
}

/** Dijkstra from one place to another over the road graph. */
export function routeOn(map: WorldMap, graph: RoadGraph, from: string, to: string): MapRoute {
  const A = graph.gate[from];
  const B = graph.gate[to];
  const start = map.places.find((p) => p.id === from);
  const end = map.places.find((p) => p.id === to);
  if (!A || !B || !start || !end) throw new Error(`No route from ${from} to ${to}`);

  const n = graph.verts.length;
  const d = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const prevRoad = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = new Heap();
  d[A.v] = 0;
  heap.push(0, A.v);
  while (heap.size) {
    const [du, u] = heap.pop();
    if (done[u]) continue;
    done[u] = 1;
    if (u === B.v) break;
    for (const e of graph.verts[u].edges) {
      const alt = du + e.w;
      if (alt < d[e.to]) {
        d[e.to] = alt;
        prev[e.to] = u;
        prevRoad[e.to] = e.road;
        heap.push(alt, e.to);
      }
    }
  }

  const chain: number[] = [];
  const roadIdx: number[] = [];
  for (let c = B.v; c >= 0; c = prev[c]) {
    chain.unshift(c);
    if (prev[c] >= 0) roadIdx.unshift(prevRoad[c]);
    if (c === A.v) break;
  }
  const along = chain.map((v) => ({ x: graph.verts[v].x, y: graph.verts[v].y }));
  // Walk out of the first place and into the last one.
  const pts = [{ x: start.x, y: start.y }, ...along, { x: end.x, y: end.y }];
  const roads: MapRoad[] = [];
  for (const ri of roadIdx) {
    const r = map.roads[ri];
    if (r && roads[roads.length - 1] !== r) roads.push(r);
  }
  return { ids: [from, to], pts, length: polylineLength(pts), highway: roads.some((r) => r.highway), roads };
}

/** Routes with the graph built once, for maps that are routed over many times. */
export function router(map: WorldMap) {
  const graph = buildGraph(map);
  return {
    graph,
    route: (from: string, to: string) => routeOn(map, graph, from, to),
    /** Where the player stands when at a place: at its gate on the road. */
    gate: (id: string): Point => graph.gate[id]?.p ?? { x: 0, y: 0 },
  };
}

/** Mean route length over every pair of places. Used to scale fares between maps. */
export function meanTripLength(map: WorldMap): number {
  const r = router(map);
  let total = 0;
  let n = 0;
  for (let i = 0; i < map.places.length; i++) {
    for (let j = i + 1; j < map.places.length; j++) {
      total += r.route(map.places[i].id, map.places[j].id).length;
      n++;
    }
  }
  return n ? total / n : 0;
}

/** Point a fraction f (0..1) along a polyline, with the x direction for flipping sprites. */
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

/**
 * Mean trip on the hand-built Ilorin map, in world pixels. Every other map is
 * stretched or shrunk to this so a typical trip costs about the same wherever
 * the player lives. Measured with meanTripLength over the Ilorin map.
 */
export const TARGET_MEAN_TRIP = 1590;

/** Multiplies every coordinate on the map, keeping its shape. */
export function scaleMap(map: WorldMap, k: number): WorldMap {
  const s = (p: Point): Point => ({ x: Math.round(p.x * k * 10) / 10, y: Math.round(p.y * k * 10) / 10 });
  return {
    ...map,
    width: Math.round(map.width * k),
    height: Math.round(map.height * k),
    places: map.places.map((p) => ({ ...p, ...s(p) })),
    roads: map.roads.map((r) => ({ ...r, pts: r.pts.map(s) })),
    ...(map.river ? { river: map.river.map(s) } : {}),
    ...(map.junctions ? { junctions: map.junctions.map((j) => ({ ...j, ...s(j) })) } : {}),
    ...(map.metresPerPx ? { metresPerPx: map.metresPerPx / k } : {}),
  };
}

/** Scales a map so a typical trip costs about what the same trip costs in Ilorin. */
export function normaliseTrips(map: WorldMap, target = TARGET_MEAN_TRIP): WorldMap {
  const mean = meanTripLength(map);
  if (!mean) return map;
  return scaleMap(map, target / mean);
}
