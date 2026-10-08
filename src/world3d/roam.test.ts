import { describe, expect, it } from "vitest";
import { ilorinTown } from "../world/ilorin-town";
import { CELL, toWorld } from "./coords";
import { groundOf, step } from "./roam";

describe("walking round a 3D town", () => {
  const map = ilorinTown();
  const g = map.grid!;
  const ground = groundOf(map);

  it("blocks ordinary buildings and lets you walk the road outside them", () => {
    const b = toWorld(g, map.buildings![0]);
    expect(ground(b.x, b.z).kind).toBe("blocked");
    // The pavement strip at the plot's edge is free.
    expect(ground(b.x + CELL / 2 - 0.3, b.z).kind).toBe("free");
  });

  it("walks you into a place when you step onto its plot", () => {
    const p = map.places.find((q) => q.id === "taiwo")!;
    const w = toWorld(g, p);
    const from = { x: w.x + CELL / 2 - 0.2, z: w.z };
    const r = step(ground, from.x, from.z, -1, 0);
    expect(r.place).toBe("taiwo");
    expect(r.x).toBe(from.x);
  });

  it("slides along a wall instead of sticking to it", () => {
    const b = toWorld(g, map.buildings![0]);
    const from = { x: b.x + CELL / 2 - 0.4, z: b.z };
    const r = step(ground, from.x, from.z, -0.6, 0.3);
    expect(r.x).toBe(from.x);
    expect(r.z).toBeCloseTo(from.z + 0.3);
  });
});
