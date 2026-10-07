import { describe, expect, it } from "vitest";
import { AD_SLOTS } from "../data/ilorin/billboards";
import { PLACES } from "../data/ilorin/places";
import { placePos, standPos } from "../sim/world";
import { billboardPositions, hitTest, roadDistance } from "./layout";

describe("map layout", () => {
  const boards = billboardPositions();

  it("places every billboard near a road and clear of buildings", () => {
    expect(Object.keys(boards)).toEqual(AD_SLOTS.map((s) => s.id));
    for (const p of Object.values(boards)) {
      expect(roadDistance({ x: p.x, y: p.y - 10 })).toBeLessThan(130);
      for (const pl of PLACES) {
        expect(Math.hypot(placePos(pl.id).x - p.x, placePos(pl.id).y - p.y)).toBeGreaterThanOrEqual(140);
        expect(Math.hypot(standPos(pl.id).x - p.x, standPos(pl.id).y - p.y)).toBeGreaterThanOrEqual(120);
      }
    }
  });

  it("hits the tile you tap", () => {
    const c = placePos("mall");
    expect(hitTest({ x: c.x, y: c.y - 40 }, {}, boards, 120)).toEqual({ kind: "place", id: "mall" });
    const b = boards["airport-road"];
    expect(hitTest({ x: b.x, y: b.y - 60 }, {}, boards, 120)).toEqual({ kind: "billboard", id: "airport-road" });
    expect(hitTest({ x: -5000, y: -5000 }, {}, boards, 120)).toBeNull();
  });
});
