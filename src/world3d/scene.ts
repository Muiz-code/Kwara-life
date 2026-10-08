// Builds the still parts of a grid town in 3D: ground, roads, plots, walls, trees and every building.
// Everything is baked into a few chunk meshes (one per CHUNK-square of ground) so a phone draws a
// handful of meshes and the camera skips the chunks it cannot see.
import { BIOMES, type Arch } from "../data/biomes";
import { BoxGeometry, CylinderGeometry, Matrix4, TorusGeometry, type BufferGeometry } from "three";
import { cellAt, isLotCode, yardColour, zoneOfCode } from "../world/town";
import type { Facing, TownLot, WorldMap, ZoneKind } from "../world/types";
import { build, car, danfo, figure, tree, type BuildCtx } from "./buildings";
import { CELL, FACE_TURN, PLOT_H, rng, seedAt, toWorld } from "./coords";
import { Kit } from "./kit";

/** Ground is cut into squares this wide for culling. */
export const CHUNK = 80;

export interface PlaceSpot {
  id: string;
  x: number;
  z: number;
  /** Top of its building, for the name sign. */
  top: number;
}

export interface BuiltScene {
  chunks: { key: string; geometry: BufferGeometry }[];
  places: PlaceSpot[];
  /** Ground the camera may look at. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Open blocks where life happens: school fields for children's football, parks for walkers. */
  fields: { x: number; z: number; w: number; d: number }[];
  /** Empty plots (gardens, school and campus grounds, the airport apron) where anyone can put up a board. */
  emptyPlots: { x: number; z: number }[];
  /** Extra name signs for things that are not places you visit (a senate building, hostels). */
  labels: { text: string; x: number; y: number; z: number }[];
}

const ROAD = { a: "#4B4C50", r: "#5A5B5E", t: "#A07E58", b: "#6A6B6E" } as Record<string, string>;
const SOIL = "#8A5D3B";
const PAVEMENT = "#CEC6B6";
const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
/** A roundabout's island and the outer edge of its carriageway, from the island's centre. */
const RING_IN = 6;
const RING_OUT = 14.5;

const OPEN = new Set<string>(["schools", "campus", "park", "airport"]);
const ROADS = new Set(["a", "r", "t", "b"]);

type TownBuildingKey = NonNullable<WorldMap["buildings"]>[number];

const key = (x: number, z: number) => `${Math.round(x)},${Math.round(z)}`;

/** Places drawn as a different building from their kind. */
const BUILT_AS: Record<string, string> = { item7: "restaurant" };

