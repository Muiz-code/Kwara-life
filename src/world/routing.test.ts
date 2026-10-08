import { describe, expect, it } from "vitest";
import { type Route } from "../sim/world";
import { generateMap } from "./generate";
import { STATES } from "../data/states";
import { meanTripLength, normaliseTrips, pointAlong, polylineLength, router, TARGET_MEAN_TRIP } from "./routing";
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
