// The fallback LGA map builder, ported from reference/naija-votes-2027.html.
//
// Used for any LGA that has no OpenStreetMap data yet. Same seed, same hash, same
// generator, same numbers as the prototype: places scattered from the LGA's seed
// and pushed apart, a river when the area has water, and roads as a minimum
// spanning tree plus a few loops.
import { ROAD_NAMES, ZONE_BIOME, type BiomeId } from "../data/biomes";
import { lgaPlaces, type LgaContext } from "../data/lga";
import type { ClassId } from "../data/jobs";
import type { State } from "../data/states";
import { isPlaceKind, type MapPlace, type MapRoad, type Point, type PlaceKind, type WorldMap } from "./types";

/** FNV-1a, the prototype's string hash. */
export function hash(s: string): number {
  let h = 2166136261;
  for (const c of String(s)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The prototype's LCG. src/sim/rng.ts uses a different one, so keep this here. */
export function lcg(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const GEN_W = 2000;
export const GEN_H = 1400;

export type CitizenClass = ClassId;

export interface GenOptions {
  state: State;
  /** LGA name as it appears in state.lgas. */
  lga: string;
  /** Polling unit index, part of the seed, as in the prototype. */
  pu: number;
  cls: CitizenClass;
  job: string;
  /** Where the citizen lives, for the home blurb. */
  home?: string;
  /** Sleeping under a flyover. */
  under?: boolean;
  /** Used to sleep under a flyover, so the shelter still shows. */
  wasUnder?: boolean;
  /** Overrides the zone's default biome, for example green farmland in Kaduna. */
  biome?: BiomeId;
}

const context = (o: GenOptions): LgaContext => ({
  state: o.state,
  lgaName: o.lga,
  cls: o.cls,
  job: o.job,
  home: o.home ?? "",
  underFlyover: !!o.under,
  ...(o.wasUnder ? { wasUnder: true } : {}),
});

/** The places the prototype's builder laid out. Later additions (the hotel) are not part of its layout. */
const PROTOTYPE_IDS = new Set(["home", "work", "inec", "pu", "market", "buka", "viewing", "kiosk", "mosque", "church", "park", "hall", "board", "landmark", "shelter"]);

/** The prototype's places, named and described in src/data/lga.ts. */
export function genPlaceRows(o: GenOptions) {
  return lgaPlaces(context(o)).filter((p) => PROTOTYPE_IDS.has(p.id)).map((p) => ({
    ...p,
    kind: (isPlaceKind(p.kind) ? p.kind : "house") as PlaceKind,
  }));
}

const segDist = (px: number, py: number, a: Point, b: Point) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = dx * dx + dy * dy;
  let t = l ? ((px - a.x) * dx + (py - a.y) * dy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
};

/** Builds the LGA map. Same output as the prototype's world builder. */
export function generateMap(o: GenOptions): WorldMap {
  const zone = o.state.zone;
  const biome = o.biome ?? ZONE_BIOME[zone];
  const rows = genPlaceRows(o);
  const rng = lcg(hash(o.state.name + o.lga + o.pu));
  const hasRiver = ZONE_BIOME[zone] === "delta" || ["water", "bridge"].includes(o.state.landmark.kind);

  let river: Point[] | undefined;
  if (hasRiver) {
    river = [];
    for (let i = 0; i <= 10; i++) river.push({ x: -100 + i * 220, y: GEN_H * 0.72 + Math.sin(i * 0.9 + rng() * 2) * 120 });
  }

  const nodes = rows.map((r) => {
    let x = 250 + rng() * (GEN_W - 500);
    let y = 220 + rng() * (GEN_H - 440);
    if (r.id === "landmark" && river) {
      x = river[5].x;
      y = river[5].y - 10;
    }
    return { id: r.id, x, y };
  });

  const riverDist = (x: number, y: number) => {
    if (!river) return 1e9;
    let m = 1e9;
    for (let i = 1; i < river.length; i++) m = Math.min(m, segDist(x, y, river[i - 1], river[i]));
    return m;
  };

  // Push places apart so the building tiles do not overlap, and keep them out of the river.
  for (let it = 0; it < 300; it++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < 330) {
          const m = (330 - d) / 2;
          dx /= d;
          dy /= d;
          a.x -= dx * m;
          a.y -= dy * m;
          b.x += dx * m;
          b.y += dy * m;
        }
      }
    }
    for (const n of nodes) {
      n.x = Math.max(220, Math.min(GEN_W - 220, n.x));
      n.y = Math.max(220, Math.min(GEN_H - 180, n.y));
      if (river && n.id !== "landmark" && riverDist(n.x, n.y + 40) < 150) n.y -= 12;
    }
  }
  for (const n of nodes) {
    n.x = Math.round(n.x);
    n.y = Math.round(n.y);
  }

  const at: Record<string, Point> = Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  const places: MapPlace[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    area: o.lga,
    kind: r.kind,
    blurb: r.blurb,
    open: r.open,
    gen: r.gen,
    x: at[r.id].x,
    y: at[r.id].y,
  }));

  const edges = spanningRoads(rows.map((r) => r.id), at);
  const roads: MapRoad[] = edges.map(([a, b, name]) => ({
    name,
    cls: "secondary",
    pts: [roadNode(at[a]), roadNode(at[b])],
  }));

  return {
    id: `${o.state.code}/${o.lga.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
    name: o.lga,
    biome,
    width: GEN_W,
    height: GEN_H,
    places,
    roads,
    ...(river ? { river } : {}),
    source: "generated",
    start: "home",
  };
}

/** Roads meet a place in front of the building, as in the prototype. */
export const roadNode = (p: Point): Point => ({ x: p.x, y: p.y + 46 });

/** Minimum spanning tree over the places, plus up to 5 short loops. */
export function spanningRoads(ids: string[], at: Record<string, Point>): [string, string, string][] {
  const d = (a: string, b: string) => Math.hypot(at[a].x - at[b].x, at[a].y - at[b].y);
  const edges: [string, string, string][] = [];
  const inTree = new Set([ids[0]]);
  let ri = 0;
  while (inTree.size < ids.length) {
    let best: [string, string, number] | null = null;
    inTree.forEach((a) =>
      ids.forEach((b) => {
        if (inTree.has(b)) return;
        const v = d(a, b);
        if (!best || v < best[2]) best = [a, b, v];
      }),
    );
    const win = best as unknown as [string, string, number];
    inTree.add(win[1]);
    edges.push([win[0], win[1], ROAD_NAMES[ri++ % ROAD_NAMES.length]]);
  }
  const has = (a: string, b: string) => edges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));
  const cand: [string, string, number][] = [];
  ids.forEach((a, i) =>
    ids.slice(i + 1).forEach((b) => {
      if (!has(a, b)) cand.push([a, b, d(a, b)]);
    }),
  );
  cand.sort((x, y) => x[2] - y[2]);
  let extra = 0;
  for (const c of cand) {
    if (extra >= 5) break;
    if (c[2] < 640) {
      edges.push([c[0], c[1], ROAD_NAMES[ri++ % ROAD_NAMES.length]]);
      extra++;
    }
  }
  return edges;
}