export function buildScene(map: WorldMap): BuiltScene {
  const g = map.grid;
  if (!g) throw new Error("3D needs a grid town");
  const biome = BIOMES[map.biome];
  const kits = new Map<string, Kit>();
  const kitAt = (x: number, z: number) => {
    const k = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    let kit = kits.get(k);
    if (!kit) kits.set(k, (kit = new Kit()));
    kit.frame.identity();
    return kit;
  };
  const cell = (u: number, v: number) => cellAt(g, u, v);
  /** A road cell in the 3 by 3 round a roundabout island. */
  const nearIsland = (u: number, v: number) => {
    for (let du = -1; du <= 1; du++) for (let dv = -1; dv <= 1; dv++) if ((du || dv) && cell(u + du, v + dv) === "i") return true;
    return false;
  };
  // Aso Rock's compound and massif stand behind the villa's roadside plot: nothing else is built there.
  const villa = (() => {
    const pl = map.places.find((q) => q.kind === "lm-villa");
    if (!pl) return null;
    const p = toWorld(g, pl);
    const lot = (map.lots ?? []).find((l) => key(toWorld(g, l).x, toWorld(g, l).z) === key(p.x, p.z));
    const face = (lot?.face ?? 1) as Facing;
    return { x: p.x, z: p.z, face, F: behind(face, p.x, p.z, VILLA_BACK) };
  })();
  const onVilla = (x: number, z: number) => !!villa && villaCovers(villa.face, villa.x, villa.z, x, z);
  const R = rng(seedAt(g.ox, g.oy, 7));

  const minX = g.u0 * CELL - CELL / 2;
  const maxX = (g.u0 + g.cols) * CELL - CELL / 2;
  const minZ = g.v0 * CELL - CELL / 2;
  const maxZ = (g.v0 + g.rows) * CELL - CELL / 2;

  // The land the town stands on, running well past its edge.
  {
    const pad = 160;
    for (let x = minX - pad; x < maxX + pad; x += CHUNK) {
      for (let z = minZ - pad; z < maxZ + pad; z += CHUNK) {
        kitAt(x + CHUNK / 2, z + CHUNK / 2).box(CHUNK, 0.4, CHUNK, x + CHUNK / 2, -0.4, z + CHUNK / 2, biome.ground);
      }
    }
    // Bush and farmland out past the last road.
    const crops = map.scenery?.farmland;
    for (let i = 0; i < 700; i++) {
      const x = minX - pad + R() * (maxX - minX + pad * 2);
      const z = minZ - pad + R() * (maxZ - minZ + pad * 2);
      if (x > minX - 4 && x < maxX + 4 && z > minZ - 4 && z < maxZ + 4) continue;
      if (onVilla(x, z)) continue;
      const kit = kitAt(x, z);
      if (crops && i % 3 === 0) {
        for (let r = 0; r < 5; r++) kit.box(9, 0.35, 0.6, x, 0, z + r * 1.4, "#6E8F3A");
      } else tree({ kit, biome: map.biome, district: "out", rnd: R }, biome.trees[i % 3] || "neem", x, z, 0.9 + R() * 0.6);
    }
  }

  // Every cell of the grid: roads, water, plots and open ground.
  const lots = new Map<string, TownLot>();
  const emptyPlots: BuiltScene["emptyPlots"] = [];
  const labels: BuiltScene["labels"] = [];
  for (const lot of map.lots ?? []) {
    const w = toWorld(g, lot);
    lots.set(key(w.x, w.z), lot);
  }
  for (let v = g.v0; v < g.v0 + g.rows; v++) {
    for (let u = g.u0; u < g.u0 + g.cols; u++) {
      const c = cell(u, v);
      const X = u * CELL;
      const Z = v * CELL;
      const kit = kitAt(X, Z);
      if (ROADS.has(c)) {
        // Round a roundabout: just verge here; the island draws the circular carriageway over it.
        if (c !== "b" && nearIsland(u, v)) {
          kit.box(CELL, 0.04, CELL, X, -0.04, Z, biome.patch);
          continue;
        }
        if (c === "b") {
          kit.box(CELL, 0.5, CELL, X, -0.45, Z, "#5F97A1");
          kit.box(CELL, 0.4, CELL * 0.8, X, 0.0, Z, ROAD.b);
          for (const s of [-1, 1]) kit.box(CELL, 0.7, 0.2, X, 0.4, Z + s * CELL * 0.4, "#C9C3B6");
          continue;
        }
        if (c !== "a") {
          // Lanes and dirt tracks are half a plot wide, with grass verges and the odd shade tree.
          const half = 2.6;
          kit.box(CELL, 0.04, CELL, X, -0.04, Z, biome.patch);
          kit.box(half * 2, 0.06, half * 2, X, -0.03, Z, ROAD[c]);
          const arms: [number, number][] = [];
          for (const [dx, dz] of DIRS) if (ROADS.has(cell(u + dx, v + dz)) || cell(u + dx, v + dz) === "i") arms.push([dx, dz]);
          for (const [dx, dz] of arms) {
            const len = CELL / 2 - half;
            kit.box(dx ? len : half * 2, 0.06, dz ? len : half * 2, X + dx * (half + len / 2), -0.03, Z + dz * (half + len / 2), ROAD[c]);
          }
          if (arms.length === 2 && arms[0][0] === -arms[1][0] && R() < 0.22) {
            const side = R() < 0.5 ? -1 : 1;
            const [dx, dz] = arms[0];
            tree({ kit, biome: map.biome, district: "mixed", rnd: R }, biome.trees[Math.floor(R() * 3)] || "neem", X + (dz ? side * 3.8 : 0), Z + (dx ? side * 3.8 : 0), 0.7 + R() * 0.3);
          }
          continue;
        }
        kit.box(CELL, 0.06, CELL, X, -0.03, Z, ROAD[c]);
        {
          // Centre-line dashes on straight stretches of main road.
          const alongU = ROADS.has(cell(u - 1, v)) && ROADS.has(cell(u + 1, v)) && !(ROADS.has(cell(u, v - 1)) && ROADS.has(cell(u, v + 1)));
          const alongV = ROADS.has(cell(u, v - 1)) && ROADS.has(cell(u, v + 1)) && !alongU;
          if (alongU) for (const dx of [-2.5, 2.5]) kit.box(2.6, 0.02, 0.22, X + dx, 0.03, Z, "#F2EEE4");
          if (alongV) for (const dz of [-2.5, 2.5]) kit.box(0.22, 0.02, 2.6, X, 0.03, Z + dz, "#F2EEE4");
          // A zebra crossing where a lane meets the main road.
          if (!alongU && !alongV) for (let i = 0; i < 5; i++) kit.box(0.5, 0.02, 3.2, X - 2 + i, 0.03, Z - 3.2, "#F2EEE4");
        }
        continue;
      }
      if (c === "i") {
        // A roundabout: a circular carriageway round a raised island with its monument, a kerb round the
        // outside, and the roads joining it only where they actually go somewhere.
        kit.box(CELL, 0.04, CELL, X, -0.04, Z, biome.patch);
        kit.cyl(RING_OUT, RING_OUT, 0.06, X, -0.035, Z, ROAD.a, 40);
        const goes = DIRS.filter(([dx, dz]) => ROADS.has(cell(u + dx * 2, v + dz * 2)));
        for (const [dx, dz] of goes) {
          // The arm runs from inside the ring out to the edge of the 3 by 3 junction.
          const from = RING_OUT - 2;
          const to = CELL * 1.5;
          const len = to - from;
          const mid = from + len / 2;
          kit.box(dx ? len : CELL, 0.06, dz ? len : CELL, X + dx * mid, -0.03, Z + dz * mid, ROAD.a);
          // A give-way line where the arm meets the ring.
          kit.box(dx ? 0.3 : CELL * 0.45, 0.02, dz ? 0.3 : CELL * 0.45, X + dx * (RING_OUT + 0.4) + (dz ? CELL * 0.22 : 0), 0.03, Z + dz * (RING_OUT + 0.4) + (dx ? -CELL * 0.22 : 0), "#F2EEE4");
        }
        // The kerb round the outside, open where an arm comes in.
        const open = (a: number) => goes.some(([dx, dz]) => Math.abs(Math.atan2(Math.sin(a - Math.atan2(dz, dx)), Math.cos(a - Math.atan2(dz, dx)))) < 0.4);
        for (let i = 0; i < 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          if (open(a)) continue;
          kit.box(0.35, 0.18, (2 * Math.PI * RING_OUT) / 48 + 0.05, X + Math.cos(a) * (RING_OUT + 0.15), -0.02, Z + Math.sin(a) * (RING_OUT + 0.15), "#C9C3B6", -a);
        }
        // A dashed line between the two lanes of the ring.
        const lane = (RING_IN + RING_OUT) / 2;
        for (let i = 0; i < 28; i += 1) {
          const a = (i / 28) * Math.PI * 2;
          kit.box(0.18, 0.02, 1.1, X + Math.cos(a) * lane, 0.03, Z + Math.sin(a) * lane, "#F2EEE4", -a);
        }
        // The island: kerb, grass, flowers and the monument.
        kit.cyl(RING_IN, RING_IN + 0.2, 0.45, X, 0, Z, "#D8D0C0", 28);
        kit.cyl(RING_IN - 0.3, RING_IN - 0.3, 0.5, X, 0, Z, "#6FA64A", 28);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          kit.ball(0.35, X + Math.cos(a) * (RING_IN - 1.1), 0.7, Z + Math.sin(a) * (RING_IN - 1.1), ["#C0392B", "#F2B705", "#F4F1EA"][i % 3], 0.7);
        }
        kit.cyl(1.4, 1.6, 0.5, X, 0.5, Z, "#E6E2D8", 12);
        kit.cyl(0.6, 0.8, 2.6, X, 1.0, Z, "#E6E2D8", 8);
        kit.ball(0.7, X, 4.1, Z, "#C9A227", 1, 1);
        continue;
      }
      // The shore: the ground cell between the shore road and the water is a promenade with palms.
      if (c === "." && cell(u, v + 1) === "w" && ROADS.has(cell(u, v - 1))) {
        kit.box(CELL, 0.25, CELL, X, 0, Z, "#E8DCC0");
        kit.box(CELL, 0.9, 0.12, X, 0.25, Z + CELL / 2 - 0.3, "#8E979F");
        if ((u & 1) === 0) tree({ kit, biome: map.biome, district: "mixed", rnd: R }, "palm", X, Z, 1.1);
        else kit.box(2, 0.45, 0.6, X, 0.25, Z - 1, "#8C6A4A");
        continue;
      }
      if (c === "w") {
        kit.box(CELL, 0.1, CELL, X, -0.08, Z, "#5F97A1");
        for (let f = 0; f < 4; f++) {
          const n = cell(u + DIRS[f][0], v + DIRS[f][1]);
          if (n === "w" || n === "b") continue;
          const [dx, dz] = DIRS[f];
          kit.box(dz ? CELL : 0.8, 0.25, dx ? CELL : 0.8, X + dx * (CELL / 2 - 0.4), -0.1, Z + dz * (CELL / 2 - 0.4), "#8C7A5B");
        }
        continue;
      }
      if (!isLotCode(c)) continue;
      // A plot: a raised block of earth, its yard on top, pavement along every street side.
      const zone = zoneOfCode(c);
      const lot = lots.get(key(X, Z));
      const yard = lot?.use === "apron" ? "#8F949A" : yardColour(map.biome, zone);
      kit.box(CELL, PLOT_H, CELL, X, 0, Z, SOIL);
      kit.box(CELL - 0.02, 0.02, CELL - 0.02, X, PLOT_H, Z, yard);
      for (let f = 0; f < 4; f++) {
        if (!ROADS.has(cell(u + DIRS[f][0], v + DIRS[f][1]))) continue;
        const [dx, dz] = DIRS[f];
        kit.box(dz ? CELL : 1.0, 0.03, dx ? CELL : 1.0, X + dx * (CELL / 2 - 0.5), PLOT_H, Z + dz * (CELL / 2 - 0.5), PAVEMENT);
      }
      // The villa's plot is the forecourt before its gate, paved, with no yard wall of its own.
      if (villa && key(X, Z) === key(villa.x, villa.z)) kit.box(CELL - 0.04, 0.03, CELL - 0.04, X, PLOT_H, Z, "#D8D0C0");
      else if (lot && !OPEN.has(zone ?? "") && !onVilla(X, Z)) yardAndWalls(kitAt(X, Z), map, lot, X, Z, zone);
      if (lot && lot.use !== "place" && lot.use !== "building") emptyPlots.push({ x: X, z: Z });
    }
  }

  // The northern old cities stand inside their walls.
  if (BIOMES[map.biome].walled) cityWall(map, kitAt, (x, z) => cell(Math.round(x / CELL), Math.round(z / CELL)));

  // Ground kept clear of park trees: the stadium's bowl.
  keepOut.length = 0;
  for (const pl of map.places.filter((q) => q.kind === "stadium")) {
    const p = toWorld(g, pl);
    const [fx, fz] = DIRS[(lots.get(key(p.x, p.z))?.face ?? 1) as Facing];
    const cx = p.x - fx * CELL * 2.6;
    const cz = p.z - fz * CELL * 2.6;
    keepOut.push({ x: cx, z: cz, r: 24 });
  }
  // Open blocks are one piece of ground each: one set of pitches, one runway, one park.
  const fields: BuiltScene["fields"] = [];
  for (const b of map.blocks ?? []) {
    if (!OPEN.has(b.zone)) continue;
    const pts = b.corners.map((p) => toWorld(g, p));
    const x0 = Math.min(...pts.map((p) => p.x)) + CELL / 2;
    const x1 = Math.max(...pts.map((p) => p.x)) - CELL / 2;
    const z0 = Math.min(...pts.map((p) => p.z)) + CELL / 2;
    const z1 = Math.max(...pts.map((p) => p.z)) - CELL / 2;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const w = x1 - x0;
    const d = z1 - z0;
    // The airport faces its entrance: the runway goes on the side away from the airport's own plot.
    let flip = false;
    if (b.zone === "airport") {
      const ap = map.places.find((q) => q.kind === "airport");
      if (ap) {
        const p = toWorld(g, ap);
        flip = (w >= d ? p.z - cz : p.x - cx) < 0;
      }
    }
    openBlock(kitAt(cx, cz), map, b.zone, cx, cz, w, d, R, fields, flip);
  }

  // Bus stops by the kerb.
  for (const s of map.stops ?? []) {
    const p = toWorld(g, s);
    const kit = kitAt(p.x, p.z);
    kit.frame.makeRotationY(FACE_TURN[s.face as Facing]).setPosition(p.x, 0, p.z);
    kit.box(0.1, 2.4, 0.1, -1.2, 0, 0, "#3A3F45");
    kit.box(0.1, 2.4, 0.1, 1.2, 0, 0, "#3A3F45");
    kit.box(2.8, 0.1, 1.2, 0, 2.4, 0.2, "#2E7D4F");
    kit.box(2.2, 0.08, 0.4, 0, 0.6, 0, "#8C6A4A");
    kit.box(0.6, 0.5, 0.06, 1.6, 2.6, 0.2, "#F2B705");
  }

  // Every building and place on its plot, turned to face its street.
  const places: PlaceSpot[] = [];
  const turn = new Matrix4();
  const place = (kind: string, x: number, z: number, salt: number) => {
    const lot = lots.get(key(x, z));
    const kit = kitAt(x, z);
    kit.frame.makeRotationY(FACE_TURN[(lot?.face ?? 1) as Facing]).premultiply(turn.makeTranslation(x, PLOT_H, z));
    const ctx: BuildCtx = { kit, biome: map.biome, district: lot?.district ?? "mixed", rnd: rng(seedAt(x, z, salt)) };
    return build(kind, ctx);
  };
  // Landmark businesses on the hand-built Ilorin map: the ordinary building nearest each spot becomes
  // Klario Bank (by Taiwo Oke) and Raavon (by the Innovation Hub on Ahmadu Bello Way).
  const landmark = new Map<TownBuildingKey, { kind: string; label: string }>();
  if (map.id === "kwara/ilorin") {
    const spots: [{ x: number; y: number } | undefined, string, string][] = [
    ];
    for (const [at, kind, label] of spots) {
      if (!at) continue;
      const best = (map.buildings ?? []).filter((b) => !landmark.has(b)).sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y))[0];
      if (best) landmark.set(best, { kind, label });
    }
  }
  for (const b of map.buildings ?? []) {
    const p = toWorld(g, b);
    if (onVilla(p.x, p.z)) continue;
    const lm = landmark.get(b);
    const top = place(lm?.kind ?? b.kind, p.x, p.z, 1);
    if (lm) labels.push({ text: lm.label, x: p.x, y: top + PLOT_H + 1.2, z: p.z });
  }
  for (const pl of map.places) {
    const p = toWorld(g, pl);
    // Some places are their own kind of building: Item 7 is a big restaurant tower, not a row of shops.
    const big = pl.kind === "stadium" || pl.kind === "trainstation" || pl.kind === "busterminal";
    // Aso Rock has no building on its plot: the plot is the forecourt and the sign stands over the gate.
    if (pl.kind === "lm-villa" && villa) {
      asoRock(kitAt(p.x, p.z), map, villa.face, p.x, p.z, R);
      const [gx, gz] = villa.F.at(0, -15);
      places.push({ id: pl.id, x: gx, z: gz, top: 5 + PLOT_H });
      continue;
    }
    const top = place(BUILT_AS[pl.id] ?? (big ? "kiosk" : pl.kind), p.x, p.z, 2);
    if (pl.kind === "trainstation") bigStation(kitAt(p.x, p.z), map, lots.get(key(p.x, p.z))?.face ?? 1, p.x, p.z, R);
    if (pl.kind === "busterminal") bigTerminal(kitAt(p.x, p.z), lots.get(key(p.x, p.z))?.face ?? 1, p.x, p.z, R);
    if (pl.kind === "stadium") bigStadium(kitAt(p.x, p.z), lots.get(key(p.x, p.z))?.face ?? 1, p.x, p.z, fields);
    if (pl.kind === "kwasu") outCampus(kitAt(p.x, p.z), map, lots.get(key(p.x, p.z))?.face ?? 1, p.x, p.z, R, fields, labels);
    places.push({ id: pl.id, x: p.x, z: p.z, top: top + PLOT_H });
  }

  const chunks: BuiltScene["chunks"] = [];
  for (const [k, kit] of kits) {
    const geometry = kit.merge();
    if (geometry) chunks.push({ key: k, geometry });
  }
  // No boards on ground a big building stands on (the stadium's bowl).
  const freePlots = emptyPlots.filter((p) => !keepOut.some((k) => Math.hypot(p.x - k.x, p.z - k.z) < k.r + CELL / 2));
  return { chunks, places, bounds: { minX, maxX, minZ, maxZ }, fields, emptyPlots: freePlots, labels };
}

