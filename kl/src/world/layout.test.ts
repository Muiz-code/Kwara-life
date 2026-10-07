import { describe, expect, it } from "vitest";
import { ilorinTown } from "./ilorin-town";
import { billboardPositions, hitTest, standAt } from "./layout";

describe("map layout", () => {
  const map = ilorinTown();
  const boards = billboardPositions(map);

  it("hits the tile you tap, and nothing out in the bush", () => {
    const mall = map.places.find((p) => p.id === "mall")!;
    expect(hitTest(map, { x: mall.x, y: mall.y - 40 }, {}, boards, 120)).toEqual({ kind: "place", id: "mall" });
    expect(hitTest(map, { x: -5000, y: -5000 }, {}, boards, 120)).toBeNull();
  });

  it("stands the player on the pavement outside each place", () => {
    for (const p of map.places) {
      const s = standAt(map, p.id);
      expect(Math.hypot(s.x - p.x, s.y - p.y)).toBeGreaterThan(20);
    }
  });
});
