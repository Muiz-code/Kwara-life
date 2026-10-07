// Turning an Overpass answer into a WorldMap.
//
// Pure, so scripts/osm-lga.mjs and the tests run the same code. Nothing here
// touches the network: the script fetches, this converts, and the result is
// committed as static JSON. OpenStreetMap data is ODbL, so every map built here
// carries the "© OpenStreetMap contributors" line.
import type { BiomeId } from "../data/biomes";
import { normaliseTrips, projectOnSegment, router, TARGET_MEAN_TRIP } from "./routing";
import { simplify } from "./shape";
import { OSM_ATTRIBUTION, type MapPlace, type MapRoad, type PlaceKind, type Point, type RoadClass, type WorldMap } from "./types";

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: ({ lat: number; lon: number } | null)[];
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  elements: OverpassElement[];
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Tiles are 210 px wide, so two places closer than this would overlap. */
export const MIN_PLACE_GAP = 230;
/** How far above the road a building tile sits, as on the Ilorin map. */
export const ROAD_OFFSET = 46;

const HIGHWAY_CLASS: Record<string, RoadClass> = {
  trunk: "trunk", trunk_link: "trunk",
  primary: "primary", primary_link: "primary",
  secondary: "secondary", secondary_link: "secondary",
  tertiary: "tertiary", tertiary_link: "tertiary",
  residential: "residential", unclassified: "residential",
};

/** Road width on screen, widest class first. Used for drawing and for pruning. */
export const CLASS_RANK: Record<RoadClass, number> = { trunk: 0, primary: 1, secondary: 2, tertiary: 3, residential: 4 };

/**
 * Which game place an OpenStreetMap feature can serve as. First match wins, so
 * the list runs from the most specific tag to the most general.
 */