/** A plot's wall, gate and garden, to suit its district. */
function yardAndWalls(kit: Kit, map: WorldMap, lot: TownLot, X: number, Z: number, zone: ZoneKind | "out" | undefined) {
  const R = rng(seedAt(X, Z, 3));
  const ctx: BuildCtx = { kit, biome: map.biome, district: lot.district, rnd: R };
  if (lot.use === "garden") {
    const trees = BIOMES[map.biome].trees;
    for (let i = 0; i < 3; i++) tree(ctx, trees[i % 3] || "neem", X + (R() - 0.5) * 6, Z + (R() - 0.5) * 6, 0.8 + R() * 0.4);
  }
  const style =
    lot.district === "rich" ? { h: 1.8, col: "#EFE6D2", cap: "#9C8F7A", gate: "#2B2F36" }
    : lot.district === "mixed" ? (R() < 0.85 ? { h: 1.2, col: "#D8D0C0", cap: "#A69C8B", gate: "#3A6E5A" } : null)
    : zone === "slum" || lot.district === "out" ? null
    : R() < 0.45 ? { h: 1.0, col: "#B9A88C", cap: "#9C8B70", gate: "#6B4A2E" } : null;
  const look = BIOMES[map.biome];
  const regional = regionalYard(look.arch, lot.district, zone, look.wall[0], R);
  const wall: YardWall | null = regional === undefined ? style : regional;
  if (!wall) return;
  const half = CELL / 2 - 0.55;
  for (let f = 0 as Facing; f < 4; f = (f + 1) as Facing) {
    const [dx, dz] = DIRS[f];
    const cx = X + dx * half;
    const cz = Z + dz * half;
    const along = dz !== 0;
    const len = CELL - 1.1;
    const gate = lot.gates.includes(f);
    const runs = gate ? [[-len / 2, -1.5], [1.5, len / 2]] : [[-len / 2, len / 2]];
    for (const [a, b] of runs) {
      const m = (a + b) / 2;
      const l = b - a;
      const x = along ? cx + m : cx;
      const z = along ? cz : cz + m;
      kit.box(along ? l : wall.t ?? 0.22, wall.h, along ? wall.t ?? 0.22 : l, x, PLOT_H, z, wall.col);
      kit.box(along ? l : (wall.t ?? 0.22) + 0.08, 0.08, along ? (wall.t ?? 0.22) + 0.08 : l, x, PLOT_H + wall.h, z, wall.cap);
    }
    if (gate && lot.district === "rich") {
      for (const s of [-0.75, 0.75]) kit.box(along ? 1.4 : 0.08, wall.h - 0.1, along ? 0.08 : 1.4, along ? cx + s : cx, PLOT_H, along ? cz : cz + s, wall.gate);
    }
  }
}

type YardWall = { h: number; col: string; cap: string; gate: string; t?: number };

/**
 * How a region walls its yards, or undefined to use the usual: tall mud walls up north, high walls and
 * painted gates in the east, clipped hedges in Abuja, white picket fences in Calabar, none on creek stilts.
 */
function regionalYard(arch: Arch | undefined, district: string, zone: ZoneKind | "out" | undefined, mud: string, R: () => number): YardWall | null | undefined {
  if (zone === "slum" || district === "out") return null;
  switch (arch) {
    case "hausa":
      return { h: 2.2, col: mud, cap: mud, gate: "#26355E", t: 0.45 };
    case "igbo":
      return district === "poor" ? undefined : { h: 2.3, col: "#F0E2C4", cap: "#B3261E", gate: "#1F6B4A" };
    case "modern":
      return { h: 1.0, col: "#3F6B2A", cap: "#4E7A34", gate: "#2B2F36", t: 0.6 };
    case "colonial":
      return district === "poor" && R() < 0.5 ? null : { h: 0.9, col: "#F4F1EA", cap: "#F4F1EA", gate: "#F4F1EA", t: 0.08 };
    case "stilt":
      return district === "rich" ? undefined : null;
    case "stone":
      return { h: 1.3, col: "#8E8B84", cap: "#6E6B65", gate: "#3A3F45", t: 0.4 };
    default:
      return undefined;
  }
}

/**
 * The old city wall (ganuwa) round a northern town: thick mud ramparts with round towers at the corners,
 * and a gate (kofa) with horned towers wherever a road goes out.
 */
function cityWall(map: WorldMap, kitAt: (x: number, z: number) => Kit, cellAtWorld: (x: number, z: number) => string) {
  const g = map.grid!;
  const pts = (map.blocks ?? []).flatMap((b) => b.corners.map((p) => toWorld(g, p)));
  if (!pts.length) return;
  const pad = CELL * 1.2;
  const x0 = Math.min(...pts.map((p) => p.x)) - pad;
  const x1 = Math.max(...pts.map((p) => p.x)) + pad;
  const z0 = Math.min(...pts.map((p) => p.z)) - pad;
  const z1 = Math.max(...pts.map((p) => p.z)) + pad;
  const mud = BIOMES[map.biome].wall[0];
  const H = 4.2;
  const T = 1.4;
  const step = 2;
  const sides: [number, number, number, number][] = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
  for (const [ax, az, bx, bz] of sides) {
    const len = Math.hypot(bx - ax, bz - az);
    const along = az === bz;
    let runStart: number | null = null;
    let gateOpen = false;
    const flush = (end: number) => {
      if (runStart === null) return;
      const a = runStart;
      const m = (a + end) / 2;
      const x = ax + ((bx - ax) * m) / len;
      const z = az + ((bz - az) * m) / len;
      const l = end - a;
      const kit = kitAt(x, z);
      kit.box(along ? l : T, H, along ? T : l, x, 0, z, mud);
      kit.box(along ? l : T + 0.3, 0.4, along ? T + 0.3 : l, x, H, z, mud);
      runStart = null;
    };
    for (let d = 0; d <= len; d += step) {
      const x = ax + ((bx - ax) * d) / len;
      const z = az + ((bz - az) * d) / len;
      const road = ["a", "r", "t", "b"].includes(cellAtWorld(x, z));
      if (road) {
        flush(Math.max(d - 1, 0));
        if (!gateOpen) {
          // The gate: two horned towers either side of the road and a lintel over it.
          gateOpen = true;
          const kit = kitAt(x, z);
          const ox = along ? 1 : 0;
          const oz = along ? 0 : 1;
          for (const s of [-1, 1]) {
            const tx = x + ox * s * (CELL / 2 + 1.4) + (along ? CELL / 2 - 1 : 0);
            const tz = z + oz * s * (CELL / 2 + 1.4) + (along ? 0 : CELL / 2 - 1);
            kit.box(3, H + 2.4, 3, tx, 0, tz, mud);
            for (const cx of [-1, 1]) for (const cz of [-1, 1]) kit.cyl(0.05, 0.35, 1.1, tx + cx * 1.3, H + 2.4, tz + cz * 1.3, mud, 6);
          }
          const lx = x + (along ? CELL / 2 - 1 : 0);
          const lz = z + (along ? 0 : CELL / 2 - 1);
          kit.box(along ? CELL + 2.4 : 3, 1.6, along ? 3 : CELL + 2.4, lx, H + 0.8, lz, mud);
          kit.box(along ? 2.4 : 0.1, 0.5, along ? 0.1 : 2.4, lx, H + 1.2, lz + (along ? 1.56 : 0), "#26355E");
        }
      } else {
        gateOpen = false;
        if (runStart === null) runStart = d;
      }
    }
    flush(len);
    // A round tower at each corner.
    kitAt(ax, az).cyl(2.0, 2.4, H + 1.6, ax, 0, az, mud, 10);
  }
}

