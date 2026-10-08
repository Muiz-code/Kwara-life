// Low-poly Nigerian buildings, made in code. Each builder draws one building on its own plot, centred
// on (0, 0) with its front facing +z (the caller turns it to face its street), and stays inside a
// FOOTPRINT-wide square so it never spills onto the road or a neighbour's plot. The plot's seed varies
// size, colours, roof and extras, so two neighbours of the same kind never look the same.
import { BIOMES, type Arch, type BiomeId } from "../data/biomes";
import type { Kit } from "./kit";

/** Half the width of the square every building must stay inside (a plot is 10 wide). */
export const FOOTPRINT = 4.5;

export interface BuildCtx {
  kit: Kit;
  biome: BiomeId;
  district: string;
  rnd: () => number;
}

const pick = <T,>(rnd: () => number, list: readonly T[]): T => list[Math.floor(rnd() * list.length) % list.length];
const between = (rnd: () => number, a: number, b: number) => a + (b - a) * rnd();

const GLASS = "#2F3D48";
const DOOR = ["#5A3A22", "#6B4A2E", "#3E2A1C", "#2B4C7E"];
const ZINC = ["#9AA3AD", "#8E979F", "#A9AFB4"];
const RUST = ["#8B5A3A", "#9A6440", "#7D4B2E", "#A0705A"];
const TANK = "#20242A";
const CONCRETE = "#C9C3B6";
const TRIM = "#F4EFE4";
const STEEL = "#4A4E54";
const PAINT = ["#F2EBDD", "#E8DCC4", "#DCE6EA", "#F0E2C4", "#E9D2B4", "#D7E3D0", "#F2D9C8"];
const BRIGHT = ["#C0392B", "#2E7D4F", "#2B5C9A", "#E0A526", "#8C2F5A", "#1F7A8C", "#D35400"];
const GOODS = ["#C0392B", "#E67E22", "#F1C40F", "#27AE60", "#8E5A2B", "#ECE3D0"];

const wallOf = (c: BuildCtx) => pick(c.rnd, [...BIOMES[c.biome].wall, ...(c.district === "rich" ? PAINT : PAINT.slice(0, 3))]);
const roofOf = (c: BuildCtx) => (c.district === "poor" ? pick(c.rnd, RUST) : pick(c.rnd, [...BIOMES[c.biome].roof, ...ZINC]));
const isFlat = (c: BuildCtx) => !!BIOMES[c.biome].flat;
const archOf = (c: BuildCtx): Arch => BIOMES[c.biome].arch ?? "plain";

/** Windows along the walls of a w by d block at height y, centred on z0. */
function windows(c: BuildCtx, w: number, d: number, y: number, z0 = 0, o: { gap?: number; skip?: number; back?: boolean; sides?: boolean } = {}) {
  const { kit } = c;
  const gap = o.gap ?? 1.7;
  const n = Math.max(1, Math.floor((w - 0.8) / gap));
  for (let i = 0; i < n; i++) {
    const x = -((n - 1) * gap) / 2 + i * gap;
    if (o.skip === undefined || Math.abs(x - o.skip) > 0.9) kit.box(0.85, 0.95, 0.08, x, y, z0 + d / 2 + 0.03, GLASS);
    if (o.back !== false) kit.box(0.85, 0.95, 0.08, x, y, z0 - d / 2 - 0.03, GLASS);
  }
  if (o.sides === false) return;
  const m = Math.max(1, Math.floor((d - 0.8) / gap));
  for (let i = 0; i < m; i++) {
    const z = z0 - ((m - 1) * gap) / 2 + i * gap;
    kit.box(0.08, 0.95, 0.85, w / 2 + 0.03, y, z, GLASS);
    kit.box(0.08, 0.95, 0.85, -w / 2 - 0.03, y, z, GLASS);
  }
}

/** A black plastic water tank, on a steel stand when stand > 0. */
function waterTank(c: BuildCtx, x: number, y: number, z: number, stand = 1.6) {
  const { kit } = c;
  if (stand > 0) {
    for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) kit.box(0.1, stand, 0.1, x + dx, y, z + dz, STEEL);
    kit.box(1.1, 0.1, 1.1, x, y + stand, z, STEEL);
  }
  const top = y + Math.max(stand + 0.1, 0);
  kit.cyl(0.55, 0.55, 1.1, x, top, z, TANK, 10);
  kit.cyl(0.2, 0.55, 0.2, x, top + 1.1, z, TANK, 10);
}

/** Point (dx, dz) in a frame turned by ry about y and moved to (x, z). */
const turned = (x: number, z: number, ry: number, dx: number, dz: number): [number, number] => [
  x + dx * Math.cos(ry) + dz * Math.sin(ry),
  z - dx * Math.sin(ry) + dz * Math.cos(ry),
];

/** A parked car, nose along +x before turning by ry. */
export function car(c: BuildCtx, x: number, z: number, ry: number, color?: string) {
  const { kit } = c;
  const paint = color ?? pick(c.rnd, ["#C0392B", "#F4F1EA", "#2B2F36", "#2B5C9A", "#8E979F", "#E0A526"]);
  const at = (dx: number, dz: number) => turned(x, z, ry, dx, dz);
  let [px, pz] = at(0, 0);
  kit.box(2.0, 0.55, 0.95, px, 0.2, pz, paint, ry);
  [px, pz] = at(-0.1, 0);
  kit.box(1.1, 0.42, 0.85, px, 0.75, pz, GLASS, ry);
  kit.box(1.0, 0.06, 0.8, px, 1.17, pz, paint, ry);
  for (const [dx, dz] of [[0.65, 0.42], [-0.65, 0.42], [0.65, -0.42], [-0.65, -0.42]]) {
    [px, pz] = at(dx, dz);
    kit.box(0.42, 0.42, 0.14, px, 0, pz, "#1B1D21", ry);
  }
}

/** A yellow danfo bus with its black stripes. */
export function danfo(c: BuildCtx, x: number, z: number, ry: number) {
  const { kit } = c;
  kit.box(3.0, 1.3, 1.3, x, 0.3, z, "#F2B705", ry);
  kit.box(3.02, 0.14, 1.32, x, 0.75, z, "#1B1D21", ry);
  kit.box(2.4, 0.42, 1.34, x, 1.05, z, GLASS, ry);
  for (const [dx, dz] of [[1.0, 0.6], [-1.0, 0.6], [1.0, -0.6], [-1.0, -0.6]]) {
    const [px, pz] = turned(x, z, ry, dx, dz);
    kit.box(0.5, 0.5, 0.16, px, 0, pz, "#1B1D21", ry);
  }
}

/** Round columns along x at depth z. */
function columns(c: BuildCtx, x0: number, x1: number, z: number, h: number, n: number, color = TRIM, r = 0.16) {
  for (let i = 0; i < n; i++) c.kit.cyl(r, r, h, n === 1 ? x0 : x0 + ((x1 - x0) * i) / (n - 1), 0, z, color, 8);
}

/** A railing along x: posts and a top rail. */
function railing(c: BuildCtx, w: number, x: number, y: number, z: number, color = "#3A3F45") {
  const { kit } = c;
  kit.box(w, 0.06, 0.07, x, y + 0.9, z, color);
  const n = Math.max(2, Math.round(w / 0.45));
  for (let i = 0; i <= n; i++) kit.box(0.04, 0.9, 0.04, x - w / 2 + (w * i) / n, y, z, color);
}

/** A flat roof behind a low parapet, with a little stair hut. */
function flatRoof(c: BuildCtx, w: number, d: number, y: number, z0: number, wall: string) {
  const { kit } = c;
  kit.box(w + 0.16, 0.55, d + 0.16, 0, y, z0, wall);
  kit.box(w - 0.3, 0.06, d - 0.3, 0, y + 0.3, z0, "#8F8A80");
}

/** A flag on a pole: green-white-green unless told otherwise. */
function flag(c: BuildCtx, x: number, z: number, h = 6, colours = ["#118A4F", "#F4F1EA", "#118A4F"]) {
  const { kit } = c;
  kit.cyl(0.06, 0.08, h, x, 0, z, "#D8D8D8", 6);
  colours.forEach((col, i) => kit.box(0.36, 0.7, 0.04, x + 0.24 + i * 0.36, h - 0.8, z, col));
}

/** A person: legs, body, head. Used for traders and people sitting out. */
export function figure(c: BuildCtx, x: number, z: number, cloth: string, s = 1, sitting = false) {
  const { kit } = c;
  const skin = pick(c.rnd, ["#6B3E26", "#4A2A18", "#8D5524", "#5C3A21"]);
  const legs = sitting ? 0.25 : 0.75;
  kit.box(0.34 * s, legs * s, 0.22 * s, x, 0, z, "#2B2F36");
  kit.box(0.46 * s, 0.75 * s, 0.3 * s, x, legs * s, z, cloth);
  kit.ball(0.2 * s, x, (legs + 0.98) * s, z, skin);
}

// ---- Homes ----

// ---- How each region builds ----

/** Horned corners (zanko) on a Hausa roof, at the four corners of a w by d block at height y. */
function zanko(c: BuildCtx, w: number, d: number, y: number, z0: number, col: string) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.kit.cyl(0.02, 0.2, 0.75, sx * (w / 2 - 0.1), y, z0 + sz * (d / 2 - 0.1), col, 6);
}

/** Raised relief round a Hausa doorway: a frame and interlaced marks in white, indigo or green. */
function hausaRelief(c: BuildCtx, x: number, y: number, z: number) {
  const { kit } = c;
  const ink = pick(c.rnd, ["#F4F1EA", "#26355E", "#F4F1EA", "#118A4F"]);
  kit.box(2.0, 0.12, 0.06, x, y + 2.4, z, ink);
  for (const s of [-1, 1]) {
    kit.box(0.12, 2.5, 0.06, x + s * 0.95, y, z, ink);
    kit.box(0.5, 0.08, 0.06, x + s * 0.55, y + 2.65, z, ink);
    kit.box(0.08, 0.5, 0.06, x + s * 0.3, y + 2.55, z, ink);
  }
  kit.cyl(0.18, 0.18, 0.06, x, y + 2.75, z, ink, 8, Math.PI / 2);
}

