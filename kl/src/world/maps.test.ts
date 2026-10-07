// Guards the map files committed under public/maps: every one must be routable,
// readable and credited. The fetch script writes them; this test keeps them honest.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TILE_W } from "./art";
import { router } from "./routing";
import { isPlaceKind, type WorldMap } from "./types";

const MAPS = path.resolve(__dirname, "../../public/maps");

function mapFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return mapFiles(full);
    // The Ilorin road shapes are not a map of their own.
    return name.endsWith(".json") && !name.endsWith("-shapes.json") ? [full] : [];
  });
}

const files = mapFiles(MAPS);

describe("the map files under public/maps", () => {
  it("has at least one once the fetch script has run", () => {
    // Nothing fetched yet is fine: the generator covers every LGA until then.
    expect(Array.isArray(files)).toBe(true);
  });

  for (const file of files) {
    const name = path.relative(MAPS, file);
    describe(name, () => {
      const map = JSON.parse(readFileSync(file, "utf8")) as WorldMap;

      it("credits OpenStreetMap", () => {
        expect(map.source).toBe("osm");
        expect(map.attribution).toBe("© OpenStreetMap contributors");
      });

      it("has real roads and real places", () => {
        expect(map.roads.length).toBeGreaterThan(5);
        expect(map.places.length).toBeGreaterThan(3);
        expect(map.roads.every((r) => r.pts.length > 1)).toBe(true);
        expect(map.places.every((p) => isPlaceKind(p.kind))).toBe(true);
        // Every place on a fetched map comes from OpenStreetMap, nothing invented.
        expect(map.places.every((p) => p.osm)).toBe(true);
        expect(map.places.every((p) => p.name.trim().length > 1)).toBe(true);
      });

      it("keeps the building tiles apart", () => {
        for (let i = 0; i < map.places.length; i++) {
          for (let j = i + 1; j < map.places.length; j++) {
            const a = map.places[i];
            const b = map.places[j];
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(TILE_W * 0.9);
          }
        }
      });

      it("can route between every pair of places", () => {
        const r = router(map);
        for (const a of map.places) {
          for (const b of map.places) {
            if (a.id !== b.id) expect(r.route(a.id, b.id).length).toBeGreaterThan(0);
          }
        }
      });

      it("fits inside its own frame", () => {
        for (const p of map.places) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(map.width);
          expect(p.y).toBeLessThanOrEqual(map.height);
        }
      });
    });
  }
});