/** One open block: school pitches, a park, a campus lawn or the airfield. */
/** Spots on open ground where no trees grow (a stadium's bowl). Set while a scene is built. */
const keepOut: { x: number; z: number; r: number }[] = [];

function openBlock(kit: Kit, map: WorldMap, zone: ZoneKind, cx: number, cz: number, w: number, d: number, R: () => number, fields: BuiltScene["fields"], flip = false) {
  const y = PLOT_H + 0.02;
  const ctx: BuildCtx = { kit, biome: map.biome, district: "mixed", rnd: R };
  const trees = BIOMES[map.biome].trees;
  const ring = (n: number) => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const side = Math.floor(t * 4);
      const k = (t * 4) % 1;
      const x = side === 0 ? cx - w / 2 + k * w : side === 2 ? cx + w / 2 - k * w : side === 1 ? cx + w / 2 - 1 : cx - w / 2 + 1;
      const z = side === 1 ? cz - d / 2 + k * d : side === 3 ? cz + d / 2 - k * d : side === 0 ? cz - d / 2 + 1 : cz + d / 2 - 1;
      tree(ctx, trees[i % 3] || "neem", x, z, 0.9 + R() * 0.3);
    }
  };
  if (zone === "airport") {
    airport(kit, cx, cz, w, d, y, R, flip);
    return;
  }
  if (zone === "park") {
    kit.box(w, 0.03, 1.6, cx, y, cz, "#E2D8C3");
    kit.box(1.6, 0.03, d, cx, y, cz, "#E2D8C3");
    kit.cyl(2.6, 2.8, 0.6, cx, y, cz, "#B9B3A8", 14);
    kit.cyl(2.3, 2.3, 0.62, cx, y, cz, "#5F97A1", 14);
    const n = Math.round((w * d) / 60);
    for (let i = 0; i < n; i++) {
      const x = cx + (R() - 0.5) * (w - 4);
      const z = cz + (R() - 0.5) * (d - 4);
      if (Math.abs(x - cx) < 2.5 || Math.abs(z - cz) < 2.5) continue;
      if (keepOut.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
      tree(ctx, trees[i % 3] || "neem", x, z, 0.9 + R() * 0.5);
    }
    for (let i = 0; i < 4; i++) kit.box(2, 0.45, 0.6, cx + (i < 2 ? -6 : 6), y, cz + (i % 2 ? 3 : -3), "#8C6A4A");
    playground(ctx, cx + Math.min(14, w / 4), cz - Math.min(10, d / 4), y);
    foodCourt(ctx, cx - Math.min(14, w / 4), cz + Math.min(10, d / 4), y);
    fields.push({ x: cx, z: cz, w: w * 0.6, d: d * 0.6 });
    return;
  }
  // Schools and campuses: proper football pitches with goals, laid out across the block.
  const along = w >= d;
  const pw = Math.min(along ? w / 2 - 4 : w - 8, 36);
  const pd = Math.min(along ? d - 8 : d / 2 - 4, 24);
  const centres = along ? [[cx - w / 4, cz], [cx + w / 4, cz]] : [[cx, cz - d / 4], [cx, cz + d / 4]];
  const count = zone === "campus" ? 1 : 2;
  for (const [px, pz] of centres.slice(0, count)) {
    const x = count === 1 ? cx : px;
    const z = count === 1 ? cz : pz;
    kit.box(pw, 0.03, pd, x, y, z, "#5FA049");
    for (const s of [-1, 1]) kit.box(0.15, 0.02, pd, x + s * (pw / 2 - 0.1), y + 0.03, z, "#F4F1EA");
    for (const s of [-1, 1]) kit.box(pw, 0.02, 0.15, x, y + 0.03, z + s * (pd / 2 - 0.1), "#F4F1EA");
    kit.box(0.15, 0.02, pd, x, y + 0.03, z, "#F4F1EA");
    kit.cyl(3.0, 3.0, 0.02, x, y + 0.03, z, "#F4F1EA", 20);
    kit.cyl(2.85, 2.85, 0.03, x, y + 0.03, z, "#5FA049", 20);
    for (const s of [-1, 1]) {
      const gx = x + s * (pw / 2 - 0.2);
      kit.box(0.12, 1.6, 0.12, gx, y, z - 2.2, "#FFFFFF");
      kit.box(0.12, 1.6, 0.12, gx, y, z + 2.2, "#FFFFFF");
      kit.box(0.12, 0.12, 4.5, gx, y + 1.6, z, "#FFFFFF");
    }
    fields.push({ x, z, w: pw, d: pd });
  }
  if (zone === "campus") for (let i = 0; i < 6; i++) figure(ctx, cx + (R() - 0.5) * w * 0.6, cz + d / 2 - 3, ["#26355E", "#2E7D4F", "#8C2F5A"][i % 3]);
  // A basketball court: between the two pitches at a school, beside the pitch on a campus.
  if (count === 2) court(kit, along ? cx : cx, along ? cz : cz, y, along, R);
  else court(kit, cx + (along ? w / 2 - 10 : 0), cz + (along ? 0 : d / 2 - 10), y, !along, R);
  ring(Math.round((w + d) / 6));
  car(ctx, cx - w / 2 + 3, cz + d / 2 - 3, 0);
}

/** A children's playground: swings, a slide, a see-saw, a roundabout and children playing. */
function playground(c: BuildCtx, x: number, z: number, y: number) {
  const { kit, rnd } = c;
  kit.box(12, 0.04, 9, x, y, z, "#D9B98A");
  // Swings: an A-frame and two seats on their chains.
  for (const dx of [-2.2, 2.2]) {
    kit.slab(0.12, 3.0, 0.12, x - 3 + dx, y + 1.4, z - 2.8, "#C0392B", 0, 0, dx > 0 ? 0.2 : -0.2);
    kit.slab(0.12, 3.0, 0.12, x - 3 + dx, y + 1.4, z - 2.0, "#C0392B", 0, 0, dx > 0 ? 0.2 : -0.2);
  }
  kit.box(4.2, 0.12, 0.12, x - 3, y + 2.85, z - 2.4, "#C0392B");
  for (const dx of [-0.8, 0.8]) {
    kit.box(0.03, 1.9, 0.03, x - 3 + dx, y + 0.9, z - 2.4, "#555");
    kit.box(0.6, 0.06, 0.3, x - 3 + dx, y + 0.85, z - 2.4, "#F2B705");
  }
  // A slide with its ladder.
  kit.box(0.9, 2.0, 0.9, x + 2.5, y, z - 2.6, "#2B5C9A");
  kit.slab(0.9, 0.08, 3.4, x + 2.5, y + 1.05, z - 0.9, "#F2B705", -0.62);
  // A see-saw and a roundabout.
  kit.box(0.3, 0.5, 0.3, x - 3, y, z + 2.2, "#555");
  kit.slab(3.4, 0.1, 0.3, x - 3, y + 0.6, z + 2.2, "#2E7D4F", 0, 0, 0.18);
  kit.cyl(1.3, 1.3, 0.15, x + 2.4, y + 0.3, z + 2.2, "#C0392B", 12);
  kit.cyl(0.08, 0.08, 1.2, x + 2.4, y + 0.3, z + 2.2, "#F2B705", 6);
  // Children everywhere, and a mother on the bench.
  for (let i = 0; i < 9; i++) figure(c, x + (rnd() - 0.5) * 10, z + (rnd() - 0.5) * 7, pick(["#C0392B", "#2B5C9A", "#F2B705", "#2E7D4F", "#8C2F5A"], rnd), 0.62);
  figure(c, x + 5.2, z + 3.6, "#8C2F5A", 1, true);
}

const pick = <T,>(list: T[], rnd: () => number) => list[Math.floor(rnd() * list.length) % list.length];