/** A round hut with a thatched cone, beside a Middle Belt home. */
function hut(c: BuildCtx, x: number, z: number, r = 1.1) {
  const { kit } = c;
  kit.cyl(r, r, 1.9, x, 0, z, pick(c.rnd, ["#B98454", "#C9935F", "#A8744A"]), 10);
  kit.cyl(0.05, r + 0.4, 1.6, x, 1.9, z, pick(c.rnd, ["#C9A86A", "#B8955A", "#A88850"]), 10);
  kit.box(0.6, 1.3, 0.06, x, 0, z + r - 0.02, "#3E2A1C");
}

/** Horizontal grooves on old Benin walls, w wide, up to h. */
function grooves(c: BuildCtx, w: number, h: number, z: number, x = 0, alongX = true) {
  for (let y = 0.4; y < h - 0.2; y += 0.38) c.kit.box(alongX ? w + 0.02 : 0.06, 0.06, alongX ? 0.06 : w + 0.02, x, y, z, "#6E3519");
}

/** A home in its region's style, or null to build the plain one. */
function regionalHouse(c: BuildCtx): number | null {
  const { kit, rnd } = c;
  const arch = archOf(c);
  const wall = wallOf(c);
  const z0 = -0.6;
  switch (arch) {
    case "hausa": {
      // A mud house: thick walls, round buttressed corners, a flat roof with horned corners, and the entrance
      // hut (zaure) in front with the relief round its door.
      const w = between(rnd, 5.6, 6.6);
      const d = between(rnd, 3.8, 4.4);
      const h = between(rnd, 2.8, 3.4);
      const zb = z0 - 0.6;
      kit.box(w, h, d, 0, 0, zb, wall);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.cyl(0.32, 0.38, h + 0.2, sx * (w / 2 - 0.1), 0, zb + sz * (d / 2 - 0.1), wall, 8);
      kit.box(w + 0.1, 0.4, d + 0.1, 0, h, zb, wall);
      zanko(c, w, d, h + 0.4, zb, wall);
      for (const x of [-w / 3, w / 3]) kit.box(0.14, 0.14, 0.7, x, h - 0.2, zb + d / 2 + 0.3, "#6B4A2E");
      const zw = 2.4;
      const zz = zb + d / 2 + 1.0;
      kit.box(zw, 2.6, 2.0, 0, 0, zz, wall);
      kit.box(zw + 0.1, 0.35, 2.1, 0, 2.6, zz, wall);
      zanko(c, zw, 2.0, 2.95, zz, wall);
      kit.box(0.9, 1.9, 0.08, 0, 0, zz + 1.03, pick(rnd, ["#3E2A1C", "#26355E", "#5A3A22"]));
      hausaRelief(c, 0, 0.05, zz + 1.06);
      for (const x of [-w / 3, w / 3]) kit.box(0.5, 0.5, 0.08, x, 1.7, zb + d / 2 + 0.04, "#3E2A1C");
      return h + 1.15;
    }
    case "yoruba": {
      // A long bungalow under a rusty gable roof, its veranda on square pillars right across the front.
      const w = between(rnd, 6.8, 7.6);
      const d = between(rnd, 4.0, 4.6);
      const h = 2.8;
      kit.box(w, 0.4, d, 0, 0, z0, "#8E7A64");
      kit.box(w, h - 0.4, d, 0, 0.4, z0, wall);
      kit.box(0.95, 2.1, 0.1, 0, 0.4, z0 + d / 2 + 0.04, pick(rnd, DOOR));
      windows(c, w, d, 1.4, z0, { skip: 0, gap: 1.5 });
      const vz = z0 + d / 2 + 0.85;
      kit.box(w, 0.3, 1.7, 0, 0, vz, "#B9A88C");
      for (let i = 0; i < 4; i++) kit.box(0.3, h - 0.3, 0.3, -w / 2 + 0.3 + (i * (w - 0.6)) / 3, 0.3, vz + 0.6, "#E8DCC4");
      kit.gable(w + 0.6, d + 2.0, between(rnd, 1.2, 1.6), 0, h, z0 + 0.85, pick(rnd, RUST));
      if (rnd() < 0.5) figure(c, w / 3, vz, pick(rnd, BRIGHT), 1, true);
      return h + 1.6;
    }
    case "lagos": {
      // Tall and tight: a shop on the ground floor with its shutter and sign, rooms above, painted bright.
      const w = between(rnd, 5.2, 6.4);
      const d = between(rnd, 4.6, 5.4);
      const fh = 2.9;
      const floors = rnd() < 0.5 ? 2 : 3;
      kit.box(w, fh * floors, d, 0, 0, z0, wall);
      const band = pick(rnd, BRIGHT);
      for (let f = 1; f < floors; f++) kit.box(w + 0.1, 0.18, d + 0.1, 0, f * fh - 0.09, z0, band);
      kit.box(w * 0.7, 2.2, 0.08, -w * 0.1, 0, z0 + d / 2 + 0.04, "#8E979F");
      for (let i = 0; i < 9; i++) kit.box(w * 0.7, 0.03, 0.1, -w * 0.1, 0.2 + i * 0.22, z0 + d / 2 + 0.07, "#6E757C");
      kit.box(w * 0.8, 0.6, 0.08, 0, 2.3, z0 + d / 2 + 0.06, pick(rnd, GOODS));
      for (let f = 1; f < floors; f++) windows(c, w, d, f * fh + 1.1, z0, { gap: 1.4, back: false });
      kit.gable(w + 0.4, d + 0.4, 1.1, 0, fh * floors, z0, pick(rnd, BIOMES[c.biome].roof));
      return fh * floors + 1.1;
    }
    case "colonial": {
      // Calabar: on a raised plinth, a wooden veranda right round, louvred shutters, a steep red roof.
      const w = between(rnd, 4.8, 5.6);
      const d = between(rnd, 3.6, 4.2);
      const p = 0.8;
      const h = 3.0;
      kit.box(w + 1.6, p, d + 1.6, 0, 0, z0, "#B9B1A4");
      kit.box(w, h, d, 0, p, z0, wall);
      const wood = pick(rnd, ["#6B4A2E", "#7A5C3E", "#F4F1EA"]);
      const sides: [number, number, number, boolean][] = [[w + 1.5, 0, z0 + d / 2 + 0.7, true], [w + 1.5, 0, z0 - d / 2 - 0.7, true], [d + 1.5, -w / 2 - 0.7, z0, false], [d + 1.5, w / 2 + 0.7, z0, false]];
      for (const [rw, x, z, along] of sides) {
        kit.box(along ? rw : 0.06, 0.08, along ? 0.06 : rw, x, p + 0.9, z, wood);
        const n = Math.round(rw / 0.9);
        for (let i = 0; i <= n; i++) kit.box(0.12, h, 0.12, along ? x - rw / 2 + (rw * i) / n : x, p, along ? z : z - rw / 2 + (rw * i) / n, wood);
      }
      const shutter = pick(rnd, ["#2E7D4F", "#1F6B4A", "#2B5C9A"]);
      for (const x of [-w / 3, w / 3]) {
        kit.box(0.9, 1.4, 0.08, x, p + 0.9, z0 + d / 2 + 0.04, shutter);
        for (let i = 0; i < 6; i++) kit.box(0.88, 0.03, 0.1, x, p + 1.0 + i * 0.22, z0 + d / 2 + 0.07, "#F4F1EA");
      }
      kit.box(1.0, 2.2, 0.08, 0, p, z0 + d / 2 + 0.04, pick(rnd, DOOR));
      for (let i = 0; i < 3; i++) kit.box(1.4, (i + 1) * 0.27, 0.35, 0, 0, z0 + d / 2 + 1.55 - i * 0.3, "#9A9286");
      kit.hip(w + 1.8, d + 1.8, between(rnd, 2.0, 2.4), 0, p + h, z0, pick(rnd, BIOMES[c.biome].roof));
      return p + h + 2.4;
    }
    case "stilt": {
      // A creek house: plank walls on stilts above the wet ground, steps up to the door, a zinc roof.
      const w = between(rnd, 4.8, 5.8);
      const d = between(rnd, 3.6, 4.2);
      const p = 1.3;
      const h = 2.5;
      for (const x of [-w / 2 + 0.2, 0, w / 2 - 0.2]) for (const z of [z0 - d / 2 + 0.2, z0 + d / 2 - 0.2]) kit.box(0.18, p, 0.18, x, 0, z, "#5E4A38");
      kit.box(w + 0.8, 0.15, d + 1.4, 0, p, z0 + 0.4, "#8C6A4A");
      kit.box(w, h, d, 0, p + 0.15, z0, wall);
      for (let y = p + 0.45; y < p + h; y += 0.32) kit.box(w + 0.02, 0.04, d + 0.02, 0, y, z0, "#6B5238");
      kit.box(0.9, 1.9, 0.08, 0, p + 0.15, z0 + d / 2 + 0.04, pick(rnd, DOOR));
      for (let i = 0; i < 4; i++) kit.box(1.0, 0.1, 0.35, 0, p - 0.3 - i * 0.32, z0 + d / 2 + 1.25 + i * 0.32, "#7A5C3E");
      kit.gable(w + 0.6, d + 0.8, 1.3, 0, p + 0.15 + h, z0, pick(rnd, BIOMES[c.biome].roof));
      if (rnd() < 0.5) kit.box(2.4, 0.3, 0.6, -w / 2 + 1.0, 0, 3.6, "#6B4A2E");
      return p + h + 1.5;
    }
    case "benin": {
      // Old Benin: red-earth walls with their horizontal grooves, buttressed corners, a low brown roof.
      const w = between(rnd, 5.8, 6.8);
      const d = between(rnd, 4.6, 5.2);
      const h = 2.9;
      kit.box(w, h, d, 0, 0, z0, wall);
      grooves(c, w, h, z0 + d / 2 + 0.01);
      grooves(c, d, h, z0, w / 2 + 0.01, false);
      grooves(c, d, h, z0, -w / 2 - 0.01, false);
      kit.box(1.0, 2.1, 0.08, 0, 0, z0 + d / 2 + 0.05, "#3E2A1C");
      for (const s of [-1, 1]) kit.box(0.5, h + 0.3, 0.5, s * (w / 2 - 0.05), 0, z0 + d / 2, wall);
      kit.hip(w + 0.8, d + 0.8, 1.1, 0, h, z0, pick(rnd, BIOMES[c.biome].roof));
      return h + 1.1;
    }
    case "modern": {
      // Abuja: white planes and glass under a thin flat roof that reaches out, a planter out front.
      const w = between(rnd, 6.0, 7.0);
      const d = between(rnd, 4.6, 5.4);
      const h = 3.2;
      kit.box(w, h, d, 0, 0, z0, wall);
      kit.box(w * 0.55, h - 0.6, 0.08, w * 0.15, 0.3, z0 + d / 2 + 0.04, "#4F7FA6");
      for (let i = 1; i < 5; i++) kit.box(0.05, h - 0.6, 0.1, w * 0.15 - w * 0.275 + (i * w * 0.55) / 5, 0.3, z0 + d / 2 + 0.06, "#D8D8D8");
      kit.box(1.0, 2.2, 0.08, -w / 2 + 0.9, 0, z0 + d / 2 + 0.04, "#2B2F36");
      kit.box(w + 1.0, 0.25, d + 1.2, 0.3, h, z0 + 0.3, "#E6E2D8");
      if (rnd() < 0.5) {
        kit.box(w * 0.5, 2.4, d * 0.7, -w / 4, h + 0.25, z0 - 0.3, wall);
        kit.box(w * 0.5 + 0.6, 0.2, d * 0.7 + 0.6, -w / 4, h + 2.65, z0 - 0.3, "#E6E2D8");
      }
      kit.box(3.0, 0.4, 0.5, w / 4, 0, 3.4, "#9AA3AD");
      kit.box(2.9, 0.15, 0.4, w / 4, 0.4, 3.4, "#3F6B2A");
      return h + 2.9;
    }
    case "igbo": {
      // An Igbo bungalow: a white portico on four columns under a pediment, a balustrade along the porch,
      // and a bold red, blue or green roof.
      const w = between(rnd, 5.8, 6.8);
      const d = between(rnd, 4.2, 4.8);
      const h = 3.1;
      kit.box(w, 0.5, d, 0, 0, z0, "#9C9286");
      kit.box(w, h - 0.5, d, 0, 0.5, z0, wall);
      kit.box(1.1, 2.3, 0.1, 0, 0.5, z0 + d / 2 + 0.04, pick(rnd, DOOR));
      windows(c, w, d, 1.6, z0, { skip: 0 });
      const pw = 3.6;
      const pz = z0 + d / 2 + 0.85;
      kit.box(pw + 0.4, 0.5, 1.7, 0, 0, pz, "#E6E2D8");
      columns(c, -pw / 2 + 0.2, pw / 2 - 0.2, pz + 0.6, h, 4, "#FFFFFF", 0.17);
      const n = 10;
      for (let i = 0; i <= n; i++) if (Math.abs(-pw / 2 + (pw * i) / n) > 0.7) kit.cyl(0.06, 0.08, 0.7, -pw / 2 + (pw * i) / n, 0.5, pz + 0.75, "#FFFFFF", 6);
      const roof = pick(rnd, BIOMES[c.biome].roof);
      kit.gable(2.0, pw + 0.6, 1.0, 0, h, pz, roof, Math.PI / 2);
      kit.hip(w + 0.7, d + 0.7, between(rnd, 1.5, 1.9), 0, h, z0, roof);
      return h + 1.9;
    }
    case "stone": {
      // Jos: walls of grey stone blocks, a zinc hip roof, a chimney for the cold harmattan nights.
      const w = between(rnd, 5.6, 6.6);
      const d = between(rnd, 4.4, 5.0);
      const h = 2.8;
      kit.box(w, h, d, 0, 0, z0, wall);
      const stone = ["#7D7A73", "#9A968D", "#6E6B65", "#ABA69C"];
      let row = 0;
      for (let y = 0.15; y < h - 0.3; y += 0.45, row++)
        for (let x = -w / 2 + 0.4 + (row % 2 ? 0.35 : 0); x < w / 2 - 0.35; x += 0.75) kit.box(0.6, 0.36, 0.05, x, y, z0 + d / 2 + 0.02, pick(rnd, stone));
      kit.box(0.95, 2.1, 0.1, 0, 0, z0 + d / 2 + 0.06, pick(rnd, DOOR));
      for (const x of [-w / 3, w / 3]) kit.box(0.9, 0.9, 0.08, x, 1.3, z0 + d / 2 + 0.07, GLASS);
      kit.hip(w + 0.7, d + 0.7, 1.4, 0, h, z0, roofOf(c));
      kit.box(0.6, 1.8, 0.6, w / 3, h, z0 - d / 4, "#6E6B65");
      return h + 1.8;
    }
    case "hut": {
      // A Middle Belt home: a small zinc-roofed house with round thatched huts in the yard.
      const w = between(rnd, 4.4, 5.0);
      const d = between(rnd, 3.6, 4.2);
      const h = 2.6;
      kit.box(w, h, d, 1.4, 0, z0 - 0.8, wall);
      kit.box(0.9, 2.0, 0.08, 1.4, 0, z0 - 0.8 + d / 2 + 0.04, pick(rnd, DOOR));
      kit.hip(w + 0.6, d + 0.6, 1.2, 1.4, h, z0 - 0.8, roofOf(c));
      hut(c, -2.9, 2.6, 1.05);
      if (rnd() < 0.7) hut(c, -2.9, -2.6, 0.9);
      kit.cyl(0.5, 0.55, 0.3, 1.8, 0, 3.0, "#5E4A38", 8);
      return h + 1.2;
    }
    default:
      return null;
  }
}

