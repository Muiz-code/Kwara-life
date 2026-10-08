import { describe, expect, it } from "vitest";
import { Graphics } from "pixi.js";
import { BIOMES } from "../data/biomes";
import { PLACE_KINDS } from "./types";
import { drawTile, KIND_ART, MISSING_ART } from "./tiles";

describe("placeholder tiles", () => {
  it("covers every place kind with art or a placeholder", () => {
    for (const kind of PLACE_KINDS) {
      expect(KIND_ART[kind] !== undefined || MISSING_ART.includes(kind)).toBe(true);
    }
    for (const kind of MISSING_ART) expect(KIND_ART[kind]).toBeUndefined();
  });

  it("draws every kind standing on the place point", () => {
    for (const biome of Object.values(BIOMES)) {
      for (const kind of PLACE_KINDS) {
        const g = new Graphics();
        const drawn = drawTile(g, kind, biome);
        expect(drawn.top).toBeLessThan(0);
        for (const w of drawn.glow) expect(w.y).toBeLessThan(0);
      }
    }
  });

  it("draws the three house classes", () => {
    for (const variant of ["poor", "mid", "middle", "rich"]) {
      const drawn = drawTile(new Graphics(), "house", BIOMES.savanna, { variant });
      expect(drawn.top).toBeLessThan(0);
      expect(drawn.glow.length).toBeGreaterThan(0);
      for (const w of drawn.glow) expect(w.y).toBeLessThan(0);
    }
  });
});
