import { describe, expect, it } from "vitest";
import { PLACES } from "../data/ilorin/places";
import { ROADS } from "../data/ilorin/roads";
import { nodePos, placePos, route as simRoute, type Route } from "../sim/world";
import { ilorinMap, shapeKey } from "./ilorin-map";
import { generateMap } from "./generate";
import { STATES } from "../data/states";
import { meanTripLength, normaliseTrips, pointAlong, polylineLength, router, TARGET_MEAN_TRIP } from "./routing";
import { fitShape, simplify } from "./shape";
import type { MapPlace, WorldMap } from "./types";

const place = (id: string, x: number, y: number): MapPlace => ({
  id, name: id, area: "Test", kind: "house", blurb: "", open: [0, 24], gen: false, x, y,
});

/** Two roads meeting in a T, with a place beside each end. */
const testMap: WorldMap = {
  id: "test/t", name: "T", biome: "savanna", width: 1000, height: 1000, source: "generated",
  places: [place("a", 100, 60), place("b", 900, 60), place("c", 500, 900)],
  roads: [
    { name: "Top Road", pts: [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 900, y: 100 }] },
    { name: "Down Road", pts: [{ x: 500, y: 100 }, { x: 500, y: 500 }, { x: 500, y: 940 }] },
  ],
};

describe("routing on road shapes", () => {
  const r = router(testMap);

  it("snaps each place to the nearest point on a road", () => {
    expect(r.gate("a")).toEqual({ x: 100, y: 100 });
    expect(r.gate("b")).toEqual({ x: 900, y: 100 });
    expect(r.gate("c")).toEqual({ x: 500, y: 900 });
  });

  it("joins roads that meet and routes through the junction", () => {
    const ac = r.route("a", "c");
    // Down the top road to the junction, then down the other road.
    expect(ac.pts).toEqual([
      { x: 100, y: 60 }, { x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 500 }, { x: 500, y: 900 }, { x: 500, y: 900 },
    ]);
    expect(ac.length).toBeCloseTo(40 + 400 + 800, 6);
    expect(ac.roads.map((x) => x.name)).toEqual(["Top Road", "Down Road"]);
  });

  it("hands back the same shape of route the travel code expects", () => {
    // sim/travel reads route.length, route.pts and route.highway, so a map route
    // must fit the sim's Route without any adapter.
    const asSimRoute: Route = r.route("a", "b");
    expect(asSimRoute.length).toBeGreaterThan(0);
    expect(asSimRoute.pts.length).toBeGreaterThan(1);
    expect(asSimRoute.highway).toBe(false);
  });

  it("measures the real road length, not the straight line", () => {
    const bent: WorldMap = {
      ...testMap,
      places: [place("a", 0, 0), place("b", 400, 0)],
      roads: [{ name: "Bendy", pts: [{ x: 0, y: 0 }, { x: 200, y: 300 }, { x: 400, y: 0 }] }],
    };
    const got = router(bent).route("a", "b");
    expect(got.length).toBeGreaterThan(400);
    expect(got.length).toBeCloseTo(2 * Math.hypot(200, 300), 6);
  });

  it("reports a highway when the route uses one", () => {
    const hw: WorldMap = {
      ...testMap,
      roads: [{ ...testMap.roads[0] }, { ...testMap.roads[1], highway: true }],
    };
    const g = router(hw);
    expect(g.route("a", "b").highway).toBe(false);
    expect(g.route("a", "c").highway).toBe(true);
  });

  it("walks a fraction along a line", () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    expect(polylineLength(pts)).toBe(200);
    const mid = pointAlong(pts, 0.5);
    expect([mid.x, mid.y]).toEqual([100, 0]);
    expect(pointAlong(pts, 1)).toMatchObject({ x: 100, y: 100 });
  });
});