/** A bungalow: hip roof, veranda, a water tank out back. */
function house(c: BuildCtx): number {
  const regional = regionalHouse(c);
  if (regional !== null) return regional;
  const { kit, rnd } = c;
  const w = between(rnd, 5.4, 6.8);
  const d = between(rnd, 4.4, 5.2);
  const h = 2.9;
  const wall = wallOf(c);
  const z0 = -0.6;
  kit.box(w, 0.35, d, 0, 0, z0, "#8E8172");
  kit.box(w, h - 0.35, d, 0, 0.35, z0, wall);
  kit.box(0.95, 2.1, 0.1, 0, 0.35, z0 + d / 2 + 0.04, pick(rnd, DOOR));
  windows(c, w, d, 1.4, z0, { skip: 0 });
  // Veranda across part of the front.
  const vw = w * between(rnd, 0.55, 0.9);
  const vz = z0 + d / 2 + 0.75;
  kit.box(vw, 0.25, 1.5, 0, 0, vz, CONCRETE);
  columns(c, -vw / 2 + 0.2, vw / 2 - 0.2, vz + 0.55, h, rnd() < 0.5 ? 2 : 3);
  if (isFlat(c)) {
    // Sahel: a flat roof behind a parapet, with spouts to throw off the rain.
    flatRoof(c, w, d, h, z0, wall);
    kit.box(vw, 0.18, 1.6, 0, h, vz, wall);
    for (const x of [-w / 3, w / 3]) kit.box(0.15, 0.15, 0.7, x, h + 0.2, z0 + d / 2 + 0.3, "#7A5C3E");
    if (rnd() < 0.5) waterTank(c, w / 2 - 0.8, h + 0.35, z0 - d / 4, 0);
    return h + 0.6;
  }
  const roof = roofOf(c);
  const rh = between(rnd, 1.3, 1.8);
  kit.hip(w + 0.7, d + 0.7, rh, 0, h, z0, roof);
  kit.slab(vw + 0.3, 0.1, 1.8, 0, h - 0.05, vz + 0.1, roof, 0.18);
  if (rnd() < 0.55) waterTank(c, w / 2 - 0.6, 0, z0 - d / 2 - 0.6, 1.4);
  if (rnd() < 0.3) kit.ball(0.35, -w / 4, h + rh * 0.55, z0 + 0.6, "#EDEDED", 0.35);
  return h + rh;
}

/** A two-storey duplex: balcony over the porch, a car in the yard. */
function duplex(c: BuildCtx): number {
  const { kit, rnd } = c;
  const w = between(rnd, 6.0, 7.2);
  const d = between(rnd, 4.6, 5.0);
  const fh = 3;
  const wall = wallOf(c);
  const accent = pick(rnd, ["#B5532E", "#3F6B3A", "#26355E", "#8C6A4A", "#5E6B73"]);
  const z0 = -0.8;
  kit.box(w, 0.4, d, 0, 0, z0, "#7F776C");
  kit.box(w, fh * 2 - 0.4, d, 0, 0.4, z0, wall);
  kit.box(w + 0.08, 0.25, d + 0.08, 0, fh, z0, accent);
  const door = rnd() < 0.5 ? -w / 4 : w / 4;
  kit.box(1.1, 2.3, 0.1, door, 0.4, z0 + d / 2 + 0.04, pick(rnd, DOOR));
  windows(c, w, d, 1.5, z0, { skip: door });
  windows(c, w, d, fh + 1.3, z0);
  // Porch, and the balcony on top of it.
  const bw = w * between(rnd, 0.45, 0.6);
  const bz = z0 + d / 2 + 0.7;
  kit.box(bw, 0.2, 1.4, door, fh - 0.1, bz, CONCRETE);
  columns(c, door - bw / 2 + 0.2, door + bw / 2 - 0.2, bz + 0.55, fh - 0.1, 2);
  if (archOf(c) === "igbo") {
    // An Igbo villa: white balusters along the balcony, pillars up both floors, gate pillars with brass balls.
    const n = Math.round(bw / 0.3);
    for (let i = 0; i <= n; i++) kit.cyl(0.07, 0.09, 0.8, door - bw / 2 + (bw * i) / n, fh + 0.1, bz + 0.65, "#F4F1EA", 6);
    kit.box(bw, 0.1, 0.15, door, fh + 0.9, bz + 0.65, "#F4F1EA");
    columns(c, door - bw / 2 + 0.2, door + bw / 2 - 0.2, bz + 0.55, fh * 2 - 0.1, 2, "#F4F1EA", 0.2);
    for (const s of [-1, 1]) {
      kit.box(0.6, 1.8, 0.6, s * 3.6, 0, 3.9, "#F0E2C4");
      kit.ball(0.3, s * 3.6, 2.05, 3.9, "#C9A227", 0.8);
    }
  } else railing(c, bw, door, fh + 0.1, bz + 0.65);
  const roof = roofOf(c);
  const rh = between(rnd, 1.6, 2.2);
  if (isFlat(c)) flatRoof(c, w, d, fh * 2, z0, wall);
  else kit.hip(w + 0.8, d + 0.8, rh, 0, fh * 2, z0, roof);
  if (rnd() < 0.7) waterTank(c, -w / 2 + 0.7, 0, z0 - d / 2 - 0.55, 1.6);
  if (rnd() < 0.8) car(c, -door, 3.2, rnd() < 0.5 ? 0 : Math.PI);
  return fh * 2 + (isFlat(c) ? 0.6 : rh);
}

