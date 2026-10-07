// Checks the Overpass conversion against a small saved fixture. The fixture is a
// hand-written test town, not real OpenStreetMap data.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classify, osmToWorldMap, shapeBetween, type OverpassResponse } from "./osm";
import { meanTripLength, router, TARGET_MEAN_TRIP } from "./routing";
import { TILE_W } from "./art";

const fixture = JSON.parse(readFileSync(path.resolve(__dirname, "__fixtures__/overpass-testville.json"), "utf8")) as OverpassResponse;

const convert = () => osmToWorldMap(fixture, { id: "test/testville", name: "Testville", biome: "savanna" });

describe("reading OpenStreetMap", () => {
  it("knows which game place a feature can serve as", () => {
    expect(classify({ amenity: "place_of_worship", religion: "muslim" })).toBe("mosque");
    expect(classify({ amenity: "marketplace" })).toBe("market");
    expect(classify({ name: "INEC Office, Ilorin", amenity: "townhall" })).toBe("inec");
    expect(classify({ highway: "primary" })).toBeNull();
  });

  it("builds a map with real roads and real places", () => {
    const { map, missing, stats } = convert();
    expect(map.source).toBe("osm");
    expect(map.attribution).toBe("© OpenStreetMap contributors");
    expect(stats.roadsOut).toBeGreaterThan(3);
    expect(map.places.length).toBeGreaterThan(8);
    expect(map.places.map((p) => p.kind)).toContain("mosque");
    expect(map.places.map((p) => p.kind)).toContain("market");
    expect(missing).toEqual([]);
    // Every place came from OpenStreetMap, nothing invented.
    expect(map.places.every((p) => p.osm)).toBe(true);
    // Roads keep their bends.
    expect(map.roads.some((r) => r.pts.length > 2)).toBe(true);
    expect(map.roads.some((r) => r.highway)).toBe(true);
  });

  it("drops road pieces that join nothing", () => {
    const { map } = convert();
    expect(map.roads.map((r) => r.name)).not.toContain("Lonely Track");
  });

  it("keeps the building tiles from overlapping", () => {
    const { map } = convert();
    for (let i = 0; i < map.places.length; i++) {
      for (let j = i + 1; j < map.places.length; j++) {
        const a = map.places[i];
        const b = map.places[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(TILE_W * 0.95);
      }
    }
  });

  it("can route between every pair of places", () => {
    const { map } = convert();
    const r = router(map);
    for (const a of map.places) {
      for (const b of map.places) {
        if (a.id === b.id) continue;
        expect(r.route(a.id, b.id).length).toBeGreaterThan(0);
      }
    }
  });

  it("scales so a typical trip costs about what it costs in Ilorin", () => {
    const { map } = convert();
    expect(Math.abs(meanTripLength(map) - TARGET_MEAN_TRIP) / TARGET_MEAN_TRIP).toBeLessThan(0.3);
  });

  it("sits inside its own frame", () => {
    const { map } = convert();
    for (const p of [...map.places, ...map.roads.flatMap((r) => r.pts)]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(map.width);
      expect(p.y).toBeLessThanOrEqual(map.height);
    }
  });

  it("pulls the real road line between two points, for the Ilorin shapes", () => {
    const line = shapeBetween(fixture, { lat: 9.1, lng: 7.35 }, { lat: 9.122, lng: 7.392 });
    expect(line).not.toBeNull();
    expect(line!.length).toBeGreaterThan(2);
  });
});
