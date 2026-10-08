import { describe, expect, it } from "vitest";
import { FloorPlan } from "./floorplan";

describe("finding the way across a room", () => {
  // A 10 by 10 room with a wall down the middle, open only at one end (a doorway).
  const plan = new FloorPlan(10, 10, 0.2);
  plan.markBox(-0.1, -5, 0.1, 3);

  it("walks round a wall through the doorway, never through the wall", () => {
    const path = plan.path({ x: -3, z: -3 }, { x: 3, z: -3 });
    expect(path.length).toBeGreaterThan(1);
    expect(path.some((p) => p.z > 3)).toBe(true);
    let prev = { x: -3, z: -3 };
    for (const p of path) {
      expect(plan.clear(prev, p)).toBe(true);
      prev = p;
    }
    expect(path[path.length - 1]).toEqual({ x: 3, z: -3 });
  });

  it("stops at the nearest free spot when asked to stand inside furniture", () => {
    const near = plan.nearestFree(0, 0)!;
    expect(plan.free(near.x, near.z)).toBe(true);
    expect(Math.abs(near.x)).toBeLessThan(0.5);
  });
});