/** A block of flats: three or four floors, balconies, tanks on the roof. */
function flats(c: BuildCtx): number {
  const { kit, rnd } = c;
  const floors = rnd() < 0.5 ? 3 : 4;
  const fh = 2.9;
  const w = between(rnd, 5.8, 6.4);
  const d = between(rnd, 5.0, 5.8);
  const wall = wallOf(c);
  const band = pick(rnd, ["#B5532E", "#3F6B3A", "#2B5C9A", "#8C6A4A", "#C9A227", "#7E8792"]);
  const z0 = -0.9;
  const H = floors * fh;
  kit.box(w, H, d, 0, 0, z0, wall);
  for (let f = 0; f < floors; f++) {
    const y = f * fh;
    if (f > 0) kit.box(w + 0.12, 0.2, d + 0.12, 0, y - 0.1, z0, band);
    windows(c, w, d, y + 1.2, z0, { gap: 1.9 });
    if (f > 0) {
      for (const bx of [-w / 4, w / 4]) {
        kit.box(2.2, 0.15, 1.0, bx, y - 0.05, z0 + d / 2 + 0.5, CONCRETE);
        railing(c, 2.2, bx, y + 0.1, z0 + d / 2 + 0.98, band);
      }
    }
  }
  // The stair tower up one side, with its open landings.
  const sx = rnd() < 0.5 ? -w / 2 - 0.6 : w / 2 + 0.6;
  kit.box(1.2, H + 1.0, 2.2, sx, 0, z0, wall);
  for (let f = 0; f < floors; f++) kit.box(0.08, 1.4, 1.2, sx + Math.sign(sx) * 0.62, f * fh + 1.0, z0, "#5D646B");
  flatRoof(c, w, d, H, z0, wall);
  const tanks = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < tanks; i++) waterTank(c, -w / 3 + i * 1.5, H + 0.35, z0 - d / 4, 0);
  for (let f = 0; f < floors; f++) if (rnd() < 0.5) kit.box(0.35, 0.5, 0.8, -sx * 0.98, f * fh + 1.5, z0 + 1.0, "#E8E8E8");
  return H + 1.0;
}

/** Face-me-I-face-you: two rows of rooms across a yard, zinc roofs, a well and a clothes line. */
function compound(c: BuildCtx): number {
  if (archOf(c) === "hausa") return mudCompound(c);
  const { kit, rnd } = c;
  const wall = pick(rnd, ["#C8B79A", "#B9A88C", "#D2C2A2", "#C4A27C", "#B7B1A3"]);
  const len = between(rnd, 7.0, 8.0);
  const deep = 2.3;
  const h = 2.6;
  for (const side of [-1, 1]) {
    const x = side * 2.85;
    // In the east even the yard compounds wear bright roofs.
    const roof = archOf(c) === "igbo" ? pick(rnd, BIOMES[c.biome].roof) : pick(rnd, RUST);
    kit.box(deep, h, len, x, 0, -0.3, wall);
    // A single slope, falling away from the yard.
    kit.slab(deep + 0.8, 0.1, len + 0.3, x + side * 0.1, h + 0.3, -0.3, roof, 0, 0, -side * 0.22);
    // A door and a window for every room, all facing the yard.
    const rooms = Math.floor(len / 1.8);
    for (let i = 0; i < rooms; i++) {
      const z = -0.3 - len / 2 + (i + 0.5) * (len / rooms);
      kit.box(0.1, 1.9, 0.8, x - side * (deep / 2 + 0.03), 0, z - 0.25, pick(rnd, DOOR));
      kit.box(0.08, 0.7, 0.55, x - side * (deep / 2 + 0.03), 1.1, z + 0.45, GLASS);
    }
  }
  // A back row of rooms closing the yard.
  if (rnd() < 0.6) {
    kit.box(3.2, h, 2.0, 0, 0, -3.3, wall);
    kit.slab(3.6, 0.1, 2.2, 0, h + 0.3, -3.25, pick(rnd, RUST), 0.2);
  }
  // The yard: a well, a clothes line with washing, a bench.
  kit.cyl(0.55, 0.6, 0.7, -0.6, 0, 0.6, "#9A9286", 10);
  kit.box(0.08, 1.8, 0.08, 0.4, 0, -1.6, STEEL);
  kit.box(0.08, 1.8, 0.08, 0.4, 0, 1.8, STEEL);
  kit.box(0.03, 0.03, 3.4, 0.4, 1.75, 0.1, "#DDD");
  for (let i = 0; i < 4; i++) kit.box(0.04, 0.55, 0.45, 0.4, 1.2, -1.1 + i * 0.75, pick(rnd, GOODS));
  if (rnd() < 0.6) figure(c, -0.8, 2.6, pick(rnd, BRIGHT), 1, true);
  return h + 0.6;
}

/** A northern family compound: a mud wall round rooms and a granary, the entrance hut on the street. */
function mudCompound(c: BuildCtx): number {
  const { kit, rnd } = c;
  const wall = wallOf(c);
  const r = 3.9;
  const runs: [number, number, number, boolean][] = [[2 * r, 0, -r, true], [2 * r, -r, 0, false], [2 * r, r, 0, false], [r - 1.3, -(r + 1.3) / 2, r, true], [r - 1.3, (r + 1.3) / 2, r, true]];
  for (const [w, x, z, along] of runs) kit.box(along ? w : 0.4, 2.1, along ? 0.4 : w, x, 0, z, wall);
  kit.box(2.6, 2.8, 1.6, 0, 0, r - 0.7, wall);
  zanko(c, 2.6, 1.6, 2.8, r - 0.7, wall);
  kit.box(0.9, 1.9, 0.08, 0, 0, r + 0.12, "#3E2A1C");
  hausaRelief(c, 0, 0.05, r + 0.15);
  for (const [x, z, w, d] of [[-2.0, -2.2, 2.6, 2.4], [1.9, -1.6, 2.8, 3.2]] as const) {
    kit.box(w, 2.6, d, x, 0, z, wall);
    zanko(c, w, d, 2.6, z, wall);
  }
  // A granary: a mud jar on stones under a thatch hat.
  kit.cyl(0.8, 0.65, 1.8, -2.4, 0.3, 1.4, wall, 10);
  kit.cyl(0.05, 1.0, 0.8, -2.4, 2.1, 1.4, "#C9A86A", 10);
  if (rnd() < 0.6) figure(c, 1.6, 1.6, pick(rnd, BRIGHT), 1, true);
  return 3.6;
}

/** Shacks: a cluster of small plank and zinc huts, leaning every which way. */
function shacks(c: BuildCtx): number {
  const { kit, rnd } = c;
  const spots: [number, number][] = [[-2.4, -2.4], [0.6, -2.6], [2.8, -1.8], [-2.6, 0.6], [0.2, 0.4], [2.6, 1.4], [-1.2, 2.8], [1.6, 3.0]];
  for (const [x, z] of spots) {
    if (rnd() < 0.25) continue;
    const w = between(rnd, 1.6, 2.2);
    const d = between(rnd, 1.4, 1.9);
    const h = between(rnd, 1.6, 2.1);
    const ry = (rnd() - 0.5) * 0.4;
    kit.box(w, h, d, x, 0, z, pick(rnd, ["#8C6A4A", "#7A5C3E", "#9A7B55", "#5E6B73", "#6E5A45", "#2B5C9A"]), ry);
    kit.slab(w + 0.4, 0.06, d + 0.4, x, h + 0.15, z, pick(rnd, RUST), 0.18 * (rnd() < 0.5 ? 1 : -1), ry);
    kit.box(0.6, 1.4, 0.06, x, 0, z + d / 2 + 0.02, "#3E2A1C", ry);
  }
  // A cooking fire and a jerrycan or two.
  kit.cyl(0.3, 0.35, 0.3, -0.6, 0, 2.0, "#2B2F36", 8);
  kit.box(0.3, 0.45, 0.2, 1.0, 0, 2.2, "#E0A526");
  return 2.4;
}

// ---- Work, trade and school ----

/** An office block: glass between concrete floor bands. */
function office(c: BuildCtx): number {
  const { kit, rnd } = c;
  const floors = 3 + Math.floor(rnd() * 3);
  const fh = 3.1;
  const w = between(rnd, 6.0, 7.0);
  const d = between(rnd, 5.6, 6.6);
  const glass = pick(rnd, ["#4F7FA6", "#5B8DB8", "#3D6E8F", "#6F9A8E", "#4E6E8A"]);
  const frame = pick(rnd, ["#E6E2D8", "#CFCAC0", "#B9B3A8", "#F2EEE6"]);
  const z0 = -0.6;
  const H = floors * fh;
  kit.box(w - 0.3, H, d - 0.3, 0, 0, z0, glass);
  for (let f = 0; f <= floors; f++) kit.box(w, 0.35, d, 0, f * fh - (f ? 0.35 : 0), z0, frame);
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) for (const z of [z0 - d / 2 + 0.2, z0 + d / 2 - 0.2]) kit.box(0.45, H, 0.45, x, 0, z, frame);
  // Entrance canopy and a roof plant room.
  kit.box(3.0, 0.2, 1.6, 0, 3.0, z0 + d / 2 + 0.8, frame);
  columns(c, -1.3, 1.3, z0 + d / 2 + 1.4, 3.0, 2, frame, 0.12);
  kit.box(2.0, 1.4, 1.8, w / 4, H, z0 - d / 4, frame);
  kit.box(0.9, 0.7, 0.9, -w / 4, H, z0, "#9AA3AD");
  if (rnd() < 0.6) car(c, -2.6, 3.4, 0);
  return H + 1.4;
}