const RULES: { kind: PlaceKind; test: (t: Record<string, string>) => boolean }[] = [
  { kind: "inec", test: (t) => /\bINEC\b|Independent National Electoral/i.test(t.name ?? "") },
  { kind: "townhall", test: (t) => t.amenity === "townhall" || /local government (secretariat|council)/i.test(t.name ?? "") },
  { kind: "mosque", test: (t) => t.amenity === "place_of_worship" && t.religion === "muslim" },
  { kind: "church", test: (t) => t.amenity === "place_of_worship" && t.religion === "christian" },
  { kind: "market", test: (t) => t.amenity === "marketplace" || t.shop === "supermarket" || /\bmarket\b|\bkasuwa|\bọjà|\bahịa/i.test(t.name ?? "") },
  { kind: "garage", test: (t) => t.amenity === "bus_station" || t.public_transport === "station" || /motor park|park\b.*motor/i.test(t.name ?? "") },
  { kind: "school", test: (t) => t.amenity === "school" || t.amenity === "college" || t.amenity === "university" },
  { kind: "buka", test: (t) => t.amenity === "restaurant" || t.amenity === "fast_food" || t.amenity === "cafe" },
  { kind: "viewing", test: (t) => t.amenity === "cinema" || t.leisure === "sports_centre" || /viewing centre/i.test(t.name ?? "") },
  { kind: "kiosk", test: (t) => t.shop === "newsagent" || t.shop === "books" || t.shop === "kiosk" },
  { kind: "hotel", test: (t) => t.tourism === "hotel" },
  { kind: "stadium", test: (t) => t.leisure === "stadium" || t.sport === "soccer" },
  { kind: "palace", test: (t) => t.historic === "palace" || /\b(emir|oba|obi|shehu|sultan)('s)? palace\b/i.test(t.name ?? "") },
  { kind: "govhouse", test: (t) => t.office === "government" || /government house|state secretariat/i.test(t.name ?? "") },
  { kind: "airport", test: (t) => t.aeroway === "aerodrome" },
  { kind: "campus", test: (t) => t.amenity === "university" },
  { kind: "garden", test: (t) => t.leisure === "park" || t.leisure === "garden" },
  { kind: "lm-water", test: (t) => t.natural === "water" || t.waterway === "river" },
  { kind: "lm-bridge", test: (t) => t.man_made === "bridge" },
  { kind: "lm-rock", test: (t) => t.natural === "rock" || t.natural === "peak" },
  { kind: "lm-forest", test: (t) => t.leisure === "nature_reserve" || t.boundary === "protected_area" },
  { kind: "lm-tower", test: (t) => t.man_made === "tower" || t.tourism === "attraction" },
];

/** One place of each of these kinds is picked for the LGA, in this order. */
export const CIVIC_KINDS: PlaceKind[] = ["inec", "school", "market", "buka", "viewing", "kiosk", "mosque", "church", "garage", "townhall"];

export const classify = (tags: Record<string, string>): PlaceKind | null => RULES.find((r) => r.test(tags))?.kind ?? null;

const EARTH_M_PER_DEG = 111_320;

export interface Projector {
  (ll: LatLng): Point;
  /** Metres of ground per world pixel before any stretching. */
  metresPerPx: number;
}

/** Equirectangular projection about a centre point, in world pixels. */
export function projector(centre: LatLng, pxPerDegLat: number): Projector {
  const cos = Math.cos((centre.lat * Math.PI) / 180);
  const f = ((ll: LatLng) => ({
    x: (ll.lng - centre.lng) * pxPerDegLat * cos,
    y: (centre.lat - ll.lat) * pxPerDegLat,
  })) as Projector;
  f.metresPerPx = EARTH_M_PER_DEG / pxPerDegLat;
  return f;
}

const coord = (e: OverpassElement): LatLng | null => {
  if (typeof e.lat === "number" && typeof e.lon === "number") return { lat: e.lat, lng: e.lon };
  if (e.center) return { lat: e.center.lat, lng: e.center.lon };
  const g = (e.geometry ?? []).filter(Boolean) as { lat: number; lon: number }[];
  if (!g.length) return null;
  return { lat: g.reduce((s, p) => s + p.lat, 0) / g.length, lng: g.reduce((s, p) => s + p.lon, 0) / g.length };
};

export interface ConvertOptions {
  /** LGA code, e.g. "kwara/ilorin-west". */
  id: string;
  /** LGA name, shown on places. */
  name: string;
  biome: BiomeId;
  /** How wide the LGA's built-up area should come out, in world pixels. */
  targetMeanTrip?: number;
  /** Extra named landmarks to keep beyond the civic places. */
  maxLandmarks?: number;
  /** Simplify tolerance in world pixels. */
  tolerance?: number;
}

export interface ConvertResult {
  map: WorldMap;
  /** Kinds asked for that OpenStreetMap had nothing for. */
  missing: PlaceKind[];
  /** How many roads and places went in and came out. */
  stats: { roadsIn: number; roadsOut: number; placesOut: number; movedMax: number };
}

/** Builds a WorldMap from one LGA's Overpass answer. */
export function osmToWorldMap(res: OverpassResponse, o: ConvertOptions): ConvertResult {
  const ways = res.elements.filter((e) => e.type === "way" && e.tags?.highway && HIGHWAY_CLASS[e.tags.highway] && (e.geometry ?? []).length > 1);
  if (!ways.length) throw new Error(`No roads in the OpenStreetMap answer for ${o.id}`);

  // Centre on the roads, and start at a scale where the LGA is a few thousand pixels wide.
  const pts = ways.flatMap((w) => (w.geometry ?? []).filter(Boolean) as { lat: number; lon: number }[]);
  const centre: LatLng = {
    lat: (Math.min(...pts.map((p) => p.lat)) + Math.max(...pts.map((p) => p.lat))) / 2,
    lng: (Math.min(...pts.map((p) => p.lon)) + Math.max(...pts.map((p) => p.lon))) / 2,
  };
  const proj = projector(centre, 100_000);

  const tolerance = o.tolerance ?? 14;
  let roads: MapRoad[] = ways.map((w) => {
    const cls = HIGHWAY_CLASS[w.tags!.highway];
    const line = ((w.geometry ?? []).filter(Boolean) as { lat: number; lon: number }[]).map((p) => proj({ lat: p.lat, lng: p.lon }));
    return {
      name: w.tags!.name ?? "",
      cls,
      ...(cls === "trunk" ? { highway: true as const } : {}),
      pts: simplify(line, tolerance),
    };
  });

  // Candidate places: anything tagged with a name we can use.
  const named = res.elements.filter((e) => e.tags && (e.tags.name || e.tags.amenity));
  const candidates: { kind: PlaceKind; at: Point; tags: Record<string, string>; osm: string }[] = [];
  for (const e of named) {
    const kind = classify(e.tags!);
    const ll = coord(e);
    if (!kind || !ll) continue;
    candidates.push({ kind, at: proj(ll), tags: e.tags!, osm: `${e.type}/${e.id}` });
  }

  // One place per civic kind: the one nearest the middle of the road network.
  const mid = { x: 0, y: 0 };
  const chosen: typeof candidates = [];
  const missing: PlaceKind[] = [];
  for (const kind of CIVIC_KINDS) {
    const of = candidates.filter((c) => c.kind === kind);
    if (!of.length) {
      missing.push(kind);
      continue;
    }
    of.sort((a, b) => Math.hypot(a.at.x - mid.x, a.at.y - mid.y) - Math.hypot(b.at.x - mid.x, b.at.y - mid.y));
    chosen.push(of[0]);
  }
  // Famous places: named landmarks, nearest first, skipping kinds already taken.
  const taken = new Set(chosen.map((c) => c.kind));
  const landmarks = candidates
    .filter((c) => c.tags.name && !taken.has(c.kind) && !CIVIC_KINDS.includes(c.kind))
    .sort((a, b) => Math.hypot(a.at.x, a.at.y) - Math.hypot(b.at.x, b.at.y))
    .filter((c, i, all) => all.findIndex((x) => x.tags.name === c.tags.name) === i)
    .slice(0, o.maxLandmarks ?? 6);
  chosen.push(...landmarks);

  // Crop the roads to the built-up area the chosen places sit in.
  const pad = 600;
  const box = bounds(chosen.map((c) => c.at), pad);
  roads = roads.filter((r) => r.pts.some((p) => inside(p, box))).map((r) => ({ ...r, pts: clip(r.pts, box) })).filter((r) => r.pts.length > 1);

  let places: MapPlace[] = chosen.map((c, i) => ({
    id: placeId(c, i),
    name: c.tags.name ?? kindName(c.kind),
    area: o.name,
    kind: c.kind,
    blurb: blurbFor(c.kind, c.tags.name ?? kindName(c.kind), o.name),
    open: openHours(c.kind),
    gen: c.kind === "inec" || c.kind === "viewing" || c.kind === "govhouse",
    x: c.at.x,
    y: c.at.y,
    osm: c.osm,
  }));

  let map: WorldMap = {
    id: o.id,
    name: o.name,
    biome: o.biome,
    width: 0,
    height: 0,
    places,
    roads,
    source: "osm",
    attribution: OSM_ATTRIBUTION,
    metresPerPx: proj.metresPerPx,
    start: places[0]?.id,
  };

  map = keepMainComponent(map);
  // Fares first: scale so a typical trip costs about what it costs in Ilorin.
  map = normaliseTrips(map, o.targetMeanTrip ?? TARGET_MEAN_TRIP);
  // Then push the tiles apart so none overlaps, and sit each one beside its road.
  const spread = spreadPlaces(map);
  map = spread.map;
  places = map.places;
  map = frame(map);

  return {
    map,
    missing,
    stats: { roadsIn: ways.length, roadsOut: map.roads.length, placesOut: map.places.length, movedMax: spread.movedMax },
  };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 28);

/**
 * Game ids for the civic places, the same ids the generated maps use, so actions
 * and the UI do not care which kind of map the player is on.
 */
export const CIVIC_ID: Partial<Record<PlaceKind, string>> = {
  inec: "inec", school: "pu", market: "market", buka: "buka", viewing: "viewing",
  kiosk: "kiosk", mosque: "mosque", church: "church", garage: "park", townhall: "hall",
};

const placeId = (c: { kind: PlaceKind; tags: Record<string, string> }, i: number) =>
  CIVIC_ID[c.kind] ?? `${slug(c.tags.name ?? c.kind)}-${i}`;

const KIND_NAMES: Partial<Record<PlaceKind, string>> = {
  inec: "INEC Office", school: "Polling Unit School", market: "Market", buka: "Local food spot",
  viewing: "Viewing Centre", kiosk: "News Stand", mosque: "Mosque", church: "Church",
  garage: "Motor Park", townhall: "Town Hall",
};
const kindName = (k: PlaceKind) => KIND_NAMES[k] ?? k;

const OPEN_HOURS: Partial<Record<PlaceKind, [number, number]>> = {
  inec: [8, 17], school: [0, 24], market: [6, 20], buka: [7, 22], viewing: [10, 23], kiosk: [6, 19],
  mosque: [0, 24], church: [0, 24], garage: [5, 22], townhall: [8, 20],
};
const openHours = (k: PlaceKind): [number, number] => OPEN_HOURS[k] ?? [7, 19];

/** The same words the generated maps use, so the two kinds of map read alike. */
const BLURBS: Partial<Record<PlaceKind, string>> = {
  inec: "INEC LGA office. Register, collect your PVC and ask questions.",
  school: "Your polling unit, in a primary school. This is where you vote.",
  market: "Foodstuff, radios, TVs and everything in between.",
  buka: "Local food, cold drinks and plenty gist.",
  viewing: "Big TV, plastic chairs, small fee. News and football for people without TV at home.",
  kiosk: "Newspapers on display. Plenty people read the front pages for free.",
  mosque: "The central mosque.",
  church: "A busy church with big Sunday services.",
  garage: "Buses, drivers and all the political gist you can handle.",
  townhall: "Voter education sessions and community debates.",
};

const blurbFor = (kind: PlaceKind, name: string, area: string) => BLURBS[kind] ?? `${name}, ${area}.`;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function bounds(ps: Point[], pad: number): Box {
  return {
    x0: Math.min(...ps.map((p) => p.x)) - pad,
    y0: Math.min(...ps.map((p) => p.y)) - pad,
    x1: Math.max(...ps.map((p) => p.x)) + pad,
    y1: Math.max(...ps.map((p) => p.y)) + pad,
  };
}

const inside = (p: Point, b: Box) => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;

/** Keeps the run of points inside the box, so a road leaving the area just stops. */
function clip(pts: Point[], b: Box): Point[] {
  const first = pts.findIndex((p) => inside(p, b));
  if (first < 0) return [];
  let last = first;
  for (let i = first; i < pts.length; i++) if (inside(pts[i], b)) last = i;
  return pts.slice(Math.max(0, first - 1), Math.min(pts.length, last + 2));
}

/**
 * Drops road pieces that do not join the main network, then drops any place left
 * with no road near it. Without this a trip could have no route.
 */
export function keepMainComponent(map: WorldMap): WorldMap {
  const graph = router(map).graph;
  const seen = new Int32Array(graph.verts.length).fill(-1);
  let groups = 0;
  const size: number[] = [];
  for (let s = 0; s < graph.verts.length; s++) {
    if (seen[s] >= 0) continue;
    const g = groups++;
    let n = 0;
    const stack = [s];
    seen[s] = g;
    while (stack.length) {
      const v = stack.pop()!;
      n++;
      for (const e of graph.verts[v].edges) {
        if (seen[e.to] < 0) {
          seen[e.to] = g;
          stack.push(e.to);
        }
      }
    }
    size.push(n);
  }
  if (groups <= 1) return map;
  const main = size.indexOf(Math.max(...size));
  const keep = new Set<number>();
  map.roads.forEach((r, ri) => {
    const on = r.pts.some((p) => {
      const v = graph.verts.find((x) => Math.hypot(x.x - p.x, x.y - p.y) < 9);
      return v ? seen[v.id] === main : false;
    });
    if (on) keep.add(ri);
  });
  const roads = map.roads.filter((_, i) => keep.has(i));
  const places = map.places.filter((p) => roads.some((r) => nearRoad(p, r) < 900));
  return { ...map, roads, places: places.length ? places : map.places };
}

const nearRoad = (p: Point, r: MapRoad) => {
  let best = Infinity;
  for (let i = 1; i < r.pts.length; i++) best = Math.min(best, projectOnSegment(p, r.pts[i - 1], r.pts[i]).d);
  return best;
};

/**
 * Pushes building tiles apart until none overlaps, pulling each back towards its
 * true spot, then sets it just off the road it belongs to, the way the Ilorin map
 * does. Roads keep their real shape; only the tiles move.
 */
export function spreadPlaces(map: WorldMap): { map: WorldMap; movedMax: number } {
  const nodes = map.places.map((p) => ({ id: p.id, x: p.x, y: p.y, ox: p.x, oy: p.y }));
  for (let it = 0; it < 400; it++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < MIN_PLACE_GAP) {
          const m = (MIN_PLACE_GAP - d) / 2;
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
  let movedMax = 0;
  const places = map.places.map((p, i) => {
    const n = nodes[i];
    // Sit beside the nearest road, not on it.
    let best: { d: number; p: Point } | null = null;
    for (const r of map.roads) {
      for (let k = 1; k < r.pts.length; k++) {
        const pr = projectOnSegment(n, r.pts[k - 1], r.pts[k]);
        if (!best || pr.d < best.d) best = { d: pr.d, p: pr.p };
      }
    }
    const at = best && best.d < ROAD_OFFSET ? { x: best.p.x, y: best.p.y - ROAD_OFFSET } : { x: n.x, y: n.y };
    movedMax = Math.max(movedMax, Math.hypot(at.x - p.x, at.y - p.y));
    return { ...p, x: Math.round(at.x), y: Math.round(at.y) };
  });
  return { map: { ...map, places }, movedMax: Math.round(movedMax) };
}

/** Shifts everything so the map starts at a margin, and sets width and height. */
export function frame(map: WorldMap, margin = 260): WorldMap {
  const all = [...map.places, ...map.roads.flatMap((r) => r.pts), ...(map.river ?? [])];
  const x0 = Math.min(...all.map((p) => p.x));
  const y0 = Math.min(...all.map((p) => p.y));
  const mv = (p: Point): Point => ({ x: Math.round((p.x - x0 + margin) * 10) / 10, y: Math.round((p.y - y0 + margin) * 10) / 10 });
  const places = map.places.map((p) => ({ ...p, ...mv(p) }));
  const roads = map.roads.map((r) => ({ ...r, pts: r.pts.map(mv) }));
  const all2 = [...places, ...roads.flatMap((r) => r.pts)];
  return {
    ...map,
    places,
    roads,
    ...(map.river ? { river: map.river.map(mv) } : {}),
    ...(map.junctions ? { junctions: map.junctions.map((j) => ({ ...j, ...mv(j) })) } : {}),
    width: Math.round(Math.max(...all2.map((p) => p.x)) + margin),
    height: Math.round(Math.max(...all2.map((p) => p.y)) + margin),
  };
}

/**
 * The real road line between two points, for the hand-built Ilorin map. Returns
 * the projected polyline of the shortest road route, which fitShape then turns
 * onto the map's own junction points.
 */
export function shapeBetween(res: OverpassResponse, a: LatLng, b: LatLng): [number, number][] | null {
  const ways = res.elements.filter((e) => e.type === "way" && e.tags?.highway && HIGHWAY_CLASS[e.tags.highway] && (e.geometry ?? []).length > 1);
  if (!ways.length) return null;
  const proj = projector(a, 100_000);
  const roads: MapRoad[] = ways.map((w) => ({
    name: w.tags!.name ?? "",
    cls: HIGHWAY_CLASS[w.tags!.highway],
    pts: ((w.geometry ?? []).filter(Boolean) as { lat: number; lon: number }[]).map((p) => proj({ lat: p.lat, lng: p.lon })),
  }));
  const pa = proj(a);
  const pb = proj(b);
  const map: WorldMap = {
    id: "shape", name: "shape", biome: "savanna", width: 0, height: 0, source: "osm",
    places: [
      { id: "a", name: "a", area: "", kind: "house", blurb: "", open: [0, 24], gen: false, x: pa.x, y: pa.y },
      { id: "b", name: "b", area: "", kind: "house", blurb: "", open: [0, 24], gen: false, x: pb.x, y: pb.y },
    ],
    roads,
  };
  const r = router(map);
  const line = r.route("a", "b").pts;
  if (line.length < 3) return null;
  // Drop the walk-out and walk-in points: the road itself is what we want.
  const road = simplify(line.slice(1, -1), 6);
  return road.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10] as [number, number]);
}