/** A parked passenger plane, nose along +x before turning. */
/** A twin-engine jet in an airline's colours, nose along +x before turning by ry. */
function plane(kit: Kit, x: number, z: number, ry: number, y: number, livery = "#118A4F", scale = 1) {
  const c = Math.cos(ry);
  const sn = Math.sin(ry);
  const k = scale;
  const at = (dx: number, dz: number): [number, number] => [x + (dx * c + dz * sn) * k, z + (-dx * sn + dz * c) * k];
  const put = (g: BufferGeometry, col: string, dx: number, dy: number, dz: number, rx = 0, rz = 0, extra = 0) => {
    const [px, pz] = at(dx, dz);
    g.scale(k, k, k);
    kit.add(g, col, px, y + dy * k, pz, ry + extra, rx, rz);
  };
  // Fuselage, nose and tail cones, the livery stripe and the cabin windows.
  put(new CylinderGeometry(1.1, 1.1, 16, 14), "#F4F1EA", 0, 2.6, 0, 0, Math.PI / 2);
  put(new CylinderGeometry(0.05, 1.1, 2.4, 14), "#F4F1EA", 9.2, 2.6, 0, 0, -Math.PI / 2);
  put(new CylinderGeometry(1.1, 0.25, 3.4, 14), "#F4F1EA", -9.7, 2.9, 0, 0, Math.PI / 2);
  put(new BoxGeometry(17, 0.35, 2.24), livery, 0, 2.15, 0);
  put(new BoxGeometry(14, 0.28, 2.26), "#2F3D48", 0.6, 3.0, 0);
  put(new BoxGeometry(1.2, 0.5, 2.0), "#1B2430", 9.0, 3.05, 0);
  // Swept wings, engines under them, tailplane and the tall fin in the livery.
  for (const side of [-1, 1]) {
    put(new BoxGeometry(3.6, 0.3, 9), "#E6E2D8", -0.6, 2.0, side * 5, 0, 0, side * -0.32);
    put(new CylinderGeometry(0.75, 0.65, 2.6, 12), "#C9CED3", 1.4, 1.35, side * 3.6, 0, Math.PI / 2);
    put(new BoxGeometry(1.4, 0.2, 3.2), "#E6E2D8", -9.4, 3.2, side * 1.8, 0, 0, side * -0.3);
  }
  put(new BoxGeometry(2.6, 3.6, 0.3), livery, -9.6, 4.9, 0);
  // Landing gear.
  for (const [dx, dz] of [[7.5, 0], [-1, 1.4], [-1, -1.4]]) put(new BoxGeometry(0.3, 1.5, 0.3), "#2B2F36", dx, 0.75, dz);
}

/**
 * The airport: a sweeping glass terminal under a wave roof with jet bridges to the stands, jets parked in
 * airline colours, the runway with its markings, taxiways, a modern control tower, hangars, the fuel farm
 * and the car park with taxis.
 */
function airport(kit: Kit, cx: number, cz: number, w: number, d: number, y: number, R: () => number, flip = false) {
  const long = w >= d;
  // Work in a frame where the runway runs along x: (along, across).
  const L = (long ? w : d) - 4;
  const D = long ? d : w;
  const sv = flip ? 1 : -1;
  // v runs from the runway (v < 0) to the terminal (v > 0); flipped, the terminal faces the other side.
  const P = (u: number, v: number): [number, number] => (long ? [cx + u, cz - sv * v] : [cx - sv * v, cz + u]);
  const box = (lw: number, h: number, ld: number, u: number, yy: number, v: number, col: string, turn = 0) => {
    const [px, pz] = P(u, v);
    kit.box(long ? lw : ld, h, long ? ld : lw, px, yy, pz, col, turn);
  };
  // Grass between the paved areas.
  box(L + 4, 0.025, D, 0, y, 0, "#8DB866");
  // Runway with centre line, threshold stripes and edge lines.
  const rv = -D / 2 + 7;
  box(L, 0.04, 9, 0, y, rv, "#2F3236");
  for (let u = -L / 2 + 10; u < L / 2 - 10; u += 7) box(4, 0.02, 0.3, u, y + 0.045, rv, "#F4F1EA");
  for (const e of [-1, 1]) {
    box(L, 0.02, 0.2, 0, y + 0.045, rv + e * 4.2, "#F4F1EA");
    for (let i = 0; i < 6; i++) box(4, 0.02, 0.5, e * (L / 2 - 4), y + 0.045, rv - 3 + i * 1.2, "#F4F1EA");
  }
  // Taxiway and the apron, with yellow guide lines to each stand.
  box(L * 0.8, 0.04, 4, 0, y, rv + 8, "#45484C");
  box(L * 0.8, 0.02, 0.15, 0, y + 0.045, rv + 8, "#F2B705");
  const apronV = rv + 17;
  box(L * 0.7, 0.04, 14, 0, y, apronV, "#8F949A");
  // The terminal: a long glass hall under a wave roof, set back behind the apron.
  const tv = apronV + 12;
  const TL = L * 0.55;
  box(TL, 6, 7, 0, y, tv, "#7FB3D5");
  box(TL + 0.4, 0.4, 7.4, 0, y, tv, "#E6E2D8");
  for (let i = 0; i <= 12; i++) {
    const u = -TL / 2 + (i * TL) / 12;
    box(0.25, 6, 7.1, u, y, tv, "#E6E2D8");
    // The wave: roof panels rising and falling along the hall.
    box(TL / 12 + 0.2, 0.35, 9, u + TL / 24, y + 6.2 + Math.sin(i * 0.9) * 1.1, tv, "#F4F1EA");
  }
  // Jet bridges from the terminal out to the stands, a jet at each.
  const liveries = ["#118A4F", "#C0392B", "#2B5C9A", "#8C2F5A"];
  const stands = 4;
  for (let i = 0; i < stands; i++) {
    const u = -TL / 2 + TL / (stands * 2) + (i * TL) / stands;
    box(1.6, 2.2, 7, u, y + 2.4, tv - 6.5, "#C9CED3");
    box(0.3, 2.4, 0.3, u, y, tv - 9.5, "#5E6B73");
    const [px, pz] = P(u, apronV - 1);
    plane(kit, px, pz, long ? Math.PI / 2 : 0, y, liveries[i % liveries.length], 0.62);
  }
  // Departures and arrivals road in front, taxis waiting.
  box(TL, 0.04, 4, 0, y, tv + 6, "#45484C");
  const ctx: BuildCtx = { kit, biome: "savanna", district: "mixed", rnd: R };
  for (let i = 0; i < 5; i++) {
    const [px, pz] = P(-TL / 2 + 4 + i * 6, tv + 6);
    car(ctx, px, pz, long ? 0 : Math.PI / 2, i % 2 ? "#F2B705" : "#2B2F36");
  }
  // Car park with rows of cars.
  const parkU = TL / 2 + 10;
  box(14, 0.04, 12, parkU, y, tv, "#55565A");
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
    if (R() < 0.25) continue;
    const [px, pz] = P(parkU - 5 + k * 3.2, tv - 4 + r * 4);
    car(ctx, px, pz, long ? Math.PI / 2 : 0);
  }
  // The control tower: a tall slim shaft with a flared glass cab.
  {
    const [px, pz] = P(-TL / 2 - 9, tv - 2);
    kit.cyl(1.0, 1.6, 18, px, y, pz, "#E6E2D8", 12);
    kit.cyl(2.8, 1.8, 1.6, px, y + 18, pz, "#E6E2D8", 12);
    kit.cyl(3.0, 2.6, 2.4, px, y + 19.6, pz, "#4F7FA6", 12);
    kit.cyl(3.2, 3.2, 0.4, px, y + 22, pz, "#F4F1EA", 12);
    kit.cyl(0.08, 0.08, 3.5, px, y + 22.4, pz, "#C0392B", 6);
    kit.ball(0.35, px, y + 26, pz, "#C0392B");
  }
  // Hangars with curved roofs, one with a plane inside.
  for (let i = 0; i < 2; i++) {
    const u = L / 2 - 14 - i * 16;
    box(13, 6, 11, u, y, apronV + 2, "#9AA3AD");
    const [px, pz] = P(u, apronV + 2);
    const roof = new CylinderGeometry(6.6, 6.6, 11.2, 16, 1, false, 0, Math.PI);
    roof.scale(1, 0.45, 1);
    kit.add(roof, "#7E8792", px, y + 6, pz, long ? 0 : Math.PI / 2, Math.PI / 2, 0);
    box(10, 5, 0.1, u, y, apronV + 2 - 5.55, "#2B2F36");
  }
  // The fuel farm: round tanks and a tanker.
  for (let i = 0; i < 3; i++) {
    const [px, pz] = P(-L / 2 + 8 + i * 4.5, apronV + 4);
    kit.cyl(1.9, 1.9, 3.2, px, y, pz, "#F4F1EA", 14);
    kit.cyl(1.95, 1.95, 0.3, px, y + 3.2, pz, "#C0392B", 14);
  }
  // Windsock by the runway.
  {
    const [px, pz] = P(L / 2 - 6, rv + 6);
    kit.cyl(0.06, 0.06, 4, px, y, pz, "#DDD", 6);
    kit.cyl(0.25, 0.1, 1.4, px + 0.7, y + 3.8, pz, "#E67E22", 8, 0, Math.PI / 2);
  }
}