/** A school: a long classroom block with a veranda, and the flag. */
function school(c: BuildCtx): number {
  const { kit, rnd } = c;
  const paint = pick(rnd, ["#F0E2C4", "#EAD7B5", "#F2EBDD"]);
  const dado = pick(rnd, ["#2B5C9A", "#3F6B3A", "#8C2F5A"]);
  const roof = pick(rnd, ZINC);
  const w = 8.4;
  const d = 3.0;
  const h = 3.0;
  const z0 = -2.0;
  kit.box(w, h, d, 0, 0, z0, paint);
  kit.box(w + 0.05, 1.0, d + 0.05, 0, 0, z0, dado);
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + 1.05 + i * 2.1;
    kit.box(0.8, 1.9, 0.08, x - 0.45, 0.1, z0 + d / 2 + 0.04, "#5A3A22");
    kit.box(0.7, 0.8, 0.08, x + 0.45, 1.3, z0 + d / 2 + 0.04, GLASS);
  }
  // Veranda along the classrooms.
  kit.box(w, 0.2, 1.4, 0, 0, z0 + d / 2 + 0.7, CONCRETE);
  columns(c, -w / 2 + 0.3, w / 2 - 0.3, z0 + d / 2 + 1.3, h, 5);
  kit.gable(w + 0.4, d + 2.2, 1.2, 0, h, z0 + 0.5, roof);
  flag(c, 2.8, 3.2, 5.5);
  return h + 1.2;
}

/** A market plot: rows of zinc sheds and umbrellas over tables of goods, traders in between. */
function market(c: BuildCtx): number {
  const { kit, rnd } = c;
  for (const z of [-2.6, 0.4]) {
    for (const x of [-2.4, 2.4]) {
      const roof = pick(rnd, [...RUST, ...ZINC]);
      for (const [dx, dz] of [[-1.5, -1.0], [1.5, -1.0], [-1.5, 1.0], [1.5, 1.0]]) kit.box(0.1, 2.3, 0.1, x + dx, 0, z + dz, "#6E5A45");
      kit.slab(3.6, 0.08, 2.6, x, 2.4, z, roof, 0.15);
      kit.box(2.8, 0.75, 1.0, x, 0, z, "#8C6A4A");
      for (let i = 0; i < 4; i++) kit.ball(0.32, x - 1.0 + i * 0.66, 0.95, z, pick(rnd, GOODS), 0.6);
      if (rnd() < 0.8) figure(c, x + (rnd() - 0.5) * 2, z + 1.4, pick(rnd, BRIGHT), 1);
    }
  }
  // Umbrellas at the front.
  for (const x of [-2.6, 0, 2.6]) {
    kit.cyl(0.04, 0.04, 2.0, x, 0, 3.1, "#DDD", 6);
    kit.cyl(0.02, 1.25, 0.55, x, 2.0, 3.1, pick(rnd, BRIGHT), 8);
    kit.box(1.2, 0.6, 0.7, x, 0, 3.1, "#8C6A4A");
    kit.ball(0.28, x, 0.75, 3.1, pick(rnd, GOODS), 0.6);
  }
  return 3.0;
}

/** A buka: an open shed with benches, the cooking pots at the back. */
function buka(c: BuildCtx): number {
  const { kit, rnd } = c;
  const roof = pick(rnd, RUST);
  const w = 6.4;
  const d = 4.8;
  const h = 2.6;
  for (const x of [-w / 2, 0, w / 2]) for (const z of [-d / 2, d / 2]) kit.box(0.14, h, 0.14, x, 0, z, "#6E5A45");
  kit.box(w + 0.2, 0.15, d + 0.2, 0, 0, 0, CONCRETE);
  kit.hip(w + 1.0, d + 1.0, 1.0, 0, h, 0, roof);
  // Kitchen at the back: a low wall, a counter, pots on the fire.
  kit.box(w, 1.1, 0.25, 0, 0, -d / 2, pick(rnd, ["#C8B79A", "#B9A88C"]));
  kit.box(3.4, 0.9, 0.8, -0.8, 0, -1.5, "#8C6A4A");
  for (let i = 0; i < 3; i++) kit.cyl(0.3, 0.26, 0.45, -2.0 + i * 0.8, 0.9, -1.5, "#2B2F36", 10);
  // Tables and benches out front, and people eating.
  for (const [x, z] of [[-1.8, 0.6], [1.8, 0.6], [0, 1.8]]) {
    kit.box(1.6, 0.75, 0.8, x, 0, z, pick(rnd, ["#2B5C9A", "#C0392B", "#2E7D4F"]));
    kit.box(1.6, 0.42, 0.3, x, 0, z + 0.7, "#8C6A4A");
    if (rnd() < 0.7) figure(c, x, z + 0.75, pick(rnd, BRIGHT), 1, true);
  }
  kit.box(1.8, 0.9, 0.08, w / 2 - 1.2, h - 0.2, d / 2 + 0.3, pick(rnd, BRIGHT));
  return h + 1.0;
}

// ---- Places ----

/** A government building: a portico with columns and a pediment, and a flag. */
function civic(c: BuildCtx, paint: string, floors = 2, flagColours?: string[]): number {
  const { kit, rnd } = c;
  const fh = 3.2;
  const w = 7.6;
  const d = 5.2;
  const z0 = -1.2;
  const H = floors * fh;
  kit.box(w + 0.3, 0.5, d + 0.3, 0, 0, z0, "#B9B3A8");
  kit.box(w, H, d, 0, 0.5, z0, paint);
  for (let f = 0; f < floors; f++) windows(c, w, d, 0.5 + f * fh + 1.2, z0, { gap: 1.6, skip: 0 });
  kit.box(3.4, 0.35, 1.8, 0, 0.5 + H - 0.35, z0 + d / 2 + 0.9, TRIM);
  kit.gable(3.6, 2.0, 0.9, 0, 0.5 + H, z0 + d / 2 + 0.9, TRIM, Math.PI / 2);
  columns(c, -1.4, 1.4, z0 + d / 2 + 1.5, H + 0.15, 4, TRIM, 0.2);
  kit.box(1.4, 2.4, 0.1, 0, 0.5, z0 + d / 2 + 0.04, "#5A3A22");
  if (isFlat(c)) flatRoof(c, w, d, H + 0.5, z0, paint);
  else kit.hip(w + 0.6, d + 0.6, 1.6, 0, H + 0.5, z0, pick(rnd, ["#7E8792", "#8B5A3A", "#2B4C7E"]));
  flag(c, 2.6, 3.4, 6, flagColours);
  return H + 2.1;
}

function mosque(c: BuildCtx): number {
  const { kit } = c;
  const white = "#F1EEE6";
  const green = "#2E7D4F";
  kit.box(6.6, 3.6, 6.0, 0, 0, -0.6, white);
  kit.box(6.7, 0.35, 6.1, 0, 3.6, -0.6, green);
  for (let i = 0; i < 3; i++) kit.box(0.9, 1.8, 0.08, -2.0 + i * 2.0, 0.6, 2.43, "#3A6E5A");
  kit.cyl(1.9, 1.9, 0.9, 0, 3.95, -0.6, white, 16);
  kit.ball(2.0, 0, 4.85, -0.6, green, 0.85, 1);
  kit.cyl(0.04, 0.04, 0.9, 0, 6.5, -0.6, "#D4AF37", 6);
  // The minaret.
  kit.cyl(0.45, 0.55, 8.5, 3.6, 0, 3.2, white, 10);
  kit.cyl(0.75, 0.75, 0.3, 3.6, 6.8, 3.2, green, 10);
  kit.ball(0.5, 3.6, 8.7, 3.2, green, 1, 1);
  return 9.2;
}

function church(c: BuildCtx): number {
  const { kit, rnd } = c;
  const paint = pick(rnd, ["#F2EBDD", "#E6EEF2", "#F0E2C4"]);
  const roof = pick(rnd, ["#B3261E", "#2B4C7E", "#7E8792"]);
  kit.box(4.6, 3.8, 6.8, 0, 0, -0.9, paint);
  kit.gable(7.0, 5.2, 1.9, 0, 3.8, -0.9, roof, Math.PI / 2);
  for (let i = 0; i < 3; i++) for (const x of [-2.33, 2.33]) kit.box(0.08, 1.6, 0.6, x, 1.2, -3.4 + i * 2.2, "#3A6E9A");
  // The bell tower at the front with its cross.
  kit.box(1.9, 7.2, 1.9, 0, 0, 3.2, paint);
  kit.box(0.9, 1.0, 0.1, 0, 5.4, 4.16, GLASS);
  kit.hip(2.3, 2.3, 1.6, 0, 7.2, 3.2, roof);
  kit.box(0.12, 1.3, 0.12, 0, 8.8, 3.2, "#D4AF37");
  kit.box(0.7, 0.12, 0.12, 0, 9.4, 3.2, "#D4AF37");
  kit.box(1.3, 2.4, 0.1, 0, 0, 4.16, "#5A3A22");
  return 10;
}

/** A telecom mast in red and white, with its equipment hut. */
function tower(c: BuildCtx): number {
  const { kit } = c;
  for (let i = 0; i < 6; i++) kit.cyl(0.5 - i * 0.06, 0.56 - i * 0.06, 3, 0, i * 3, -1, i % 2 ? "#F4F1EA" : "#C0392B", 6);
  for (let i = 0; i < 3; i++) kit.box(0.5, 1.0, 0.25, Math.cos(i * 2.1) * 0.6, 15, -1 + Math.sin(i * 2.1) * 0.6, "#D8D8D8", i * 2.1);
  kit.box(2.4, 2.2, 2.0, 2.4, 0, 2.2, "#D8D3C8");
  kit.box(2.6, 0.15, 2.2, 2.4, 2.2, 2.2, "#9AA3AD");
  return 18;
}

