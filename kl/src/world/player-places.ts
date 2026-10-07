// The three places the game needs that OpenStreetMap does not hold: the player's
// own home, the player's own workplace, and the LGA notice board.
//
// Nothing here invents a landmark or a civic place. Home and work are the
// citizen's own, put on a real street from the OSM data (home on a residential
// street away from the centre, work on a bigger road nearer the centre), and the
// notice board stands at the town hall, the market or the motor park, whichever
// the LGA actually has.
import { lcg, hash, type CitizenClass } from "./generate";
import { frame, ROAD_OFFSET, spreadPlaces } from "./osm";
import { polylineLength, projectOnSegment } from "./routing";
import type { MapPlace, MapRoad, PlaceKind, Point, WorldMap } from "./types";

export interface PlayerPlacesOptions {
  /** Seed, so the same citizen always gets the same home. */
  seed: string;
  cls: CitizenClass;
  job: string;
  /** What the citizen's home is called in the roll, for the blurb. */
  home?: string;
  under?: boolean;
  wasUnder?: boolean;
}

const WORK: Record<CitizenClass, [string, PlaceKind]> = {
  poor: ["Workshop", "workshop"],
  middle: ["Office", "office"],
  rich: ["Company HQ", "tower"],
};

/** A point a fraction along a road, lifted off the tarmac like every other tile. */
function beside(road: MapRoad, f: number): Point {
  let target = polylineLength(road.pts) * f;
  for (let i = 1; i < road.pts.length; i++) {
    const a = road.pts[i - 1];
    const b = road.pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (target <= seg) {
      const k = seg ? target / seg : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - ROAD_OFFSET };
    }
    target -= seg;
  }
  const last = road.pts[road.pts.length - 1];
  return { x: last.x, y: last.y - ROAD_OFFSET };
}

const centreOf = (map: WorldMap): Point => {
  const ps = map.places.length ? map.places : map.roads.map((r) => r.pts[0]);
  return { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length };
};

const distTo = (p: Point, c: Point) => Math.hypot(p.x - c.x, p.y - c.y);

/** Adds home, work and the notice board to a map built from OpenStreetMap. */
export function addPlayerPlaces(map: WorldMap, o: PlayerPlacesOptions): WorldMap {
  const rng = lcg(hash(o.seed));
  const centre = centreOf(map);
  const places: MapPlace[] = [...map.places];
  const has = (id: string) => places.some((p) => p.id === id);

  /**
   * A street to build on. Home goes to the quieter streets a walk away from the
   * centre, work to a bigger road nearer it. Never the very furthest street, or
   * the citizen would live in the bush.
   */
  const pickRoad = (want: (r: MapRoad) => boolean, away: boolean): MapRoad => {
    const list = map.roads.filter(want);
    const from = (list.length ? list : map.roads).slice();
    from.sort((a, b) => distTo(beside(a, 0.5), centre) - distTo(beside(b, 0.5), centre));
    // Home: somewhere in the middle of the spread. Work: close in.
    const base = away ? Math.floor(from.length * 0.45) : 0;
    const i = base + Math.floor(rng() * Math.min(3, from.length - base));
    return from[Math.min(from.length - 1, i)];
  };

  if (!has("home")) {
    const road = pickRoad((r) => r.cls === "residential", true);
    const at = beside(road, 0.25 + rng() * 0.5);
    places.push({
      id: "home",
      name: o.under ? "Flyover" : "Home",
      area: road.name || map.name,
      kind: o.under ? "flyover" : "house",
      blurb: `Where you live: ${o.under ? "under a flyover near the motor park" : (o.home ?? "")}${road.name ? `, off ${road.name}` : ""}.`,
      open: [0, 24],
      gen: o.cls === "rich",
      ...at,
    });
  }

  if (!has("work")) {
    const work = WORK[o.cls];
    const road = pickRoad((r) => r.cls === "primary" || r.cls === "secondary", false);
    const at = beside(road, 0.3 + rng() * 0.4);
    places.push({
      id: "work",
      name: work[0],
      area: road.name || map.name,
      kind: work[1],
      blurb: `Where you work as a ${o.job.toLowerCase()}.`,
      open: [7, 20],
      gen: o.cls !== "poor",
      ...at,
    });
  }

  if (!has("board")) {
    const host = places.find((p) => ["hall", "market", "park", "inec"].includes(p.id)) ?? places[0];
    places.push({
      id: "board",
      name: "Notice Board",
      area: host ? host.name : map.name,
      kind: "board",
      blurb: "Flyers and announcements. Campaign flyers posted in this LGA show here.",
      open: [0, 24],
      gen: false,
      x: host.x + 150,
      y: host.y + 40,
    });
  }

  if ((o.under || o.wasUnder) && !has("shelter")) {
    const host = places.find((p) => p.id === "church") ?? places[0];
    places.push({
      id: "shelter",
      name: "Shelter",
      area: host.name,
      kind: "shelter",
      blurb: "A church-run shelter that sometimes has beds.",
      open: [0, 24],
      gen: false,
      x: host.x - 170,
      y: host.y + 40,
    });
  }

  const spread = spreadPlaces({ ...map, places, start: "home" });
  return frame(spread.map);
}

/** Where a place's road gate is, used when a map is drawn without routing. */
export const gateOf = (map: WorldMap, p: Point): Point => {
  let best: { d: number; p: Point } | null = null;
  for (const r of map.roads) {
    for (let i = 1; i < r.pts.length; i++) {
      const pr = projectOnSegment(p, r.pts[i - 1], r.pts[i]);
      if (!best || pr.d < best.d) best = { d: pr.d, p: pr.p };
    }
  }
  return best ? best.p : p;
};