describe("the Ilorin map as a WorldMap", () => {
  const map = ilorinMap();

  it("keeps every place where the hand-built layout put it", () => {
    expect(map.places.map((p) => p.id)).toEqual(PLACES.map((p) => p.id));
    for (const p of map.places) expect({ x: p.x, y: p.y }).toEqual(placePos(p.id));
    expect(map.places.every((p) => p.art)).toBe(true);
    expect(map.start).toBe("home");
  });

  it("keeps every road between the same two junctions", () => {
    expect(map.roads.length).toBe(ROADS.length);
    map.roads.forEach((r, i) => {
      expect(r.pts[0]).toEqual(nodePos(ROADS[i].a));
      expect(r.pts[r.pts.length - 1]).toEqual(nodePos(ROADS[i].b));
      expect(r.name).toBe(ROADS[i].name);
    });
  });

  it("routes the same trips as the hand-built router, within a few per cent", () => {
    const r = router(map);
    for (const [a, b] of [["home", "unilorin"], ["po", "kwasu"], ["home", "airport"], ["palace", "sawmill"]]) {
      const mine = r.route(a, b).length;
      const want = simRoute(a, b).length;
      expect(Math.abs(mine - want) / want).toBeLessThan(0.06);
    }
    expect(Math.abs(meanTripLength(map) - TARGET_MEAN_TRIP) / TARGET_MEAN_TRIP).toBeLessThan(0.05);
  });

  it("draws the real road line when shapes are fetched", () => {
    const a = nodePos("po");
    const b = nodePos("palace");
    // A road that bends gently to one side, in the fetch script's own pixels.
    const raw: [number, number][] = [[0, 0], [40, 22], [80, 22], [120, 0]];
    const withShapes = ilorinMap({ [shapeKey("po", "palace")]: raw });
    const road = withShapes.roads.find((r) => r.name === "Ibrahim Taiwo Rd")!;
    expect(road.pts.length).toBe(4);
    expect(road.pts[0]).toEqual(a);
    expect(road.pts[3]).toEqual(b);
    expect(polylineLength(road.pts)).toBeGreaterThan(Math.hypot(b.x - a.x, b.y - a.y));
    expect(withShapes.source).toBe("osm");
    expect(withShapes.attribution).toContain("OpenStreetMap");
  });

  it("keeps the straight line when the fetched shape wanders off", () => {
    // A route that went round the long way is the wrong road, not a bend.
    const wild: [number, number][] = [[0, 0], [60, 400], [140, 420], [200, 0]];
    const map2 = ilorinMap({ [shapeKey("po", "palace")]: wild });
    const road = map2.roads.find((r) => r.name === "Ibrahim Taiwo Rd")!;
    expect(road.pts).toEqual([nodePos("po"), nodePos("palace")]);
  });
});

describe("fitting and simplifying shapes", () => {
  it("turns and scales a shape onto its two ends", () => {
    const raw: [number, number][] = [[0, 0], [5, 5], [10, 0]];
    const out = fitShape(raw, { x: 100, y: 100 }, { x: 100, y: 300 });
    expect(out[0]).toEqual({ x: 100, y: 100 });
    expect(out[2]).toEqual({ x: 100, y: 300 });
    // The bend keeps its size relative to the road.
    expect(out[1]).toEqual({ x: 0, y: 200 });
  });

  it("drops points that add nothing", () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 0.2 }, { x: 20, y: 0 }, { x: 30, y: 9 }];
    expect(simplify(line, 1).length).toBe(3);
    expect(simplify(line, 20).length).toBe(2);
  });
});

describe("fares across maps", () => {
  it("scales a generated map to Ilorin's typical trip", () => {
    const kano = STATES.find((s) => s.code === "kano")!;
    const raw = generateMap({ state: kano, lga: kano.lgas[0], pu: 0, cls: "poor", job: "Tailor", home: "a room" });
    const fixed = normaliseTrips(raw);
    expect(Math.abs(meanTripLength(fixed) - TARGET_MEAN_TRIP) / TARGET_MEAN_TRIP).toBeLessThan(0.02);
    // Shape is kept: the same places, in the same order, the same distance apart relative to each other.
    expect(fixed.places.map((p) => p.id)).toEqual(raw.places.map((p) => p.id));
    const k = fixed.width / raw.width;
    expect(fixed.places[3].x / raw.places[3].x).toBeCloseTo(k, 2);
  });
});