/** A mechanic's workshop, or a motor park: a big open shed with vehicles in. */
function shed(c: BuildCtx, vehicles: "cars" | "buses"): number {
  const { kit, rnd } = c;
  const roof = pick(rnd, [...RUST, ...ZINC]);
  for (const x of [-3.6, 0, 3.6]) for (const z of [-3.2, 0.4]) kit.box(0.16, 3.0, 0.16, x, 0, z, "#5E5A55");
  kit.slab(8.0, 0.1, 4.4, 0, 3.15, -1.4, roof, 0.12);
  kit.box(8.0, 0.1, 8.0, 0, 0, 0, "#6F6A64");
  if (vehicles === "buses") {
    danfo(c, -1.8, -1.4, 0);
    danfo(c, 1.8, -1.4, 0);
    danfo(c, 0, 2.6, Math.PI / 2 + 0.2);
    for (let i = 0; i < 4; i++) figure(c, -3 + i * 2, 3.2, pick(rnd, BRIGHT), 1);
  } else {
    car(c, -1.7, -1.4, Math.PI / 2);
    car(c, 1.7, -1.4, Math.PI / 2, pick(rnd, ["#C0392B", "#2B5C9A"]));
    kit.box(1.4, 0.8, 0.6, 2.8, 0, 2.4, "#2B2F36");
    for (let i = 0; i < 4; i++) kit.cyl(0.38, 0.38, 0.28, -2.6 + i * 0.4, 0, 2.8, "#1B1D21", 10);
    figure(c, 0, 1.0, "#26355E", 1);
  }
  return 3.3;
}

/** The flyover: an elevated road on pillars, with people sheltering underneath. */
function flyover(c: BuildCtx): number {
  const { kit, rnd } = c;
  for (const x of [-3.2, 0, 3.2]) kit.box(0.8, 4.2, 0.8, x, 0, 0, CONCRETE);
  kit.box(10, 0.8, 4.2, 0, 4.2, 0, "#B9B3A8");
  kit.box(10, 0.05, 3.6, 0, 5.0, 0, "#4F4F52");
  for (const z of [-2.0, 2.0]) kit.box(10, 0.5, 0.15, 0, 5.0, z, CONCRETE);
  for (let i = 0; i < 4; i++) {
    kit.box(1.5, 0.15, 0.9, -3.5 + i * 2.2, 0, 1.0, pick(rnd, ["#8C6A4A", "#2B5C9A", "#E0A526"]));
    if (rnd() < 0.6) figure(c, -3.5 + i * 2.2, 1.0, pick(rnd, BRIGHT), 1, true);
  }
  return 5.6;
}

/** Shelters of tarpaulin and zinc for people with nowhere else. */
function shelter(c: BuildCtx): number {
  const { kit, rnd } = c;
  for (const [x, z] of [[-2.4, -1.6], [1.2, -2.0], [-0.6, 1.6], [2.6, 1.4]]) {
    const col = pick(rnd, ["#2B5C9A", "#1F7A8C", "#8E979F", "#B5532E"]);
    kit.box(0.08, 1.4, 0.08, x - 0.9, 0, z, STEEL);
    kit.box(0.08, 1.4, 0.08, x + 0.9, 0, z, STEEL);
    kit.slab(2.2, 0.05, 2.0, x, 1.0, z, col, 0.5);
    kit.box(1.6, 0.15, 1.2, x, 0, z + 0.2, "#8C6A4A");
  }
  return 1.6;
}

/** The viewing centre: a shed with a big screen and benches. */
function viewing(c: BuildCtx): number {
  const { kit, rnd } = c;
  for (const x of [-3.4, 3.4]) for (const z of [-3, 2]) kit.box(0.14, 3.0, 0.14, x, 0, z, "#6E5A45");
  kit.hip(7.6, 6.2, 1.0, 0, 3.0, -0.5, pick(rnd, RUST));
  kit.box(7.0, 2.6, 0.3, 0, 0.3, -3.2, "#C8B79A");
  kit.box(3.2, 1.9, 0.12, 0, 0.9, -2.95, "#111418");
  kit.box(2.9, 1.6, 0.04, 0, 1.05, -2.88, "#2E6F95");
  for (let r = 0; r < 3; r++) {
    kit.box(6.0, 0.42, 0.35, 0, 0, -1.2 + r * 1.3, "#8C6A4A");
    for (let i = 0; i < 4; i++) if (rnd() < 0.7) figure(c, -2.4 + i * 1.6, -1.2 + r * 1.3, pick(rnd, BRIGHT), 1, true);
  }
  return 4.0;
}

/** A kiosk: a small shop with an awning, a fridge and an umbrella. */
function kiosk(c: BuildCtx): number {
  const { kit, rnd } = c;
  const paint = pick(rnd, BRIGHT);
  kit.box(2.6, 2.4, 2.2, 0, 0, -1.0, paint);
  kit.box(2.0, 0.9, 0.1, 0, 1.1, 0.15, GLASS);
  kit.slab(3.0, 0.06, 1.2, 0, 2.3, 0.5, "#E0A526", 0.25);
  kit.box(0.8, 1.6, 0.7, 2.0, 0, 0.2, "#E8E8E8");
  kit.cyl(0.04, 0.04, 2.0, -2.2, 0, 1.8, "#DDD", 6);
  kit.cyl(0.02, 1.2, 0.5, -2.2, 2.0, 1.8, pick(rnd, BRIGHT), 8);
  figure(c, -1.4, 1.2, pick(rnd, BRIGHT), 1);
  return 2.6;
}

/** The notice board, under its own little roof. */
function board(c: BuildCtx): number {
  const { kit } = c;
  for (const x of [-1.6, 1.6]) kit.box(0.15, 2.6, 0.15, x, 0, 0, "#5A3A22");
  kit.box(3.4, 1.6, 0.12, 0, 0.9, 0, "#7A5C3E");
  kit.box(3.0, 1.3, 0.04, 0, 1.05, 0.08, "#EFE6D2");
  for (let i = 0; i < 5; i++) kit.box(0.5, 0.6, 0.02, -1.1 + i * 0.55, 1.4 - (i % 2) * 0.5, 0.11, ["#F2B705", "#FFFFFF", "#9ED0E6", "#F7C6C7", "#FFFFFF"][i]);
  kit.gable(3.8, 0.9, 0.4, 0, 2.6, 0, "#8B5A3A");
  return 3.0;
}

/** A row of lock-up shops with coloured shutters. */
function shops(c: BuildCtx): number {
  const { kit, rnd } = c;
  const h = 3.2;
  kit.box(8.4, h, 4.0, 0, 0, -1.4, pick(rnd, PAINT));
  for (let i = 0; i < 4; i++) {
    const x = -3.15 + i * 2.1;
    kit.box(1.7, 2.3, 0.1, x, 0.1, 0.64, pick(rnd, BRIGHT));
    kit.box(1.9, 0.5, 0.12, x, 2.55, 0.66, pick(rnd, ["#F4F1EA", "#F2B705", "#26355E"]));
  }
  kit.slab(8.8, 0.08, 1.6, 0, 2.95, 1.3, pick(rnd, ZINC), 0.2);
  flatRoof(c, 8.4, 4.0, h, -1.4, pick(rnd, PAINT));
  for (let i = 0; i < 3; i++) figure(c, -2.5 + i * 2.5, 2.4, pick(rnd, BRIGHT), 1);
  return h + 0.6;
}

/** A palace: a walled court and a great hall under a tall roof. */
function palace(c: BuildCtx): number {
  const { kit } = c;
  const wall = "#C9A27C";
  kit.box(7.6, 4.0, 5.0, 0, 0, -1.6, wall);
  kit.hip(8.4, 5.8, 3.2, 0, 4.0, -1.6, "#7D4B2E");
  kit.box(2.4, 3.2, 0.2, 0, 0, 0.96, "#5A3A22");
  for (const x of [-2.6, 2.6]) {
    kit.cyl(0.35, 0.4, 4.2, x, 0, 1.6, "#E6D3AE", 8);
    kit.ball(0.45, x, 4.4, 1.6, "#D4AF37", 1, 1);
  }
  for (const x of [-3.0, 3.0]) kit.box(0.08, 1.2, 0.8, x, 1.6, 0.92, GLASS);
  return 7.2;
}

/** The stadium: a bowl of stands round a pitch. */
function stadium(c: BuildCtx): number {
  const { kit } = c;
  kit.box(5.4, 0.06, 3.8, 0, 0, 0, "#5FA049");
  kit.box(0.06, 0.02, 3.6, 0, 0.07, 0, "#F4F1EA");
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = Math.cos(a) * 3.4;
    const z = Math.sin(a) * 3.0;
    kit.slab(1.9, 0.3, 1.4, x, 1.1, z, i % 2 ? "#2E7D4F" : "#F4F1EA", -0.5, -a + Math.PI / 2);
    kit.box(1.4, 2.4, 0.3, Math.cos(a) * 4.0, 0, Math.sin(a) * 3.7, CONCRETE, -a + Math.PI / 2);
  }
  for (const [x, z] of [[-3.8, -3.4], [3.8, 3.4]]) {
    kit.box(0.2, 6, 0.2, x, 0, z, STEEL);
    kit.box(1.0, 0.6, 0.3, x, 6, z, "#F2F2F2");
  }
  return 6.6;
}

/** A hotel: a tall block with its name band and a porch for cars. */
function hotel(c: BuildCtx): number {
  const { kit, rnd } = c;
  const floors = 5;
  const H = floors * 3;
  const paint = pick(rnd, ["#F2EBDD", "#E6EEF2", "#F2D9C8"]);
  kit.box(6.8, H, 5.2, 0, 0, -1.2, paint);
  for (let f = 0; f < floors; f++) windows(c, 6.8, 5.2, f * 3 + 1.2, -1.2, { gap: 1.4 });
  kit.box(4.0, 0.9, 0.15, 0, H - 1.4, 1.45, pick(rnd, ["#26355E", "#8C2F5A", "#2E7D4F"]));
  kit.box(3.6, 0.25, 2.2, 0, 3.0, 2.4, TRIM);
  columns(c, -1.6, 1.6, 3.3, 3.0, 2, TRIM);
  flatRoof(c, 6.8, 5.2, H, -1.2, paint);
  car(c, 0, 3.0, 0, "#2B2F36");
  return H + 0.6;
}

