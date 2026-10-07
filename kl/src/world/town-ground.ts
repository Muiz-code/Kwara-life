// The ground of a grid town, drawn once: terrain, every plot with its yard, wall,
// gate and path, the streets with kerbs and lane lines, water and bridges, fields
// and hills outside town, and the district names.
import { Container, Graphics, Text } from "pixi.js";
import { BIOMES } from "../data/biomes";
import { seeded } from "../sim/rng";
import { hash } from "./generate";
import { cellAt, cellCentre, yardColour } from "./town";
import type { Facing, Point, TownGrid, WorldMap } from "./types";

const hex = (c: string) => parseInt(c.replace("#", ""), 16);

/** The four corners of a cell: top, right, bottom, left. */
function corners(g: TownGrid, u: number, v: number): Point[] {
  const c = cellCentre(g, u, v);
  return [
    { x: c.x, y: c.y - g.hh },
    { x: c.x + g.hw, y: c.y },
    { x: c.x, y: c.y + g.hh },
    { x: c.x - g.hw, y: c.y },
  ];
}

/** The edge of a cell on one side: +u is right-bottom, +v bottom-left, -u left-top, -v top-right. */
function edge(g: TownGrid, u: number, v: number, f: Facing): [Point, Point] {
  const [t, r, b, l] = corners(g, u, v);
  return f === 0 ? [r, b] : f === 1 ? [b, l] : f === 2 ? [l, t] : [t, r];
}

const lerp = (a: Point, b: Point, k: number): Point => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

/** A point a fraction of the way into a cell, from its centre towards p. */
const inset = (c: Point, p: Point, k: number): Point => lerp(c, p, k);

const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

const WALL: Record<string, { color: number; top: number; h: number; every: number } | null> = {
  // The rich side: tall cream compound walls round every plot.
  R: { color: 0xeee3cc, top: 0xd8cbb0, h: 9, every: 1 },
  // The centre: low block walls.
  M: { color: 0xb9b1a3, top: 0xa39b8d, h: 5, every: 1 },
  // The poor side: a rusty zinc fence here and there, mostly open.
  P: { color: 0x9c6b3e, top: 0x7e5432, h: 6, every: 3 },
  o: null,
};

function tree(g: Graphics, x: number, y: number, s: number, kind: string) {
  if (kind === "palm") {
    g.ellipse(x, y + 2, 12 * s, 4 * s).fill({ color: 0x000000, alpha: 0.12 });
    g.moveTo(x, y).quadraticCurveTo(x + 3 * s, y - 18 * s, x - s, y - 34 * s).stroke({ width: 3.5 * s, color: 0x7a5634 });
    for (const [dx, dy] of [[-22, -26], [20, -24], [-14, -42], [14, -42], [0, -46]]) {
      g.moveTo(x - s, y - 34 * s).quadraticCurveTo(x + (dx / 2) * s, y - 40 * s, x + dx * s, y + dy * s).stroke({ width: 4 * s, color: 0x4e8a3f, cap: "round" });
    }
    return;
  }
  if (kind === "baobab") {
    g.ellipse(x, y + 2, 20 * s, 5 * s).fill({ color: 0x000000, alpha: 0.13 });
    g.poly([x - 7 * s, y, x - 5 * s, y - 30 * s, x + 7 * s, y - 30 * s, x + 6 * s, y]).fill(0x8a6a4a);
    g.ellipse(x, y - 36 * s, 24 * s, 11 * s).fill(0x6e8a3f);
    return;
  }
  g.ellipse(x, y + 2, 16 * s, 5 * s).fill({ color: 0x000000, alpha: 0.13 });
  g.rect(x - 2.5 * s, y - 14 * s, 5 * s, 16 * s).fill(0x6b4a2b);
  g.ellipse(x, y - 22 * s, 19 * s, 13 * s).fill(kind === "neem" ? 0x7a9a4a : 0x3f6b3a);
  g.ellipse(x - 5 * s, y - 26 * s, 9 * s, 6 * s).fill(kind === "neem" ? 0x93b25c : 0x56854a);
}

