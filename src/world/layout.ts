// Pure placement helpers for any LGA map: where billboards stand and what a tap hits.
import { roadFinder, segmentDistance } from "./routing";
import { BILLBOARD_W, TILE_BASE, TILE_W } from "./art";
import type { BillboardSlot, Point, WorldMap } from "./types";

export { segmentDistance };

/** Distance from a point to the nearest road. */
export function roadDistance(map: WorldMap, p: Point): number {
  return roadFinder(map).distance(p);
}

/** Where the player stands when at a place: beside the building, facing the road. */
export function standAt(map: WorldMap, id: string): Point {
  const p = map.places.find((q) => q.id === id);
  if (!p) return { x: 0, y: 0 };
  if (p.stand) return p.stand;
  return { x: p.x + 38, y: p.y + 70 };
}

/** Clear of building tiles and roads, with room for a board of the given width. */
function isFree(map: WorldMap, p: Point, taken: Point[], roads: ReturnType<typeof roadFinder>): boolean {
  if (map.places.some((pl) => Math.hypot(pl.x - p.x, pl.y - p.y) < 140)) return false;
  // Keep clear of the spot where the player stands outside each place.
  if (map.places.some((pl) => {
    const s = standAt(map, pl.id);
    return Math.hypot(s.x - p.x, s.y - p.y) < 120;
  })) return false;
  if (taken.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < BILLBOARD_W)) return false;
  const d = roads.distance({ x: p.x, y: p.y - 10 });
  return d > 30 && d < 130;
}

/**
 * Where each billboard stands (the bottom centre of its tile). Starts from the
 * slot's preferred side of its place and walks round until it finds open ground
 * close to a road, so boards face traffic without covering buildings.
 */
export function billboardPositions(map: WorldMap): Record<string, Point> {
  // In a town a board needs a plot of its own, like any building: an empty plot
  // on a street, near the place it advertises beside.
  if (map.lots) return boardsOnPlots(map);
  const out: Record<string, Point> = {};
  const taken: Point[] = [];
  const roads = roadFinder(map);
  for (const slot of map.billboards ?? defaultSlots(map)) {
    const c = anchorOf(map, slot.near);
    if (!c) continue;
    const start = Math.atan2(slot.dy, slot.dx);
    let found: Point | null = null;
    for (let r = 150; r <= 420 && !found; r += 15) {
      for (let i = 0; i < 24 && !found; i++) {
        const ang = start + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 12);
        const p = { x: Math.round(c.x + Math.cos(ang) * r), y: Math.round(c.y + Math.sin(ang) * r * 0.75) };
        if (isFree(map, p, taken, roads)) found = p;
      }
    }
    // A tight map may have no clear ground. Skip the board rather than cover a building.
    if (!found) continue;
    out[slot.id] = found;
    taken.push(found);
  }
  return out;
}

function boardsOnPlots(map: WorldMap): Record<string, Point> {
  const out: Record<string, Point> = {};
  const free = (map.lots ?? []).filter((l) => l.use === "garden" && l.gates.length > 0 && l.district !== "out");
  const used = new Set<number>();
  for (const slot of map.billboards ?? defaultSlots(map)) {
    const c = anchorOf(map, slot.near);
    if (!c) continue;
    let best = -1;
    let bestD = 900;
    free.forEach((l, i) => {
      if (used.has(i)) return;
      const d = Math.hypot(l.x - c.x, l.y - c.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    // Nothing free nearby: no board, rather than one on somebody's plot.
    if (best < 0) continue;
    used.add(best);
    // Stand at the back of the plot so the board faces the street in front.
    out[slot.id] = { x: free[best].x, y: free[best].y + (map.grid?.hh ?? 60) * 0.35 };
  }
  return out;
}

/**
 * Ad slots for a map that does not list its own: one beside each of the places
 * with the most passing traffic.
 */
export function defaultSlots(map: WorldMap): BillboardSlot[] {
  const busy = ["market", "park", "pu", "inec", "buka", "viewing"];
  return map.places
    .filter((p) => busy.includes(p.id))
    .slice(0, 6)
    .map((p, i) => ({ id: `${p.id}-board`, near: p.id, dx: i % 2 ? 150 : -150, dy: i % 3 ? 60 : -40 }));
}

/** A board can stand beside a place or beside a named roundabout. */
function anchorOf(map: WorldMap, id: string): Point | null {
  const p = map.places.find((q) => q.id === id);
  if (p) return { x: p.x, y: p.y };
  const j = map.junctions?.find((q) => q.name.toLowerCase().startsWith(id));
  return j ? { x: j.x, y: j.y } : null;
}

/**
 * In the tile pictures, the left and right corners of the ground slab sit this far above the picture's
 * bottom, as a share of its width (measured on the Higgsfield tiles).
 */
export const SLAB_CORNER = 0.355;

/** How wide a tile is drawn. On a grid town the slab spans its whole plot, corner to corner. */
export const tileWidth = (map: WorldMap) => (map.grid ? map.grid.hw * 2 : TILE_W);

/**
 * How far below a place's point its tile's bottom edge sits. On a grid town the slab's corners line up
 * with the plot's, so the building sits on its land instead of floating above it.
 */
export const tileBase = (map: WorldMap) => (map.grid ? Math.round(tileWidth(map) * SLAB_CORNER) : TILE_BASE);

export type MapHit = { kind: "place"; id: string } | { kind: "billboard"; id: string } | null;

/**
 * What a tap at a world point lands on. Tiles are tall pictures, so a tap counts
 * if it falls inside the tile's box; the front-most (lowest on screen) wins.
 * tileHeights gives each tile's drawn height.
 */
export function hitTest(
  map: WorldMap,
  p: Point,
  tileHeights: Record<string, number>,
  boards: Record<string, Point>,
  boardH: number,
): MapHit {
  let best: MapHit = null;
  let bestY = -Infinity;
  const base = tileBase(map);
  const half = tileWidth(map) / 2 - 10;
  for (const pl of map.places) {
    const bottom = pl.y + base;
    const top = bottom - (tileHeights[pl.id] ?? tileWidth(map)) - 34; // include the name sign
    if (Math.abs(p.x - pl.x) < half && p.y < bottom && p.y > top && bottom > bestY) {
      best = { kind: "place", id: pl.id };
      bestY = bottom;
    }
  }
  for (const [id, b] of Object.entries(boards)) {
    if (Math.abs(p.x - b.x) < BILLBOARD_W / 2 && p.y < b.y && p.y > b.y - boardH && b.y > bestY) {
      best = { kind: "billboard", id };
      bestY = b.y;
    }
  }
  return best;
}