/** A shopping mall: a big box with a glass front and cars outside. */
function mall(c: BuildCtx): number {
  const { kit, rnd } = c;
  kit.box(8.6, 5.0, 5.4, 0, 0, -1.6, "#E6E2D8");
  kit.box(6.4, 3.6, 0.1, 0, 0.3, 1.12, "#5B8DB8");
  kit.box(8.8, 0.8, 0.3, 0, 4.4, 1.2, pick(rnd, ["#C0392B", "#2E7D4F", "#2B5C9A"]));
  flatRoof(c, 8.6, 5.4, 5.0, -1.6, "#E6E2D8");
  for (const x of [-3, 0, 3]) car(c, x, 3.2, Math.PI / 2);
  return 5.6;
}

/** A nightclub: a dark block with neon bands, a canopy, the rope line and bouncers, cars outside. */
function club(c: BuildCtx): number {
  const { kit, rnd } = c;
  const neon = pick(rnd, ["#FF2D95", "#8A2BE2", "#00E5FF", "#FFB000"]);
  const h = 7.0;
  kit.box(7.6, h, 5.6, 0, 0, -1.2, "#1C1D24");
  for (const y of [2.6, 5.0]) kit.box(7.7, 0.18, 5.7, 0, y, -1.2, neon);
  kit.box(4.4, 1.0, 0.12, 0, h - 1.6, 1.62, neon);
  kit.box(1.8, 2.4, 0.1, 0, 0, 1.62, "#0E0F14");
  kit.box(3.4, 0.15, 1.6, 0, 2.6, 2.4, "#2B2F36");
  // The rope line: brass posts and a red rope along the front.
  for (const x of [-2.6, -1.3, 1.3, 2.6]) kit.box(0.08, 1.0, 0.08, x, 0, 3.0, "#C9A227");
  for (const x of [-1.95, 1.95]) kit.box(1.3, 0.05, 0.05, x, 0.85, 3.0, "#B3261E");
  figure(c, -1.0, 2.0, "#111111", 1.1);
  figure(c, 1.0, 2.0, "#111111", 1.1);
  for (let i = 0; i < 3; i++) figure(c, -3.0 + i * 0.6, 3.6, pick(rnd, BRIGHT), 1);
  flatRoof(c, 7.6, 5.6, h, -1.2, "#1C1D24");
  car(c, 3.3, 0.6, Math.PI / 2, "#2B2F36");
  return h + 0.6;
}

/** A relaxation spot: a shaded yard with plastic chairs, a big screen and the suya grill smoking. */
function lounge(c: BuildCtx): number {
  const { kit, rnd } = c;
  const roof = pick(rnd, ["#2E7D4F", "#1F7A8C", "#8C2F5A"]);
  for (const x of [-3.4, 0, 3.4]) for (const z of [-3.0, 1.8]) kit.box(0.14, 2.8, 0.14, x, 0, z, "#6E5A45");
  kit.slab(7.6, 0.08, 5.6, 0, 2.95, -0.6, roof, 0.08);
  kit.box(7.0, 2.4, 0.3, 0, 0, -3.3, "#E6D3AE");
  kit.box(3.0, 1.7, 0.12, 0, 0.8, -3.05, "#111418");
  kit.box(2.7, 1.4, 0.04, 0, 0.95, -2.98, "#2E7D4F");
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 4; i++) {
      kit.box(0.5, 0.45, 0.5, -2.4 + i * 1.6, 0, -1.2 + r * 1.6, pick(rnd, ["#F4F1EA", "#C0392B", "#2B5C9A"]));
      if (rnd() < 0.6) figure(c, -2.4 + i * 1.6, -1.2 + r * 1.6, pick(rnd, BRIGHT), 1, true);
    }
  }
  // The suya man's grill out front, with its smoke.
  kit.box(1.6, 0.9, 0.7, -2.6, 0, 3.2, "#3A3F45");
  kit.box(1.5, 0.05, 0.6, -2.6, 0.92, 3.2, "#C0392B");
  for (let i = 0; i < 3; i++) kit.ball(0.25 + i * 0.08, -2.6 + i * 0.15, 1.4 + i * 0.5, 3.2, "#D8D3C8", 1);
  figure(c, -2.6, 3.9, "#F4F1EA", 1);
  return 3.2;
}

/** A train station: the station house, a long platform under a canopy, rails and a train at the platform. */
function trainstation(c: BuildCtx): number {
  const { kit } = c;
  // Rails across the back of the plot.
  for (const z of [-3.2, -2.2]) kit.box(9, 0.1, 0.12, 0, 0, z, "#6E6A64");
  for (let x = -4.2; x <= 4.2; x += 0.7) kit.box(0.2, 0.06, 1.6, x, 0, -2.7, "#5A3A22");
  // The train: a green and white coach.
  kit.box(8.4, 2.2, 1.5, 0, 0.3, -2.7, "#2E7D4F");
  kit.box(8.42, 0.5, 1.52, 0, 1.3, -2.7, "#F4F1EA");
  for (let i = 0; i < 6; i++) kit.box(0.8, 0.5, 1.54, -3.4 + i * 1.36, 1.3, -2.7, "#2F3D48");
  // Platform and canopy.
  kit.box(9, 0.6, 2.2, 0, 0, -0.6, "#C9C3B6");
  for (const x of [-3.6, 0, 3.6]) kit.box(0.2, 2.8, 0.2, x, 0.6, -0.6, "#5E6B73");
  kit.slab(8.8, 0.12, 2.8, 0, 3.5, -0.6, "#B5532E", -0.08);
  // The station house with its clock.
  kit.box(5.2, 3.2, 2.4, 0, 0, 2.2, "#E8DCC4");
  kit.hip(5.8, 3.0, 1.3, 0, 3.2, 2.2, "#8B5A3A");
  kit.box(1.2, 2.2, 0.08, 0, 0, 3.42, "#5A3A22");
  kit.cyl(0.35, 0.35, 0.08, 0, 2.6, 3.44, "#F4F1EA", 14, Math.PI / 2);
  for (const x of [-1.8, 1.8]) kit.box(0.9, 1.0, 0.08, x, 1.2, 3.42, "#2F3D48");
  for (let i = 0; i < 3; i++) figure(c, -2.5 + i * 2.5, -0.6, ["#26355E", "#C0392B", "#2F7D7A"][i], 1);
  return 4.5;
}

/** A bus terminal: a long canopy over the loading bays, coaches and danfos lined up, a ticket office. */
function busterminal(c: BuildCtx): number {
  const { kit } = c;
  kit.box(9, 0.08, 9, 0, 0, 0, "#6F6A64");
  for (const x of [-3.8, -1.3, 1.3, 3.8]) for (const z of [-3.4, 0.4]) kit.box(0.18, 3.6, 0.18, x, 0, z, "#5E6B73");
  kit.slab(8.6, 0.12, 4.6, 0, 3.75, -1.5, "#2E7D4F", 0.05);
  // Coaches in the bays.
  for (const x of [-2.6, 0, 2.6]) {
    kit.box(1.6, 1.9, 3.6, x, 0.3, -1.5, "#F4F1EA");
    kit.box(1.62, 0.55, 3.0, x, 1.4, -1.5, "#2F3D48");
    kit.box(1.62, 0.25, 3.62, x, 0.8, -1.5, "#2B5C9A");
  }
  danfo(c, -2.2, 2.6, Math.PI / 2);
  // Ticket office and benches with travellers.
  kit.box(2.4, 2.4, 1.6, 3.0, 0, 2.8, "#E8DCC4");
  kit.box(1.8, 0.5, 0.1, 3.0, 2.0, 3.62, "#F2B705");
  kit.box(2.6, 0.42, 0.5, 0.6, 0, 3.4, "#8C6A4A");
  for (let i = 0; i < 3; i++) figure(c, -0.2 + i * 0.8, 3.4, ["#8C2F5A", "#F4F1EA", "#26355E"][i], 1, true);
  return 4.0;
}

/** Klario Bank: a teal-banded glass tower (one of the two tallest in town), the banking hall at its foot. */
function bank(c: BuildCtx): number {
  const { kit } = c;
  const teal = "#0FA3A3";
  const floors = 11;
  const fh = 3.1;
  const H = floors * fh;
  // The tower narrows in two steps as it rises.
  kit.box(7.2, 4.2, 6.0, 0, 0, -1.0, "#1C2A3A");
  kit.box(6.8, 3.0, 0.08, 0, 0.6, 2.02, "#5B8DB8");
  kit.box(6.0, H * 0.6, 5.0, 0, 4.2, -1.2, "#3D6E8F");
  kit.box(4.6, H * 0.4, 4.0, 0, 4.2 + H * 0.6, -1.2, "#3D6E8F");
  for (let f = 1; f <= floors; f++) {
    const y = 4.2 + f * fh - 0.3;
    const wide = y < 4.2 + H * 0.6;
    kit.box(wide ? 6.15 : 4.75, 0.25, wide ? 5.15 : 4.15, 0, y, -1.2, f % 3 === 0 ? teal : "#E6E2D8");
  }
  // The name band and the logo near the top, and a crown of light.
  kit.box(4.8, 1.0, 0.12, 0, 4.2 + H - 2.0, 0.86, teal);
  kit.box(3.4, 0.6, 3.2, 0, 4.2 + H, -1.2, teal);
  kit.cyl(0.08, 0.08, 4, 0, 4.2 + H + 0.6, -1.2, "#D8D8D8", 6);
  // Canopy and the ATM kiosk by the door.
  kit.box(3.6, 0.2, 1.8, 0, 3.0, 2.8, "#E6E2D8");
  columns(c, -1.6, 1.6, 3.5, 3.0, 2, "#E6E2D8", 0.12);
  kit.box(1.0, 2.0, 0.8, 3.2, 0, 2.6, teal);
  kit.box(0.6, 0.5, 0.05, 3.2, 1.0, 3.02, "#111418");
  figure(c, 3.2, 3.4, "#26355E", 1);
  return 4.2 + H + 4.6;
}

