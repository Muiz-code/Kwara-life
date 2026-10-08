// Map pixels (the isometric WorldMap) to 3D ground and back. One grid cell is CELL units square:
// cell (u, v) is centred at x = u * CELL, z = v * CELL, with y up. Seen from the default camera
// (above +x, +z) the town looks as it does on the 2D map: +u runs down and right, +v down and left.
import type { Facing, Point, TownGrid } from "../world/types";

/** One grid cell, in 3D units (about ten metres). */
export const CELL = 10;
/** Plots are raised this far above the road, so every building sits on its own piece of land. */
export const PLOT_H = 0.35;

export interface Ground {
  x: number;
  z: number;
}

/** A map pixel's spot on the 3D ground. */
export function toWorld(g: TownGrid, p: Point): Ground {
  const a = (p.x - g.ox) / g.hw;
  const b = (p.y - g.oy) / g.hh;
  return { x: ((a + b) / 2) * CELL, z: ((b - a) / 2) * CELL };
}

/** The map pixel under a spot on the 3D ground. */
export function toMap(g: TownGrid, x: number, z: number): Point {
  const u = x / CELL;
  const v = z / CELL;
  return { x: g.ox + (u - v) * g.hw, y: g.oy + (u + v) * g.hh };
}

/** The grid cell a spot on the ground is in. */
export const cellOf = (x: number, z: number) => ({ u: Math.round(x / CELL), v: Math.round(z / CELL) });

/**
 * Turn that points a building's front (built facing +z) at its street: +u is +x, +v is +z.
 * A turn of a about y sends +z to (sin a, cos a).
 */
export const FACE_TURN: Record<Facing, number> = { 0: Math.PI / 2, 1: 0, 2: -Math.PI / 2, 3: Math.PI };

/** Small, fast seeded random numbers in [0, 1). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable seed for a spot, so the same plot always gets the same house. */
export const seedAt = (x: number, z: number, salt = 0) => (Math.round(x * 7919) ^ Math.round(z * 104729) ^ (salt * 2654435761)) >>> 0;
