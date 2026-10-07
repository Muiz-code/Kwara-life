// Pure placement helpers for the map: where billboards stand and what a tap hits.
import { AD_SLOTS } from "../data/ilorin/billboards";
import { PLACES } from "../data/ilorin/places";
import { ROADS } from "../data/ilorin/roads";
import { nodePos, placePos, standPos, type Point } from "../sim/world";
import { BILLBOARD_W, TILE_BASE, TILE_W } from "./art";

export function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = dx * dx + dy * dy;
  let t = l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const ROAD_SEGS = ROADS.map((r) => [nodePos(r.a), nodePos(r.b)] as const);

/** Distance from a point to the nearest road. */
export const roadDistance = (p: Point) => Math.min(...ROAD_SEGS.map(([a, b]) => segmentDistance(p, a, b)));

/** Clear of building tiles and roads, with room for a board of the given width. */
function isFree(p: Point, taken: Point[]): boolean {
  if (PLACES.some((pl) => Math.hypot(placePos(pl.id).x - p.x, placePos(pl.id).y - p.y) < 140)) return false;
  // Keep clear of the spot where the player stands outside each place.
  if (PLACES.some((pl) => Math.hypot(standPos(pl.id).x - p.x, standPos(pl.id).y - p.y) < 120)) return false;
  if (taken.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < BILLBOARD_W)) return false;
  const d = roadDistance({ x: p.x, y: p.y - 10 });
  return d > 30 && d < 130;
}

/**
 * Where each billboard stands (the bottom centre of its tile). Starts from the
 * slot's preferred side of its place and walks round until it finds open ground
 * close to a road, so boards face traffic without covering buildings.
 */
export function billboardPositions(): Record<string, Point> {
  const out: Record<string, Point> = {};
  const taken: Point[] = [];
  for (const slot of AD_SLOTS) {
    const c = placePos(slot.near);
    const start = Math.atan2(slot.dy, slot.dx);
    let found: Point | null = null;
    for (let r = 150; r <= 420 && !found; r += 15) {
      for (let i = 0; i < 24 && !found; i++) {
        const ang = start + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 12);
        const p = { x: Math.round(c.x + Math.cos(ang) * r), y: Math.round(c.y + Math.sin(ang) * r * 0.75) };
        if (isFree(p, taken)) found = p;
      }
    }
    if (!found) throw new Error(`No room for billboard ${slot.id}`);
    const p = found;
    out[slot.id] = p;
    taken.push(p);
  }
  return out;
}

export type MapHit = { kind: "place"; id: string } | { kind: "billboard"; id: string } | null;

/**
 * What a tap at a world point lands on. Tiles are tall pictures, so a tap counts
 * if it falls inside the tile's box; the front-most (lowest on screen) wins.
 * tileHeights gives each tile's drawn height.
 */
export function hitTest(p: Point, tileHeights: Record<string, number>, boards: Record<string, Point>, boardH: number): MapHit {
  let best: MapHit = null;
  let bestY = -Infinity;
  for (const pl of PLACES) {
    const c = placePos(pl.id);
    const bottom = c.y + TILE_BASE;
    const top = bottom - (tileHeights[pl.id] ?? TILE_W) - 34; // include the name sign
    if (Math.abs(p.x - c.x) < TILE_W / 2 - 10 && p.y < bottom && p.y > top && bottom > bestY) {
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