/** Raavon: the tallest tower in town, purple floor bands, its logo cube on the roof, a plaza with bikes. */
function techhub(c: BuildCtx): number {
  const { kit, rnd } = c;
  const brand = "#6C3CE1";
  const floors = 13;
  const fh = 3.0;
  const H = floors * fh;
  kit.box(6.2, H, 5.0, 0, 0, -1.6, "#3D6E8F");
  for (let f = 1; f <= floors; f++) kit.box(6.4, 0.28, 5.2, 0, f * fh - 0.28, -1.6, f % 2 ? brand : "#E6E2D8");
  // A glass fin running up one corner.
  kit.box(0.6, H + 3, 0.6, 3.0, 0, 0.8, brand);
  kit.box(6.6, 3.4, 5.4, 0, 0, -1.6, "#1C1D24");
  kit.box(4.0, 2.4, 0.08, 0, 0.4, 1.12, "#9ED0E6");
  // The logo cube on the roof.
  kit.box(2.4, 2.4, 2.4, 0, H + 0.4, -1.6, brand);
  kit.box(1.5, 1.5, 2.5, 0, H + 0.85, -1.6, "#F4F1EA");
  // Plaza: benches, a bike rack, people on laptops.
  kit.box(8.2, 0.08, 2.6, 0, 0, 2.6, "#D8D3C8");
  for (const x of [-2.8, 2.8]) kit.box(1.6, 0.42, 0.5, x, 0, 2.8, "#8C6A4A");
  for (let i = 0; i < 4; i++) kit.cyl(0.32, 0.32, 0.06, -1.2 + i * 0.8, 0.35, 3.5, "#2B2F36", 10, Math.PI / 2);
  for (let i = 0; i < 3; i++) figure(c, -2.8 + i * 2.8, 2.6, pick(rnd, ["#F4F1EA", "#26355E", brand]), 1, true);
  return H + 3;
}

/** A big restaurant tower: glass floors over a busy ground-floor dining room, its name band lit up. */
function restaurant(c: BuildCtx): number {
  const { kit, rnd } = c;
  const brand = pick(rnd, ["#E67E22", "#C0392B", "#E0A526"]);
  const floors = 7;
  const fh = 3.0;
  const H = floors * fh;
  kit.box(7.0, H, 6.0, 0, 0, -1.0, "#4F7FA6");
  for (let f = 0; f <= floors; f++) kit.box(7.2, 0.3, 6.2, 0, f * fh - (f ? 0.3 : 0), -1.0, "#EDE7DA");
  for (const x of [-3.3, 3.3]) kit.box(0.5, H, 0.5, x, 0, 1.75, brand);
  // The ground floor: open dining with a canopy and umbrellas outside.
  kit.box(6.6, 2.6, 0.08, 0, 0.3, 2.0, "#9ED0E6");
  kit.box(7.6, 0.25, 1.8, 0, 3.0, 2.9, brand);
  kit.box(5.0, 1.2, 0.2, 0, H - 2.2, 2.05, brand);
  for (const x of [-2.4, 0, 2.4]) {
    kit.cyl(0.04, 0.04, 2.0, x, 0, 3.3, "#DDD", 6);
    kit.cyl(0.02, 1.0, 0.45, x, 2.0, 3.3, brand, 8);
    kit.box(0.9, 0.7, 0.9, x, 0, 3.3, "#F4F1EA");
    if (rnd() < 0.8) figure(c, x + 0.6, 3.3, pick(rnd, BRIGHT), 1, true);
  }
  kit.box(2.4, 1.6, 2.0, 1.6, H, -1.8, "#EDE7DA");
  return H + 1.6;
}

/** A village: round huts with thatched roofs. */
function village(c: BuildCtx): number {
  const { kit, rnd } = c;
  for (const [x, z] of [[-2.2, -1.8], [2.0, -2.2], [0, 1.6], [-2.6, 2.4], [2.6, 2.0]]) {
    const r = between(rnd, 1.0, 1.4);
    kit.cyl(r, r, 1.8, x, 0, z, pick(rnd, ["#B98E5E", "#A9733F", "#C49A6C"]), 10);
    kit.cyl(0.05, r + 0.5, 1.6, x, 1.8, z, "#C9A85A", 10);
  }
  return 3.4;
}

/** An open square with a monument in the middle. */
function square(c: BuildCtx): number {
  const { kit } = c;
  kit.box(8.4, 0.12, 8.4, 0, 0, 0, "#D8D0C0");
  kit.cyl(1.6, 1.8, 0.6, 0, 0.12, 0, "#B9B3A8", 12);
  kit.box(0.8, 4.0, 0.8, 0, 0.7, 0, "#E6E2D8");
  kit.ball(0.6, 0, 5.2, 0, "#C9A227", 1, 1);
  return 5.8;
}

/** A state landmark, as a shape: rocks, water, a tower, forest, a bridge. */
function landmark(c: BuildCtx, kind: string): number {
  const { kit, rnd } = c;
  switch (kind) {
    case "lm-hills":
    case "lm-rock":
      for (const [x, z, r] of [[0, -0.5, 3.2], [-2.4, 1.6, 2.0], [2.6, 1.8, 1.7]] as const) kit.ball(r, x, r * 0.55, z, pick(rnd, ["#8F877C", "#9C9284", "#7E766C"]), 0.85, 1);
      return 5.4;
    case "lm-water":
      kit.cyl(3.8, 3.8, 0.1, 0, 0, 0, "#4F8FA6", 16);
      kit.box(0.9, 0.15, 3.6, 2.0, 0.3, 2.2, "#8C6A4A");
      kit.box(2.2, 0.6, 0.9, -1.2, 0.1, -0.6, "#B5532E", 0.4);
      return 1;
    case "lm-tower":
      return tower(c);
    case "lm-bridge":
      for (let i = 0; i < 6; i++) kit.slab(1.5, 0.4, 2.4, -3.6 + i * 1.44, 1.0 + Math.sin((i / 5) * Math.PI) * 1.2, 0, "#B9B3A8", 0, 0, 0);
      return 3;
    case "lm-palace":
      return palace(c);
    case "lm-market":
      return market(c);
    default:
      for (let i = 0; i < 7; i++) tree(c, "neem", (rnd() - 0.5) * 4.4, (rnd() - 0.5) * 4.4, 0.9 + rnd() * 0.4);
      return 6;
  }
}

// ---- Trees ----

/** A tree: a palm, a neem, a baobab or a mangrove. s scales it. */
export function tree(c: BuildCtx, kind: string, x: number, z: number, s = 1) {
  const { kit, rnd } = c;
  const leaf = pick(rnd, ["#4E7A34", "#5E8C3A", "#3F6B2A", "#6B9440"]);
  if (kind === "palm") {
    const lean = (rnd() - 0.5) * 0.25;
    kit.cyl(0.12 * s, 0.2 * s, 5 * s, x, 0, z, "#7A5C3E", 6, 0, lean);
    const top = 5 * s;
    const tx = x - Math.sin(lean) * top;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rnd();
      kit.slab(2.4 * s, 0.06, 0.5 * s, tx + Math.cos(a) * 1.0 * s, top - 0.25 * s, z + Math.sin(a) * 1.0 * s, leaf, 0, -a, -0.45);
    }
    return;
  }
  if (kind === "baobab") {
    kit.cyl(0.6 * s, 0.9 * s, 3 * s, x, 0, z, "#8A7765", 8);
    for (let i = 0; i < 3; i++) kit.ball(1.3 * s, x + (i - 1) * 0.9 * s, 3.4 * s, z + (rnd() - 0.5) * s, leaf, 0.55);
    return;
  }
  if (kind === "mangrove") {
    for (let i = 0; i < 3; i++) kit.cyl(0.05 * s, 0.08 * s, 1.0 * s, x + (i - 1) * 0.3 * s, 0, z, "#5E4A38", 5);
    kit.ball(1.3 * s, x, 1.9 * s, z, leaf, 0.7);
    return;
  }
  kit.cyl(0.18 * s, 0.26 * s, 2.0 * s, x, 0, z, "#6B4F37", 6);
  kit.ball(1.4 * s, x, 2.9 * s, z, leaf, 0.85);
  kit.ball(1.0 * s, x + 0.7 * s, 3.4 * s, z - 0.3 * s, leaf, 0.8);
}

/** Builders for the town's ordinary buildings, by kind. */
const ORDINARY: Record<string, (c: BuildCtx) => number> = { house, duplex, flats, compound, shacks, office, school, market, buka };

/**
 * Draw one building of this kind on its plot. Ordinary buildings and the places you visit both come
 * through here. Returns the height of its top, for the name sign.
 */
export function build(kind: string, c: BuildCtx): number {
  const ordinary = ORDINARY[kind];
  if (ordinary) return ordinary(c);
  switch (kind) {
    case "mosque": return mosque(c);
    case "church": return church(c);
    case "tower": return tower(c);
    case "workshop": return shed(c, "cars");
    case "garage": return shed(c, "buses");
    case "flyover": return flyover(c);
    case "shelter": return shelter(c);
    case "viewing": return viewing(c);
    case "kiosk": return kiosk(c);
    case "board": return board(c);
    case "club": return club(c);
    case "bank": return bank(c);
    case "trainstation": return trainstation(c);
    case "busterminal": return busterminal(c);
    case "techhub": return techhub(c);
    case "restaurant": return restaurant(c);
    case "lounge": return lounge(c);
    case "inec": return civic(c, "#F2EBDD", 2, ["#118A4F", "#F4F1EA", "#118A4F"]);
    case "townhall": return civic(c, "#E8DCC4", 2);
    case "govhouse": return civic(c, "#F4EFE4", 3);
    case "palace":
    case "lm-palace": return palace(c);
    case "stadium": return stadium(c);
    case "hotel": return hotel(c);
    case "mall": return mall(c);
    case "hub": return office(c);
    case "estate": return duplex(c);
    case "oldtown": return compound(c);
    case "shops": return shops(c);
    case "square":
    case "junction": return square(c);
    case "village":
    case "farmstop": return village(c);
    case "campus":
    case "poly":
    case "kwasu": return civic(c, "#EAD7B5", 3, ["#26355E", "#F2B705", "#26355E"]);
    case "garden":
      for (let i = 0; i < 6; i++) tree(c, BIOMES[c.biome].trees[i % 3] || "neem", (c.rnd() - 0.5) * 3.4, (c.rnd() - 0.5) * 3.4);
      return 5;
    case "airport": return kiosk(c);
    default:
      if (kind.startsWith("lm-")) return landmark(c, kind);
      return civic(c, pick(c.rnd, PAINT), 2);
  }
}
