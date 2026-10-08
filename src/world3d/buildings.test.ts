import { describe, expect, it } from "vitest";
import { BIOMES, type BiomeId } from "../data/biomes";
import { PLACE_KINDS } from "../world/types";
import { FOOTPRINT, build } from "./buildings";
import { CELL, rng, toMap, toWorld } from "./coords";
import { Kit } from "./kit";

const KINDS = ["house", "duplex", "flats", "compound", "shacks", "office", "school", "market", "buka", "restaurant", ...PLACE_KINDS];
/** The flyover is a road over the street, so it runs right across its plot by design. */
const SPANS = new Set(["flyover"]);
/** Rocks sit half buried in the ground. */
const BURIED = new Set(["lm-hills", "lm-rock"]);

describe("3D buildings", () => {
  it("keep every building of every kind inside its own plot", () => {
    for (const kind of KINDS) {
      for (let seed = 1; seed <= 30; seed++) {
        const kit = new Kit();
        for (const biome of Object.keys(BIOMES) as BiomeId[]) {
          build(kind, { kit, biome, district: seed % 3 ? "mixed" : "rich", rnd: rng(seed) });
        }
        const g = kit.merge();
        if (!g) continue;
        g.computeBoundingBox();
        const b = g.boundingBox!;
        const reach = Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z);
        if (!SPANS.has(kind)) expect(reach, `${kind} seed ${seed}`).toBeLessThanOrEqual(FOOTPRINT);
        if (!BURIED.has(kind)) expect(b.min.y, `${kind} sits on the ground`).toBeGreaterThanOrEqual(-0.01);
        g.dispose();
      }
    }
  }, 120_000);

  it("gives two neighbours of the same kind different shapes", () => {
    const size = (seed: number) => {
      const kit = new Kit();
      build("house", { kit, biome: "forest", district: "mixed", rnd: rng(seed) });
      const g = kit.merge()!;
      g.computeBoundingBox();
      return g.boundingBox!.max.x - g.boundingBox!.min.x;
    };
    expect(new Set([1, 2, 3, 4, 5].map((s) => size(s).toFixed(2))).size).toBeGreaterThan(3);
  });
});

describe("3D ground coordinates", () => {
  it("puts every grid cell centre on a whole number of cells, and maps back", () => {
    const g = { hw: 120, hh: 60, ox: 900, oy: 140, u0: -2, v0: -1, cols: 10, rows: 10, cells: "" };
    for (const [u, v] of [[0, 0], [3, 5], [-2, 7]]) {
      const p = { x: g.ox + (u - v) * g.hw, y: g.oy + (u + v) * g.hh };
      const w = toWorld(g, p);
      expect(w.x).toBeCloseTo(u * CELL);
      expect(w.z).toBeCloseTo(v * CELL);
      const back = toMap(g, w.x, w.z);
      expect(back.x).toBeCloseTo(p.x);
      expect(back.y).toBeCloseTo(p.y);
    }
  });
});