/** A basketball court: a concrete slab with its lines, a hoop at each end and a few players. */
function court(kit: Kit, x: number, z: number, y: number, alongZ: boolean, R: () => number) {
  const L = 15;
  const Wd = 8;
  const [w, d] = alongZ ? [Wd, L] : [L, Wd];
  kit.box(w + 1, 0.04, d + 1, x, y, z, "#B9B3A8");
  kit.box(w, 0.045, d, x, y + 0.01, z, "#C0602A");
  for (const s of [-1, 1]) {
    // Side lines, the half-way line and the keys.
    if (alongZ) kit.box(0.08, 0.05, d, x + s * (w / 2 - 0.05), y + 0.02, z, "#F4F1EA");
    else kit.box(w, 0.05, 0.08, x, y + 0.02, z + s * (d / 2 - 0.05), "#F4F1EA");
    const kx = alongZ ? x : x + s * (L / 2 - 2.5);
    const kz = alongZ ? z + s * (L / 2 - 2.5) : z;
    kit.box(alongZ ? 3.6 : 5, 0.05, alongZ ? 5 : 3.6, kx, y + 0.015, kz, "#9C4A20");
    // The hoop: a pole, the backboard and the ring.
    const hx = alongZ ? x : x + s * (L / 2 + 0.3);
    const hz = alongZ ? z + s * (L / 2 + 0.3) : z;
    kit.cyl(0.08, 0.1, 3.05, hx, y, hz, "#3A3F45", 8);
    const bx = alongZ ? x : x + s * (L / 2 - 0.1);
    const bz = alongZ ? z + s * (L / 2 - 0.1) : z;
    kit.box(alongZ ? 1.8 : 0.06, 1.05, alongZ ? 0.06 : 1.8, bx, y + 2.9, bz, "#F4F1EA");
    const rx = alongZ ? x : x + s * (L / 2 - 0.5);
    const rz = alongZ ? z + s * (L / 2 - 0.5) : z;
    kit.add(new TorusGeometry(0.23, 0.025, 6, 16), "#E67E22", rx, y + 3.05, rz, 0, Math.PI / 2);
  }
  if (alongZ) kit.box(w, 0.05, 0.08, x, y + 0.02, z, "#F4F1EA");
  else kit.box(0.08, 0.05, d, x, y + 0.02, z, "#F4F1EA");
  const ctx = { kit, biome: "savanna" as const, district: "mixed", rnd: R };
  for (let i = 0; i < 5; i++) figure(ctx, x + (R() - 0.5) * (w - 2), z + (R() - 0.5) * (d - 2), ["#C0392B", "#2B5C9A", "#F2B705", "#2E7D4F"][i % 4], 1);
}

/**
 * A university out of town (KWASU at Malete): its own access road off the highway through a gate arch,
 * a ring road round the campus, the senate building in the middle with the sports ground beside it,
 * faculties and halls round the ring, and private student hostels (Westend, Safari) just outside.
 */
function outCampus(kit: Kit, map: WorldMap, face: Facing, x: number, z: number, R: () => number, fields: BuiltScene["fields"], labels: BuiltScene["labels"]) {
  const [fx, fz] = DIRS[face];
  // Across the road: s runs along it. The campus lies away from the street, beside the gatehouse plot.
  const sx = -fz;
  const sz = fx;
  const size = CELL * 7;
  const off = CELL * 4.5;
  const cx = x - fx * off + sx * CELL;
  const cz = z - fz * off + sz * CELL;
  const ctx: BuildCtx = { kit, biome: map.biome, district: "mixed", rnd: R };
  const ROADC = "#55565A";
  const y = PLOT_H;
  kit.box(size, PLOT_H, size, cx, 0, cz, SOIL);
  kit.box(size - 0.04, 0.02, size - 0.04, cx, y, cz, "#A3C47A");

  // The access road from the highway, beside the gatehouse, into the campus.
  const gx = x + sx * CELL;
  const gz = z + sz * CELL;
  const reach = off - size / 2 + 6;
  const ax = gx - (fx * reach) / 2;
  const az = gz - (fz * reach) / 2;
  kit.box(fx ? reach : 6, 0.06, fz ? reach : 6, ax, y - 0.02, az, ROADC);
  // The gate arch over it, in the university's blue and gold.
  for (const k of [-3.6, 3.6]) kit.box(0.9, 5.5, 0.9, gx - fx * 2 + sx * k, y, gz - fz * 2 + sz * k, "#E6E2D8");
  kit.box(fx ? 1.2 : 8.4, 1.2, fz ? 1.2 : 8.4, gx - fx * 2, y + 5.5, gz - fz * 2, "#26355E");
  kit.box(fx ? 1.25 : 8.6, 0.25, fz ? 1.25 : 8.6, gx - fx * 2, y + 5.3, gz - fz * 2, "#F2B705");

  // The ring road inside the campus edge.
  const ring = size / 2 - 6;
  for (const [dx, dz, w, d] of [[0, -ring, ring * 2 + 6, 6], [0, ring, ring * 2 + 6, 6], [-ring, 0, 6, ring * 2 + 6], [ring, 0, 6, ring * 2 + 6]] as const) {
    kit.box(w, 0.06, d, cx + dx, y - 0.01, cz + dz, ROADC);
  }
  for (let t = -ring; t < ring; t += 6) {
    kit.box(2.4, 0.02, 0.2, cx + t, y + 0.03, cz - ring, "#F2EEE4");
    kit.box(2.4, 0.02, 0.2, cx + t, y + 0.03, cz + ring, "#F2EEE4");
  }

  // The senate building in the middle, faculties and halls round the ring.
  const turn = new Matrix4();
  const put = (kind: string, dx: number, dz: number, ry: number, salt: number) => {
    kit.frame.makeRotationY(ry).premultiply(turn.makeTranslation(cx + dx, y, cz + dz));
    build(kind, { ...ctx, rnd: rng(seedAt(cx + dx, cz + dz, salt)) });
    kit.frame.identity();
  };
  put("govhouse", 0, -8, 0, 1);
  const inner = ring - 8;
  const outer = ring + 8.5;
  for (const t of [-20, 0, 20]) {
    put(t === 0 ? "office" : "school", t, -outer, 0, 2);
    put("flats", t, outer, Math.PI, 3);
  }
  for (const t of [-14, 14]) {
    put("school", -outer, t, Math.PI / 2, 4);
    put("office", outer, t, -Math.PI / 2, 5);
  }
  void inner;

  // The sports ground: a pitch and a basketball court on the lawn inside the ring.
  const yy = y + 0.02;
  kit.box(18, 0.03, 11, cx - 5, yy, cz + 9, "#5FA049");
  kit.box(0.12, 0.02, 11, cx - 5, yy + 0.03, cz + 9, "#F4F1EA");
  for (const k of [-1, 1]) {
    kit.box(0.12, 1.6, 0.12, cx - 5 + k * 8.8, yy, cz + 7.2, "#FFFFFF");
    kit.box(0.12, 1.6, 0.12, cx - 5 + k * 8.8, yy, cz + 10.8, "#FFFFFF");
    kit.box(0.12, 0.12, 3.7, cx - 5 + k * 8.8, yy + 1.6, cz + 9, "#FFFFFF");
  }
  fields.push({ x: cx - 5, z: cz + 9, w: 18, d: 11 });
  court(kit, cx + 12, cz + 9, yy, true, R);
  for (let i = 0; i < 22; i++) {
    const tx = cx + (R() - 0.5) * (inner * 2);
    const tz = cz + (R() - 0.5) * (inner * 2);
    if (Math.abs(tz - cz - 9) < 7 || Math.abs(tz - cz + 8) < 6) continue;
    tree(ctx, BIOMES[map.biome].trees[i % 3] || "neem", tx, tz, 0.9 + R() * 0.3);
  }
  for (let i = 0; i < 14; i++) figure(ctx, cx + (R() - 0.5) * 26, cz + (R() - 0.5) * 6 - 1, ["#26355E", "#2E7D4F", "#8C2F5A", "#F4F1EA"][i % 4], 1);
  labels.push({ text: "KWASU Senate", x: cx, y: y + 14, z: cz - 8 });

  // Private hostels just outside the campus, where most students live.
  const hostels: [string, number][] = [["Westend Hostel", -1], ["Safari Hostel", 1]];
  for (const [name, side] of hostels) {
    const hx = cx + sx * side * (size / 2 + 8) + fx * 6;
    const hz = cz + sz * side * (size / 2 + 8) + fz * 6;
    kit.box(18, PLOT_H, 18, hx, 0, hz, SOIL);
    kit.box(17.9, 0.02, 17.9, hx, y, hz, "#D6CCBC");
    for (const [dx, dz] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) {
      kit.frame.makeRotationY(face * (Math.PI / 2)).premultiply(turn.makeTranslation(hx + dx, y, hz + dz));
      build("flats", { ...ctx, district: "mixed", rnd: rng(seedAt(hx + dx, hz + dz, 7)) });
      kit.frame.identity();
    }
    labels.push({ text: name, x: hx, y: y + 15, z: hz });
  }
}

/**
 * A full stadium: an oval bowl of tiered stands in green and white round a pitch with its running track,
 * a covered main stand, floodlight towers at the corners. It stands on the open ground behind its plot
 * (the plot keeps the ticket office by the road).
 */