export function buildTownGround(map: WorldMap, fonts: { ui: string; sign: string }): Container {
  const g0 = map.grid!;
  const B = BIOMES[map.biome];
  const R = seeded(hash(`${map.id}ground`) % 2147483646 || 7);
  const root = new Container();
  const g = new Graphics();
  root.addChild(g);
  const W = map.width;
  const H = map.height;
  const cell = (u: number, v: number) => cellAt(g0, u, v);
  const isRoad = (c: string) => c === "r" || c === "b";
  const isLot = (c: string) => c === "R" || c === "M" || c === "P" || c === "o";

  g.rect(-3000, -3000, W + 6000, H + 6000).fill(hex(B.ground));
  for (let i = 0; i < 1600; i++) {
    const x = R() * (W + 800) - 400;
    const y = R() * (H + 800) - 400;
    g.moveTo(x, y + 6).lineTo(x + 3, y).lineTo(x + 6, y + 6);
  }
  g.stroke({ width: 1.5, color: hex(B.patch), alpha: 0.5 });

  // Out of town: farms, hills, trees and cattle on the open ground.
  const open: Point[] = [];
  for (let v = g0.v0; v < g0.v0 + g0.rows; v++) {
    for (let u = g0.u0; u < g0.u0 + g0.cols; u++) if (cell(u, v) === ".") open.push(cellCentre(g0, u, v));
  }
  const farmland = !!map.scenery?.farmland;
  if (farmland) {
    // Ridged fields in the grid's own directions, green where it is wet enough.
    const crop = map.biome === "sahel" ? 0xb9a35f : map.state === "kaduna" ? 0x6f9e45 : 0x8aab55;
    for (let i = 0; i < 18; i++) {
      const c = open[Math.floor(R() * open.length)];
      if (!c) break;
      const n = 2 + Math.floor(R() * 2);
      const pts = [
        { x: c.x, y: c.y - g0.hh * n }, { x: c.x + g0.hw * n, y: c.y },
        { x: c.x, y: c.y + g0.hh * n }, { x: c.x - g0.hw * n, y: c.y },
      ];
      if (pts.some((p) => nearTown(p))) continue;
      g.poly(pts.flatMap((p) => [p.x, p.y])).fill({ color: crop, alpha: 0.85 });
      for (let k = 1; k < n * 4; k++) {
        const a = lerp(pts[0], pts[3], k / (n * 4));
        const b = lerp(pts[1], pts[2], k / (n * 4));
        g.moveTo(a.x, a.y).lineTo(b.x, b.y);
      }
      g.stroke({ width: 2, color: 0x000000, alpha: 0.12 });
    }
  }
  function nearTown(p: Point) {
    const X = (p.x - g0.ox) / g0.hw;
    const Y = (p.y - g0.oy) / g0.hh;
    const u = Math.round((X + Y) / 2);
    const v = Math.round((Y - X) / 2);
    for (let du = -1; du <= 1; du++) for (let dv = -1; dv <= 1; dv++) if (cell(u + du, v + dv) !== ".") return true;
    return false;
  }
  if (map.scenery?.hills || B.extra === "rocks") {
    for (let i = 0; i < 10; i++) {
      const c = open[Math.floor(R() * open.length)];
      if (!c || nearTown(c)) continue;
      if (map.scenery?.hills) {
        g.ellipse(c.x, c.y, 160 + R() * 90, 70 + R() * 30).fill({ color: 0x6e9a4e, alpha: 0.85 });
        g.ellipse(c.x - 30, c.y - 18, 90, 34).fill({ color: 0x83a552, alpha: 0.9 });
      } else {
        g.moveTo(c.x - 50, c.y).quadraticCurveTo(c.x - 24, c.y - 64, c.x + 12, c.y - 58).quadraticCurveTo(c.x + 54, c.y - 52, c.x + 62, c.y).closePath()
          .fill(0x9a9184).stroke({ width: 1.5, color: 0x6e665c });
      }
    }
  }

  // The river runs on past the grid to the edge of the world.
  const wetCols = new Set<number>();
  for (let u = g0.u0; u < g0.u0 + g0.cols; u++) if (cell(u, g0.v0) === "w" || cell(u, g0.v0 + g0.rows - 1) === "w") wetCols.add(u);
  for (const u of wetCols) {
    for (let v = g0.v0 - 30; v < g0.v0 + g0.rows + 30; v++) {
      if (v >= g0.v0 && v < g0.v0 + g0.rows) continue;
      g.poly(corners(g0, u, v).flatMap((p) => [p.x, p.y])).fill(0x5f97a1);
    }
  }

  // Water, river banks first.
  for (let v = g0.v0; v < g0.v0 + g0.rows; v++) {
    for (let u = g0.u0; u < g0.u0 + g0.cols; u++) {
      const c = cell(u, v);
      if (c !== "w" && c !== "b") continue;
      g.poly(corners(g0, u, v).flatMap((p) => [p.x, p.y])).fill(0x5f97a1);
      for (let f = 0; f < 4; f++) {
        const n = cell(u + DIRS[f][0], v + DIRS[f][1]);
        if (n === "w" || n === "b") continue;
        const [a, b] = edge(g0, u, v, f as Facing);
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 6, color: 0x3f7580 });
      }
    }
  }

  // Plots: yard, path to the gate, wall with a gap at the gate.
  for (const lot of map.lots ?? []) {
    // Out of town, an unbuilt plot is just the bush.
    if (lot.district === "out" && lot.use === "garden") continue;
    const X = (lot.x - g0.ox) / g0.hw;
    const Y = (lot.y - g0.oy) / g0.hh;
    const u = Math.round((X + Y) / 2);
    const v = Math.round((Y - X) / 2);
    const code = cell(u, v);
    const cs = corners(g0, u, v);
    const c = { x: lot.x, y: lot.y };
    const yard = cs.map((p) => inset(c, p, 0.94));
    g.poly(yard.flatMap((p) => [p.x, p.y])).fill(hex(yardColour(map.biome, lot.district)));
    if (lot.use === "garden") {
      // An empty plot: grass and a tree or two.
      for (let k = 0; k < 2; k++) {
        const t = inset(c, cs[Math.floor(R() * 4)], R() * 0.5);
        tree(g, t.x, t.y + 10, 0.7 + R() * 0.3, B.trees[Math.floor(R() * B.trees.length)] || "");
      }
    }
    // A paved path from the door out to each gate.
    for (const f of lot.gates) {
      const [a, b] = edge(g0, u, v, f);
      const mid = lerp(a, b, 0.5);
      const half = { x: (b.x - a.x) * 0.09, y: (b.y - a.y) * 0.09 };
      g.poly([c.x - half.x, c.y - half.y, c.x + half.x, c.y + half.y, mid.x + half.x, mid.y + half.y, mid.x - half.x, mid.y - half.y])
        .fill(lot.district === "poor" ? 0xa98a62 : 0xcfc6b6);
    }
    const wall = WALL[code];
    if (!wall) continue;
    if (wall.every > 1 && Math.floor(R() * wall.every) !== 0) continue;
    for (let f = 0 as Facing; f < 4; f = (f + 1) as Facing) {
      const [a0, b0] = edge(g0, u, v, f);
      const a = inset(c, a0, 0.94);
      const b = inset(c, b0, 0.94);
      const gate = lot.gates.includes(f);
      // A gate: the wall stops either side of the path, with two posts.
      const runs: [Point, Point][] = gate ? [[a, lerp(a, b, 0.38)], [lerp(a, b, 0.62), b]] : [[a, b]];
      for (const [p, q] of runs) {
        g.poly([p.x, p.y, q.x, q.y, q.x, q.y - wall.h, p.x, p.y - wall.h]).fill(wall.color);
        g.moveTo(p.x, p.y - wall.h).lineTo(q.x, q.y - wall.h).stroke({ width: 1.5, color: wall.top });
      }
      if (gate && code !== "P") {
        for (const k of [0.38, 0.62]) {
          const p = lerp(a, b, k);
          g.rect(p.x - 2, p.y - wall.h - 5, 4, wall.h + 5).fill(wall.top);
        }
      }
    }
  }

  // Streets: tarmac, kerbs where the road meets a plot, lane lines down the middle.
  const roadColour = hex(B.road);
  for (let v = g0.v0; v < g0.v0 + g0.rows; v++) {
    for (let u = g0.u0; u < g0.u0 + g0.cols; u++) {
      const c = cell(u, v);
      if (!isRoad(c)) continue;
      const cs = corners(g0, u, v);
      g.poly(cs.flatMap((p) => [p.x, p.y])).fill(c === "b" ? 0x9aa3ad : roadColour);
      for (let f = 0; f < 4; f++) {
        const n = cell(u + DIRS[f][0], v + DIRS[f][1]);
        if (isRoad(n)) continue;
        const [a, b] = edge(g0, u, v, f as Facing);
        // A kerb on land, railings on a bridge.
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: c === "b" ? 4 : 5, color: c === "b" ? 0xc4cbd2 : isLot(n) ? 0xd9d2c3 : 0x8a8170 });
      }
    }
  }
  // Lane lines: a dash through each straight piece of street, along it.
  for (let v = g0.v0; v < g0.v0 + g0.rows; v++) {
    for (let u = g0.u0; u < g0.u0 + g0.cols; u++) {
      if (!isRoad(cell(u, v))) continue;
      const c = cellCentre(g0, u, v);
      const alongU = isRoad(cell(u - 1, v)) && isRoad(cell(u + 1, v));
      const alongV = isRoad(cell(u, v - 1)) && isRoad(cell(u, v + 1));
      // Crossroads get zebra crossings instead of a lane line.
      if (alongU && alongV) continue;
      if (alongU) dash(g, c, { x: g0.hw, y: g0.hh });
      if (alongV) dash(g, c, { x: -g0.hw, y: g0.hh });
    }
  }
  g.stroke({ width: 3, color: 0xe8e2d0, cap: "round" });
  // Zebra crossings on each arm of a traffic light junction: stripes along the
  // road, side by side across it.
  for (const p of map.lights ?? []) {
    for (const [du, dv] of DIRS) {
      const c = { x: p.x + (du - dv) * g0.hw * 0.62, y: p.y + (du + dv) * g0.hh * 0.62 };
      const along = { x: (du - dv) * g0.hw * 0.1, y: (du + dv) * g0.hh * 0.1 };
      const across = du !== 0 ? { x: -g0.hw, y: g0.hh } : { x: g0.hw, y: g0.hh };
      for (let k = -2; k <= 2; k++) {
        const o = { x: c.x + across.x * k * 0.12, y: c.y + across.y * k * 0.12 };
        g.moveTo(o.x - along.x, o.y - along.y).lineTo(o.x + along.x, o.y + along.y);
      }
    }
  }
  g.stroke({ width: 5, color: 0xf4f1ea, alpha: 0.9 });

  // Trees and cattle out on the open ground.
  for (let i = 0; i < 140; i++) {
    const c = open[Math.floor(R() * open.length)];
    if (!c) break;
    tree(g, c.x + (R() - 0.5) * g0.hw, c.y + (R() - 0.5) * g0.hh, 0.8 + R() * 0.5, B.trees[i % B.trees.length] || "");
  }

  // Street names on the longer straight runs.
  const labelStyle = { fontFamily: fonts.ui, fontWeight: "800" as const, fill: 0xf7f2e4, stroke: { color: 0x3f3b37, width: 3 }, fontSize: 13 };
  const seen = new Set<string>();
  for (const r of map.roads) {
    if (!r.name || r.pts.length < 4 || seen.has(r.name)) continue;
    seen.add(r.name);
    const a = r.pts[Math.floor(r.pts.length / 2) - 1];
    const b = r.pts[Math.floor(r.pts.length / 2)];
    let ang = Math.atan2(b.y - a.y, b.x - a.x);
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    const t = new Text({ text: r.name, style: labelStyle });
    t.anchor.set(0.5);
    t.position.set((a.x + b.x) / 2, (a.y + b.y) / 2);
    // Skew to sit flat on the isometric road rather than float above it.
    t.rotation = ang;
    root.addChild(t);
  }
  return root;
}

function dash(g: Graphics, c: Point, axis: Point) {
  const k = 0.22;
  g.moveTo(c.x - axis.x * k, c.y - axis.y * k).lineTo(c.x + axis.x * k, c.y + axis.y * k);
}
