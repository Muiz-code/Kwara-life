// The hand-built Ilorin map as a WorldMap, so one renderer draws every LGA.
//
// Ilorin keeps its own layout and its own routing (src/sim/world.ts): its trip
// distances, times and fares are tuned around those positions and must not move.
// What changes here is the shape of the roads: when the OpenStreetMap shape file
// for Ilorin is present, each road is drawn along the real road line instead of a
// straight dash between two junctions.
import { AD_SLOTS } from "../data/ilorin/billboards";
import { PLACES, WAYPOINTS } from "../data/ilorin/places";
import { ROADS } from "../data/ilorin/roads";
import { WORLD_H, WORLD_W, nodePos, placePos, standPos } from "../sim/world";
import { fitShape, type RoadShapes } from "./shape";
import { OSM_ATTRIBUTION, type MapPlace, type MapRoad, type Point, type WorldMap } from "./types";
import { TILE_ART } from "./art";

/** Ilorin is in the Guinea savanna belt, like the rest of the north central zone. */
const ILORIN_BIOME = "savanna" as const;

export const ILORIN_MAP_ID = "kwara/ilorin";

/** Key for a road's shape in the shape file. */
export const shapeKey = (a: string, b: string) => `${a}|${b}`;

/**
 * Builds the Ilorin WorldMap. Pass the fetched shape file to get real road lines;
 * without it the roads are straight between junctions, as before.
 */
export function ilorinMap(shapes?: RoadShapes): WorldMap {
  const places: MapPlace[] = PLACES.map((p) => {
    const at = placePos(p.id);
    return {
      id: p.id,
      name: p.name,
      area: p.area,
      kind: p.kind,
      blurb: p.blurb,
      open: p.open,
      gen: p.gen,
      x: at.x,
      y: at.y,
      stand: standPos(p.id),
      art: TILE_ART[p.id],
      ...(p.variant ? { variant: p.variant } : {}),
    };
  });

  const roads: MapRoad[] = ROADS.map((r) => {
    const a = nodePos(r.a);
    const b = nodePos(r.b);
    const raw = shapes?.[shapeKey(r.a, r.b)] ?? shapes?.[shapeKey(r.b, r.a)];
    const flipped = !shapes?.[shapeKey(r.a, r.b)] && !!shapes?.[shapeKey(r.b, r.a)];
    const fitted = raw ? fitShape(flipped ? [...raw].reverse() : raw, a, b) : null;
    const pts = fitted && sensible(fitted, a, b) ? fitted : [a, b];
    return { name: r.name, pts, ...(r.highway ? { highway: true as const } : {}), cls: r.highway ? ("trunk" as const) : ("secondary" as const) };
  });

  return {
    id: ILORIN_MAP_ID,
    name: "Ilorin",
    biome: ILORIN_BIOME,
    width: WORLD_W,
    height: WORLD_H,
    places,
    roads,
    junctions: WAYPOINTS.map((w) => ({ name: w.name, ...placePos(w.id) })),
    billboards: AD_SLOTS.map((s) => ({ id: s.id, near: s.near, dx: s.dx, dy: s.dy })),
    source: shapes ? "osm" : "hand",
    ...(shapes ? { attribution: OSM_ATTRIBUTION } : {}),
    start: "home",
  };
}

/**
 * A real road that wanders far off the straight line between two places is the
 * wrong road: the route Overpass gave us went round the long way. Draw the
 * straight line rather than a shape that crosses the map.
 */
function sensible(pts: Point[], a: Point, b: Point): boolean {
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  if (chord < 1) return false;
  let len = 0;
  let off = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  for (const p of pts) {
    const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (chord * chord);
    const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    off = Math.max(off, Math.hypot(p.x - q.x, p.y - q.y));
  }
  return len < chord * 1.5 && off < chord * 0.3;
}

/** Where the Ilorin road shapes live once the fetch script has run. */
export const ILORIN_SHAPES_URL = "/maps/kwara/ilorin-shapes.json";

/** Fetches the shapes, or returns undefined when they have not been fetched yet. */
export async function loadIlorinShapes(fetcher: typeof fetch = fetch): Promise<RoadShapes | undefined> {
  try {
    const res = await fetcher(ILORIN_SHAPES_URL);
    if (!res.ok) return undefined;
    return (await res.json()) as RoadShapes;
  } catch {
    return undefined;
  }
}