function bigStadium(kit: Kit, face: Facing, x: number, z: number, fields: BuiltScene["fields"]) {
  const [fx, fz] = DIRS[face];
  const cx = x - fx * CELL * 2.6;
  const cz = z - fz * CELL * 2.6;
  // The long side runs along the road.
  const along = fx !== 0;
  const RX = along ? 14 : 18;
  const RZ = along ? 18 : 14;
  const y = PLOT_H;
  kit.box(RX * 2 + 6, PLOT_H, RZ * 2 + 6, cx, 0, cz, SOIL);
  kit.box(RX * 2 + 5.9, 0.02, RZ * 2 + 5.9, cx, y, cz, "#CEC6B6");
  // Track and pitch.
  kit.add(new CylinderGeometry(1, 1, 0.04, 40).scale(RX - 4, 1, RZ - 4), "#B5532E", cx, y + 0.02, cz);
  const pw = along ? (RX - 7) * 2 : (RX - 7) * 1.7;
  const pd = along ? (RZ - 7) * 1.7 : (RZ - 7) * 2;
  kit.box(pw, 0.05, pd, cx, y + 0.04, cz, "#4F9A3E");
  for (let i = 0; i < 6; i++) kit.box(along ? pw : pw / 6, 0.051, along ? pd / 6 : pd, along ? cx : cx - pw / 2 + pw / 12 + (i * pw) / 6, y + 0.04, along ? cz - pd / 2 + pd / 12 + (i * pd) / 6 : cz, i % 2 ? "#4F9A3E" : "#5BA848");
  kit.box(along ? pw : 0.12, 0.06, along ? 0.12 : pd, cx, y + 0.07, cz, "#F4F1EA");
  kit.add(new TorusGeometry(2.4, 0.06, 4, 32), "#F4F1EA", cx, y + 0.08, cz, 0, Math.PI / 2);
  for (const sgn of [-1, 1]) {
    const gx = along ? cx : cx + sgn * (pw / 2 - 0.1);
    const gz = along ? cz + sgn * (pd / 2 - 0.1) : cz;
    for (const k of [-1.8, 1.8]) kit.box(0.12, 1.8, 0.12, along ? gx + k : gx, y, along ? gz : gz + k, "#FFFFFF");
    kit.box(along ? 3.7 : 0.12, 0.12, along ? 0.12 : 3.7, gx, y + 1.8, gz, "#FFFFFF");
  }
  fields.push({ x: cx, z: cz, w: pw, d: pd });
  // Tiered stands: rings of seat slabs, rising and widening outwards, green and white blocks.
  const segs = 36;
  for (let tier = 0; tier < 4; tier++) {
    const rx = RX - 3 + tier * 1.1;
    const rz = RZ - 3 + tier * 1.1;
    const h = 0.9 + tier * 1.1;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const px = cx + Math.cos(a) * rx;
      const pz = cz + Math.sin(a) * rz;
      const len = (2 * Math.PI * Math.max(rx, rz)) / segs + 0.4;
      const turn = Math.atan2(Math.cos(a) * rz, -Math.sin(a) * rx);
      kit.box(len, h, 1.2, px, y, pz, Math.floor(i / 3) % 2 ? "#2E7D4F" : "#F4F1EA", turn);
    }
  }
  // Outer wall round the bowl.
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const turn = Math.atan2(Math.cos(a) * (RZ + 2), -Math.sin(a) * (RX + 2));
    kit.box((2 * Math.PI * Math.max(RX, RZ)) / segs + 0.6, 4.6, 0.5, cx + Math.cos(a) * (RX + 1.6), y, cz + Math.sin(a) * (RZ + 1.6), "#D8D0C0", turn);
  }
  // The covered main stand on the road side, under a sloping roof on columns.
  const sx = cx + fx * (RX - 1.5) * (along ? 1 : 0) + (along ? 0 : 0);
  const sz = cz + fz * (RZ - 1.5) * (along ? 0 : 1);
  const mx = along ? cx + fx * (RX + 0.5) : cx;
  const mz = along ? cz : cz + fz * (RZ + 0.5);
  void sx;
  void sz;
  const roofLen = along ? RZ * 1.4 : RX * 1.4;
  kit.box(along ? 5 : roofLen, 0.3, along ? roofLen : 5, mx - fx * 1.2, y + 7.2, mz - fz * 1.2, "#C9C3B6");
  for (let k = -2; k <= 2; k++) kit.box(0.35, 7.2, 0.35, along ? mx + fx * 1 : mx + k * (roofLen / 5), y, along ? mz + k * (roofLen / 5) : mz + fz * 1, "#8E979F");
  // Floodlights at the four corners.
  for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = cx + ax * (RX + 1);
    const lz = cz + az * (RZ + 1);
    kit.cyl(0.25, 0.35, 16, lx, y, lz, "#5E6B73", 8);
    kit.box(2.6, 1.6, 0.3, lx, y + 16, lz, "#F4F1EA", Math.atan2(cx - lx, cz - lz));
  }
}

/** A food court in the park: a row of food stalls under awnings, umbrellas and tables, people eating. */
function foodCourt(c: BuildCtx, x: number, z: number, y: number) {
  const { kit, rnd } = c;
  const names = ["#E67E22", "#C0392B", "#2E7D4F", "#2B5C9A", "#8C2F5A"];
  kit.box(16, 0.04, 9, x, y, z, "#D8D0C0");
  for (let i = 0; i < 5; i++) {
    const sx = x - 6.4 + i * 3.2;
    const sz = z - 3.2;
    kit.box(2.8, 2.2, 1.8, sx, y, sz, "#F4EFE4");
    kit.box(2.6, 0.9, 0.08, sx, y + 0.8, sz + 0.92, "#2F3D48");
    kit.slab(3.2, 0.08, 1.4, sx, y + 2.35, sz + 1.3, names[i], 0.3);
    kit.box(2.4, 0.5, 0.1, sx, y + 2.4, sz - 0.2, names[i]);
    figure(c, sx, sz + 0.5, "#F4F1EA", 1);
  }
  // Tables with umbrellas and diners.
  for (let i = 0; i < 4; i++) {
    const tx = x - 5 + i * 3.4;
    const tz = z + 1.8;
    kit.cyl(0.04, 0.04, 2.0, tx, y, tz, "#DDD", 6);
    kit.cyl(0.02, 1.1, 0.45, tx, y + 2.0, tz, names[(i + 2) % 5], 8);
    kit.cyl(0.5, 0.5, 0.06, tx, y + 0.72, tz, "#F4F1EA", 10);
    kit.cyl(0.05, 0.05, 0.72, tx, y, tz, "#8E979F", 6);
    for (const k of [-0.75, 0.75]) {
      kit.box(0.4, 0.42, 0.4, tx + k, y, tz, "#C0392B");
      if (rnd() < 0.75) figure(c, tx + k, tz, pick(names, rnd), 1, true);
    }
  }
}

/** How far behind its plot the villa compound's frame sits: its gate (v = -15) is at the plot's back edge. */
const VILLA_BACK = 15 + CELL / 2;

/** Whether a point is on Aso Rock's ground: the walled compound or the massif and its scrub. */
function villaCovers(face: Facing, x: number, z: number, px: number, pz: number) {
  const [fx, fz] = DIRS[face];
  const dx = px - (x - fx * VILLA_BACK);
  const dz = pz - (z - fz * VILLA_BACK);
  const u = dx * -fz + dz * fx;
  const v = -(dx * fx + dz * fz);
  return (Math.abs(u) < 31 && v > -14.5 && v < 22) || Math.hypot(u, v - 62) < 50;
}

/** A frame beside a roadside plot: u runs along the road, v away from it (v > 0 is behind the plot). */
function behind(face: Facing, x: number, z: number, back: number) {
  const [fx, fz] = DIRS[face];
  const ax = -fz;
  const az = fx;
  const cx = x - fx * back;
  const cz = z - fz * back;
  const at = (u: number, v: number): [number, number] => [cx + ax * u - fx * v, cz + az * u - fz * v];
  return { at, turn: Math.atan2(fx, fz), alongX: ax !== 0 };
}

/**
 * A grand train station behind its roadside entrance: the station hall with a clock tower, three platforms
 * under long canopies, the tracks running past and a full train at the platform, a car park with taxis.
 */
function bigStation(kit: Kit, map: WorldMap, face: Facing, x: number, z: number, R: () => number) {
  const F = behind(face, x, z, CELL * 2.6);
  const y = PLOT_H;
  const box = (lw: number, h: number, ld: number, u: number, yy: number, v: number, col: string) => {
    const [px, pz] = F.at(u, v);
    kit.box(F.alongX ? lw : ld, h, F.alongX ? ld : lw, px, yy, pz, col);
  };
  box(46, PLOT_H, 34, 0, 0, 6, SOIL);
  box(45.9, 0.02, 33.9, 0, y, 6, "#CEC6B6");
  // The station hall, facing the road, with its clock tower.
  box(24, 9, 8, 0, y, -6, "#E8DCC4");
  box(24.6, 0.6, 8.6, 0, y + 9, -6, "#B5532E");
  for (let i = 0; i < 7; i++) box(1.6, 4.2, 0.1, -9 + i * 3, y + 0.4, -10.05, "#2F3D48");
  box(4, 6, 4, 0, y + 9, -6, "#E8DCC4");
  {
    const [px, pz] = F.at(0, -8.05);
    kit.cyl(1.2, 1.2, 0.1, px, y + 12.5, pz, "#F4F1EA", 16, Math.PI / 2, 0);
  }
  box(4.4, 0.4, 4.4, 0, y + 15, -6, "#B5532E");
  // Three platforms under long canopies, tracks between them, a train at the first.
  for (let k = 0; k < 3; k++) {
    const v = 4 + k * 7;
    box(42, 0.7, 3, 0, y, v, "#C9C3B6");
    for (let i = 0; i < 6; i++) box(0.3, 3.4, 0.3, -18 + i * 7.2, y + 0.7, v, "#5E6B73");
    box(42, 0.2, 4.4, 0, y + 4.1, v, k % 2 ? "#2E7D4F" : "#B5532E");
    for (const dv of [2.6, 4.4]) box(46, 0.12, 0.15, 0, y, v + dv, "#6E6A64");
  }
  // The train: a locomotive and five coaches in green and white.
  box(5, 3, 2.2, -17, y + 0.4, 7.5, "#C0392B");
  for (let i = 0; i < 5; i++) {
    const u = -10 + i * 6.6;
    box(6.2, 2.6, 2.2, u, y + 0.4, 7.5, "#2E7D4F");
    box(6.22, 0.7, 2.22, u, y + 1.7, 7.5, "#F4F1EA");
    for (let w = 0; w < 4; w++) box(0.9, 0.6, 2.24, u - 2.1 + w * 1.4, y + 1.75, 7.5, "#2F3D48");
  }
  // People on the platforms and taxis in front.
  const ctx: BuildCtx = { kit, biome: map.biome, district: "mixed", rnd: R };
  for (let i = 0; i < 14; i++) {
    const [px, pz] = F.at(-18 + R() * 36, 4 + Math.floor(R() * 3) * 7);
    figure(ctx, px, pz, ["#26355E", "#C0392B", "#2F7D7A", "#F2B705", "#8C2F5A"][i % 5], 1);
  }
  for (let i = 0; i < 4; i++) {
    const [px, pz] = F.at(-15 + i * 4, -12.5);
    car(ctx, px, pz, F.turn + Math.PI / 2, "#F2B705");
  }
}

