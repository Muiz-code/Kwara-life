// Where you can walk in a 3D town. Roads, pavements, open ground and parks are free; buildings and
// water are not; stepping onto the plot of a place you can visit means you have arrived there.
import { cellAt } from "../world/town";
import type { WorldMap } from "../world/types";
import { CELL, toWorld } from "./coords";

export type Spot = { kind: "free" } | { kind: "blocked" } | { kind: "place"; id: string };

/** How far from a plot's centre its building reaches; the strip outside it is the pavement. */
export const BUILT = CELL / 2 - 0.9;

const FREE: Spot = { kind: "free" };
const BLOCKED: Spot = { kind: "blocked" };

/** A lookup from a spot on the ground to what is there. */
export function groundOf(map: WorldMap): (x: number, z: number) => Spot {
  const g = map.grid;
  if (!g) return () => FREE;
  const built = new Map<string, Spot>();
  const key = (u: number, v: number) => `${u},${v}`;
  for (const b of map.buildings ?? []) {
    const w = toWorld(g, b);
    built.set(key(Math.round(w.x / CELL), Math.round(w.z / CELL)), BLOCKED);
  }
  for (const p of map.places) {
    const w = toWorld(g, p);
    built.set(key(Math.round(w.x / CELL), Math.round(w.z / CELL)), { kind: "place", id: p.id });
  }
  return (x, z) => {
    const u = Math.round(x / CELL);
    const v = Math.round(z / CELL);
    const c = cellAt(g, u, v);
    if (c === "w") return BLOCKED;
    const b = built.get(key(u, v));
    if (!b) return FREE;
    const inside = Math.abs(x - u * CELL) < BUILT && Math.abs(z - v * CELL) < BUILT;
    return inside ? b : FREE;
  };
}

/**
 * One step of movement: slide along walls rather than stopping dead, so you can walk along a row of
 * houses by pushing into it at an angle. Returns where you end up and the place you walked into, if any.
 */
export function step(ground: (x: number, z: number) => Spot, x: number, z: number, dx: number, dz: number): { x: number; z: number; place: string | null } {
  const at = ground(x + dx, z + dz);
  if (at.kind === "free") return { x: x + dx, z: z + dz, place: null };
  if (at.kind === "place") return { x, z, place: at.id };
  if (ground(x + dx, z).kind === "free") return { x: x + dx, z, place: null };
  if (ground(x, z + dz).kind === "free") return { x, z: z + dz, place: null };
  return { x, z, place: null };
}