/** A big bus terminal: a huge canopy over eight bays of coaches and danfos, the terminal building, waiting sheds. */
function bigTerminal(kit: Kit, face: Facing, x: number, z: number, R: () => number) {
  const F = behind(face, x, z, CELL * 2.4);
  const y = PLOT_H;
  const box = (lw: number, h: number, ld: number, u: number, yy: number, v: number, col: string) => {
    const [px, pz] = F.at(u, v);
    kit.box(F.alongX ? lw : ld, h, F.alongX ? ld : lw, px, yy, pz, col);
  };
  box(44, PLOT_H, 30, 0, 0, 4, SOIL);
  box(43.9, 0.03, 29.9, 0, y, 4, "#6F6A64");
  // The terminal building with ticket counters and its name band.
  box(30, 6, 7, 0, y, -6, "#E8DCC4");
  box(30.4, 1.2, 0.2, 0, y + 4.6, -9.6, "#2E7D4F");
  for (let i = 0; i < 6; i++) box(2.2, 2.6, 0.1, -12 + i * 4.8, y + 0.4, -9.55, "#2F3D48");
  // The great canopy on rows of columns.
  for (let i = 0; i < 6; i++) for (const v of [1, 13]) box(0.4, 5.5, 0.4, -18 + i * 7.2, y, v, "#5E6B73");
  box(40, 0.3, 14, 0, y + 5.5, 7, "#2E7D4F");
  box(40.4, 0.3, 0.4, 0, y + 5.8, 7, "#F4F1EA");
  // Eight bays: luxury coaches and danfos lined up, with their bay markings.
  const ctx: BuildCtx = { kit, biome: "savanna", district: "mixed", rnd: R };
  for (let i = 0; i < 8; i++) {
    const u = -17.5 + i * 5;
    box(0.15, 0.02, 9, u - 2.5, y + 0.035, 7, "#F4F1EA");
    if (i % 3 === 2) {
      const [px, pz] = F.at(u, 7);
      danfo(ctx, px, pz, F.turn + Math.PI / 2);
    } else {
      box(2.6, 3.2, 8, u, y + 0.3, 7, "#F4F1EA");
      box(2.62, 0.8, 6.6, u, y + 2.2, 7, "#2F3D48");
      box(2.62, 0.4, 8.02, u, y + 1.2, 7, ["#2B5C9A", "#C0392B", "#2E7D4F"][i % 3]);
    }
  }
  // Waiting shed with benches of travellers, and hawkers.
  box(14, 0.2, 4, 10, y + 3.2, 17, "#B5532E");
  for (let i = 0; i < 4; i++) box(0.2, 3.2, 0.2, 4 + i * 4, y, 17, "#5E6B73");
  for (let i = 0; i < 10; i++) {
    const [px, pz] = F.at(4 + R() * 12, 16 + R() * 2);
    figure(ctx, px, pz, ["#26355E", "#C0392B", "#2F7D7A", "#F2B705", "#8C2F5A"][i % 5], 1, i % 2 === 0);
  }
  for (let i = 0; i < 6; i++) {
    const [px, pz] = F.at(-16 + R() * 32, -1.5);
    figure(ctx, px, pz, "#F4F1EA", 1);
  }
}

/**
 * Aso Rock and the Presidential Villa: the great granite massif rising behind a walled compound with its
 * gate and guardhouse, a drive through lawns to the villa (white, green dome, colonnade), flags, trees.
 */
function asoRock(kit: Kit, map: WorldMap, face: Facing, x: number, z: number, R: () => number) {
  const F = behind(face, x, z, VILLA_BACK);
  const y = PLOT_H;
  const at = F.at;
  const box = (lw: number, h: number, ld: number, u: number, yy: number, v: number, col: string) => {
    const [px, pz] = at(u, v);
    kit.box(F.alongX ? lw : ld, h, F.alongX ? ld : lw, px, yy, pz, col);
  };
  // The compound's lawns, behind a high cream wall.
  box(56, PLOT_H, 34, 0, 0, 2, SOIL);
  box(55.9, 0.03, 33.9, 0, y, 2, "#7FAF5A");
  for (const v of [-15, 19]) box(56, 3, 0.6, 0, y, v, "#EFE6D2");
  for (const u of [-28, 28]) box(0.6, 3, 34, u, y, 2, "#EFE6D2");
  // The gate in the front wall, its guardhouse and the barrier.
  box(8, 0.1, 0.8, 0, y + 3, -15, "#118A4F");
  for (const u of [-4, 4]) box(1.2, 4.5, 1.2, u, y, -15, "#EFE6D2");
  box(3.6, 3, 3, 7, y, -12.5, "#E8DCC4");
  box(4, 0.3, 3.4, 7, y + 3, -12.5, "#118A4F");
  box(5, 0.15, 0.15, 0, y + 1, -15.6, "#C0392B");
  // The drive up to the villa, lined with palms.
  box(5, 0.04, 22, 0, y, -4, "#D8D0C0");
  const ctx: BuildCtx = { kit, biome: map.biome, district: "rich", rnd: R };
  for (let i = 0; i < 6; i++) for (const u of [-4, 4]) {
    const [px, pz] = at(u, -13 + i * 3.6);
    tree(ctx, "palm", px, pz, 1.1);
  }
  // The villa: a long white building with a colonnade and a green dome.
  box(30, 9, 10, 0, y, 10, "#F4F1EA");
  box(31, 0.6, 11, 0, y + 9, 10, "#E6E2D8");
  for (let i = 0; i < 10; i++) {
    const [px, pz] = at(-13.5 + i * 3, 4.6);
    kit.cyl(0.4, 0.45, 8, px, y + 0.5, pz, "#FFFFFF", 10);
  }
  box(30, 0.5, 2, 0, y, 4.6, "#E6E2D8");
  for (let i = 0; i < 9; i++) box(1.6, 3, 0.1, -12 + i * 3, y + 3, 4.95, "#2F3D48");
  {
    const [px, pz] = at(0, 10);
    kit.cyl(4.2, 4.2, 2.2, px, y + 9.6, pz, "#F4F1EA", 20);
    kit.ball(4.4, px, y + 11.8, pz, "#118A4F", 0.8, 1);
    kit.cyl(0.08, 0.08, 4, px, y + 15, pz, "#D4AF37", 6);
  }
  // Flags by the gate and before the villa: green, white, green.
  for (const [u, v] of [[-6, -17], [6, -17], [-10, 2], [10, 2]] as const) {
    const [px, pz] = at(u, v);
    kit.cyl(0.08, 0.1, 8, px, y, pz, "#D8D8D8", 6);
    ["#118A4F", "#F4F1EA", "#118A4F"].forEach((c, i) => kit.box(0.45, 0.9, 0.04, px + 0.3 + i * 0.45, y + 7, pz, c));
  }
  // Aso Rock: a great dome of granite rising behind the compound, with lesser outcrops and scrub.
  const rock = ["#8F877C", "#9C9284", "#7E766C", "#A39A8C"];
  // Its foot clears the compound's back wall (v = 19); the outcrops and scrub spread to its sides and back.
  const [rx, rz] = at(0, 62);
  kit.ball(34, rx, -6, rz, rock[0], 1.15, 2);
  for (let i = 0; i < 9; i++) {
    const [ox, oz] = at(Math.cos((i / 8) * Math.PI) * (20 + R() * 12), 62 + Math.sin((i / 8) * Math.PI) * (20 + R() * 12));
    kit.ball(10 + R() * 9, ox, -2 + R() * 4, oz, rock[i % rock.length], 0.9 + R() * 0.4, 1);
  }
  for (let i = 0; i < 40; i++) {
    const a = -0.3 + R() * (Math.PI + 0.6);
    const r = 30 + R() * 16;
    const [tx, tz] = at(Math.cos(a) * r, 62 + Math.sin(a) * r);
    tree(ctx, R() < 0.5 ? "neem" : "baobab", tx, tz, 0.9 + R() * 0.6);
  }
  // Guards at the gate.
  for (const u of [-2.5, 2.5]) {
    const [px, pz] = at(u, -16.5);
    figure(ctx, px, pz, "#3F6B3A", 1);
  }
}
