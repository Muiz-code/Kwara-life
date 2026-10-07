// Placeholder building tiles, drawn in Pixi Graphics while the artist works.
// Ported from the building(id,L) switch in reference/naija-votes-2027.html so the
// maps keep the prototype's proportions and colours until real art lands.
import { Graphics } from "pixi.js";
import type { Biome } from "../data/biomes";
import { PLACE_KINDS, type PlaceKind } from "./types";

/** Windows that light up at night, relative to the tile's place point. */
export interface GlowRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TileDrawn {
  /** Topmost y of the drawing, relative to the place point (negative, upwards). */
  top: number;
  glow: GlowRect[];
}

/** Kinds with drawn Higgsfield art already, so no placeholder is needed. */
export const KIND_ART: Partial<Record<PlaceKind, string>> = {
  house: "/assets/home.webp",
  office: "/assets/secretariat.webp",
  market: "/assets/okeodo.webp",
  buka: "/assets/amala.webp",
  garage: "/assets/sawmill.webp",
  junction: "/assets/postoffice.webp",
  palace: "/assets/palace.webp",
  oldtown: "/assets/adabata.webp",
  shops: "/assets/taiwo.webp",
  stadium: "/assets/stadium.webp",
  estate: "/assets/adewole.webp",
  airport: "/assets/airport.webp",
  square: "/assets/metro.webp",
  hotel: "/assets/hotel.webp",
  hub: "/assets/hub.webp",
  govhouse: "/assets/govhouse.webp",
  garden: "/assets/flower.webp",
  mall: "/assets/mall.webp",
  campus: "/assets/unilorin.webp",
  poly: "/assets/poly.webp",
  village: "/assets/shao.webp",
  farmstop: "/assets/farm.webp",
  kwasu: "/assets/kwasu.webp",
};

/** Kinds that still need art drawn by the artist; the game draws them in code for now. */
export const MISSING_ART: PlaceKind[] = PLACE_KINDS.filter((k) => !KIND_ART[k]);

interface Stroke {
  width: number;
  color: number;
  alpha?: number;
}

/** CSS hex colour to a Pixi colour number. */
function hex(c: string): number {
  return parseInt(c.replace("#", ""), 16);
}

// The prototype's default building outline, rgba(60,40,20,.35).
const WALL_INK: Stroke = { width: 1, color: 0x3c2814, alpha: 0.35 };
const SOFT_INK: Stroke = { width: 1, color: 0x000000, alpha: 0.25 };
const GLASS = 0x86a9bd;

/** The prototype's isometric box: right side, top face, then the front wall. */
function box(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  d: number,
  face: number,
  side: number,
  top: number,
  stroke: Stroke = WALL_INK,
) {
  const l = x - w / 2;
  const r = x + w / 2;
  const t = y - h;
  const dy = d * 0.5;
  g.poly([r, y, r + d, y - dy, r + d, t - dy, r, t]).fill(side).stroke(stroke);
  g.poly([l, t, r, t, r + d, t - dy, l + d, t - dy]).fill(top).stroke(stroke);
  g.rect(l, t, w, h).fill(face).stroke(stroke);
}

/** A window that the night pass lights up. */
function win(g: Graphics, glow: GlowRect[], x: number, y: number, w: number, h: number) {
  glow.push({ x, y, w, h });
  g.roundRect(x, y, w, h, 1.5).fill(GLASS);
}

/** Walks a chain of SVG style relative quadratic curves, so the ported paths stay readable. */
function quads(g: Graphics, x: number, y: number, segs: [number, number, number, number][]) {
  let cx = x;
  let cy = y;
  g.moveTo(cx, cy);
  for (const [dx1, dy1, dx, dy] of segs) {
    g.quadraticCurveTo(cx + dx1, cy + dy1, cx + dx, cy + dy);
    cx += dx;
    cy += dy;
  }
}

function tree(g: Graphics, x: number, y: number, s: number, kind: string) {
  if (kind === "palm") {
    g.ellipse(x, y + 2, 12 * s, 4 * s).fill({ color: 0x000000, alpha: 0.12 });
    g.moveTo(x, y).quadraticCurveTo(x + 3 * s, y - 18 * s, x - 1 * s, y - 34 * s)
      .stroke({ width: 3.5 * s, color: 0x7a5634, cap: "round" });
    const fx = x - 1 * s;
    const fy = y - 34 * s;
    const fronds: [number, number, number, number][][] = [
      [[-16 * s, -4 * s, -22 * s, 8 * s], [10 * s, -12 * s, 22 * s, -8 * s]],
      [[16 * s, -4 * s, 22 * s, 8 * s], [-10 * s, -12 * s, -22 * s, -8 * s]],
      [[-6 * s, -14 * s, -16 * s, -14 * s], [12 * s, 2 * s, 16 * s, 14 * s]],
      [[8 * s, -14 * s, 18 * s, -12 * s], [-12 * s, 2 * s, -18 * s, 12 * s]],
    ];
    for (const f of fronds) {
      quads(g, fx, fy, f);
      g.fill(0x4e8a3f);
    }
    return;
  }
  if (kind === "baobab") {
    g.ellipse(x, y + 2, 20 * s, 5 * s).fill({ color: 0x000000, alpha: 0.13 });
    g.moveTo(x - 7 * s, y)
      .quadraticCurveTo(x - 5 * s, y - 18 * s, x - 6 * s, y - 30 * s)
      .lineTo(x + 6 * s, y - 30 * s)
      .quadraticCurveTo(x + 5 * s, y - 18 * s, x + 7 * s, y)
      .fill(0x8a6a4a);
    g.ellipse(x, y - 36 * s, 24 * s, 11 * s).fill(0x6e8a3f);
    return;
  }
  g.ellipse(x, y + 2, 16 * s, 5 * s).fill({ color: 0x000000, alpha: 0.13 });
  g.rect(x - 2.5 * s, y - 14 * s, 5 * s, 16 * s).fill(0x6b4a2b);
  g.circle(x, y - 20 * s, 15 * s).fill(0x3f6b3a);
  g.circle(x - 6 * s, y - 25 * s, 9 * s).fill(0x56854a);
  g.circle(x + 6 * s, y - 17 * s, 7 * s).fill(0x335a30);
}

/** The biome trees: neem and mangrove on top of the three basic shapes. */
function tree2(g: Graphics, x: number, y: number, s: number, kind: string) {
  if (kind === "neem") {
    g.ellipse(x, y + 2, 16 * s, 5 * s).fill({ color: 0x000000, alpha: 0.13 });
    g.rect(x - 2.5 * s, y - 14 * s, 5 * s, 16 * s).fill(0x6b4a2b);
    g.ellipse(x, y - 22 * s, 19 * s, 13 * s).fill(0x7a9a4a);
    g.ellipse(x - 5 * s, y - 26 * s, 9 * s, 6 * s).fill(0x93b25c);
    return;
  }
  if (kind === "mangrove") {
    quads(g, x - 10 * s, y, [
      [4 * s, -12 * s, 10 * s, -14 * s],
      [6 * s, 2 * s, 10 * s, 14 * s],
    ]);
    g.stroke({ width: 2 * s, color: 0x5a4030 });
    g.ellipse(x, y - 22 * s, 18 * s, 11 * s).fill(0x3f6b3a);
    return;
  }
  tree(g, x, y, s, kind);
}

function smallHouse(g: Graphics, x: number, y: number, wall: number, roof: number) {
  box(g, x, y, 30, 18, 12, wall, 0xcdb58f, 0xe2cba1);
  g.poly([x - 17, y - 17, x + 15, y - 17, x + 28, y - 24, x - 4, y - 24]).fill(roof).stroke(SOFT_INK);
}

/** A biome house: flat roof up north, pitched roof down south. */
function bhouse(g: Graphics, x: number, y: number, wall: number, roof: number, w: number, flat: boolean) {
  if (flat) {
    box(g, x, y, w, 18, 12, wall, 0xb9834b, 0xc99257);
    g.rect(x - w / 2, y - 21, w, 4).fill(roof);
    return;
  }
  box(g, x, y, w, 18, 12, wall, 0xcdb58f, 0xe2cba1);
  g.poly([x - w / 2 - 2, y - 17, x + w / 2, y - 17, x + w / 2 + 13, y - 24, x - w / 2 + 11, y - 24])
    .fill(roof)
    .stroke(SOFT_INK);
}

/** A parked korope, the prototype's bus at scale .55. */
function busSmall(g: Graphics, x: number, y: number, colour: number) {
  const s = 0.55;
  g.roundRect(x - 46 * s, y - 44 * s, 92 * s, 40 * s, 10 * s)
    .fill(colour)
    .stroke({ width: 1, color: 0x000000, alpha: 0.35 });
  g.roundRect(x - 40 * s, y - 40 * s, 78 * s, 14 * s, 3 * s).fill(0x9cc3d5);
  g.circle(x - 28 * s, y - 2 * s, 8 * s).fill(0x222222);
  g.circle(x + 28 * s, y - 2 * s, 8 * s).fill(0x222222);
}

function cow(g: Graphics, x: number, y: number) {
  g.ellipse(x, y - 8, 11, 6).fill(0xf4f1ea).stroke({ width: 1, color: 0x999999 });
  g.circle(x + 11, y - 11, 4).fill(0xf4f1ea).stroke({ width: 1, color: 0x999999 });
  g.moveTo(x + 9, y - 15).lineTo(x + 6, y - 20).moveTo(x + 13, y - 15).lineTo(x + 16, y - 20)
    .stroke({ width: 1.5, color: 0x8a6a45 });
  for (const d of [-7, -2, 4, 8]) g.rect(x + d, y - 4, 2, 6).fill(0x999999);
  g.circle(x - 3, y - 9, 3).fill(0x8a6a45);
}

/** The prototype's private car, drawn at scale s around (x, y). */
function car(g: Graphics, x: number, y: number, s: number, colour: number) {
  const px = (v: number) => x + v * s;
  const py = (v: number) => y + v * s;
  g.ellipse(px(0), py(4), 34 * s, 6 * s).fill({ color: 0x000000, alpha: 0.25 });
  g.moveTo(px(-34), py(0))
    .lineTo(px(-34), py(-16))
    .quadraticCurveTo(px(-34), py(-22), px(-26), py(-24))
    .lineTo(px(-16), py(-36))
    .lineTo(px(16), py(-36))
    .lineTo(px(26), py(-24))
    .quadraticCurveTo(px(34), py(-22), px(34), py(-16))
    .lineTo(px(34), py(0))
    .fill(colour)
    .stroke({ width: 2 * s, color: 0x000000, alpha: 0.4 });
  g.poly([px(-14), py(-34), px(14), py(-34), px(22), py(-24), px(-22), py(-24)]).fill(0x9cc3d5);
  g.circle(px(-20), py(2), 7 * s).fill(0x222222);
  g.circle(px(20), py(2), 7 * s).fill(0x222222);
}

/**
 * Draws a tile for a place into g, with the place point at (0, 0): the building
 * stands on that point and rises upwards (negative y).
 */
export function drawTile(
  g: Graphics,
  kind: PlaceKind,
  biome: Biome,
  opts?: { variant?: string },
): TileDrawn {
  // The place point is the origin here, where the prototype worked in world pixels.
  const x = 0;
  const y = 0;
  const glow: GlowRect[] = [];
  const wall = hex(biome.wall[0]);
  const roof = hex(biome.roof[0]);
  const roof2 = hex(biome.roof[1] ?? biome.roof[0]);
  const flat = !!biome.flat;
  const trees = biome.trees;
  let top = y - 60;

  switch (kind) {
    case "house": {
      const cls = opts?.variant ?? "poor";
      if (cls === "rich") {
        g.roundRect(x - 90, y - 40, 180, 84, 6).fill({ color: 0x7fb06a, alpha: 0.7 });
        box(g, x, y, 110, 70, 30, 0xf7f4ee, 0xdcd6ca, 0xece7dd);
        g.rect(x - 55, y - 74, 110, 6).fill(0x2b2b2b);
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 3; c++) win(g, glow, x - 44 + c * 32, y - 62 + r * 30, 22, 16);
        }
        car(g, x + 80, y + 30, 0.6, 0x1f1f1f);
        g.moveTo(x - 90, y + 44).lineTo(x + 90, y + 44).stroke({ width: 3, color: 0x555555 });
        top = y - 90;
      } else if (cls === "mid" || cls === "middle") {
        box(g, x, y, 100, 42, 26, 0xf0e2c4, 0xd4c7ac, 0xe6dac1);
        g.poly([x - 56, y - 40, x + 50, y - 40, x + 76, y - 53, x - 30, y - 53])
          .fill(roof2)
          .stroke({ width: 1, color: 0x000000, alpha: 0.3 });
        win(g, glow, x - 40, y - 30, 20, 14);
        win(g, glow, x + 20, y - 30, 20, 14);
        g.rect(x - 9, y - 24, 18, 24).fill(0x6b4a2b);
        g.moveTo(x - 70, y + 20).lineTo(x + 70, y + 20).stroke({ width: 4, color: 0x999999 });
        top = y - 60;
      } else {
        box(g, x, y, 92, 40, 24, wall, 0xcdb58f, 0xe2cba1);
        if (flat) g.rect(x - 46, y - 44, 92, 5).fill(roof);
        else {
          g.poly([x - 50, y - 38, x + 48, y - 38, x + 72, y - 50, x - 26, y - 50])
            .fill(0xa9b0b8)
            .stroke({ width: 1, color: 0x5e6570 });
        }
        g.rect(x - 8, y - 24, 16, 24).fill(0x6b4a2b);
        win(g, glow, x - 36, y - 30, 16, 12);
        win(g, glow, x + 20, y - 30, 16, 12);
        // The blue water tank every poor house keeps beside the wall.
        g.roundRect(x + 52, y - 14, 16, 16, 3).fill(0x2b6cb0);
        top = y - 60;
      }
      break;
    }

    case "flyover": {
      g.rect(x - 120, y - 64, 240, 18).fill(0x9aa3ad).stroke({ width: 1, color: 0x5e6570 });
      g.rect(x - 120, y - 68, 240, 5).fill(0xc4cbd2);
      for (const d of [-90, 0, 90]) g.rect(x + d - 8, y - 46, 16, 50).fill(0x8e96a3);
      g.roundRect(x - 50, y - 6, 44, 10, 3).fill(0x8c2f5a);
      g.roundRect(x + 14, y - 12, 22, 16, 3).fill(0x5b7f95);
      top = y - 70;
      break;
    }

    case "workshop": {
      g.poly([x - 70, y, x - 70, y - 40, x, y - 54, x + 70, y - 40, x + 70, y])
        .fill(0xc9a06b)
        .stroke({ width: 1, color: 0x8a6a45 });
      g.moveTo(x - 80, y - 40).lineTo(x, y - 58).lineTo(x + 80, y - 40)
        .stroke({ width: 8, color: 0x9aa3ad });
      for (let i = 0; i < 4; i++) g.rect(x - 60 + i * 10, y - 30, 6, 30).fill(0xb9834b);
      g.rect(x + 10, y - 22, 44, 8).fill(0x8a6a45);
      top = y - 62;
      break;
    }

    case "office": {
      box(g, x, y, 100, 74, 28, 0xe9e2d2, 0xcfc7b6, 0xddd5c3);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) win(g, glow, x - 42 + c * 22, y - 66 + r * 20, 14, 12);
      }
      top = y - 90;
      break;
    }

    case "tower": {
      box(g, x, y, 70, 150, 26, 0x5b7f95, 0x45657a, 0x6e93aa, { width: 1, color: 0x2e465e });
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 3; c++) win(g, glow, x - 28 + c * 20, y - 142 + r * 20, 14, 12);
      }
      top = y - 170;
      break;
    }

    case "inec": {
      box(g, x, y, 120, 46, 28, 0xf7f4ee, 0xdcd6ca, 0xece7dd);
      g.rect(x - 60, y - 46, 120, 10).fill(0x0e8a4f);
      win(g, glow, x - 50, y - 30, 24, 14);
      win(g, glow, x + 26, y - 30, 24, 14);
      g.rect(x - 12, y - 24, 24, 24).fill(0x5b7f95);
      g.moveTo(x + 76, y).lineTo(x + 76, y - 60).stroke({ width: 2, color: 0x777777 });
      g.rect(x + 76, y - 60, 20, 12).fill(0x0e8a4f);
      g.rect(x + 82.5, y - 60, 7, 12).fill(0xffffff);
      top = y - 74;
      break;
    }

    case "school": {
      box(g, x, y, 150, 36, 26, 0xf1e3c6, 0xd6c4a0, 0xe6d4b0);
      g.rect(x - 75, y - 40, 150, 6).fill(roof);
      for (let i = 0; i < 5; i++) g.rect(x - 64 + i * 28, y - 24, 14, 24).fill(0x2b4c7e);
      g.moveTo(x - 80, y + 20).lineTo(x + 80, y + 20).stroke({ width: 4, color: 0xc9c0ac });
      top = y - 60;
      break;
    }

    case "market": {
      const cols = [0xf2b705, 0x26355e, 0xb5532e, 0x2f7d5b, 0x8c2f5a];
      const spots: [number, number][] = [[-60, -14], [-12, -22], [36, -14], [-36, 12], [12, 10]];
      spots.forEach((p, i) => {
        const sx = x + p[0];
        const sy = y + p[1];
        g.rect(sx - 16, sy, 32, 14).fill(0xc99a63).stroke({ width: 1, color: 0x8a6a45 });
        g.circle(sx - 8, sy - 1, 4.5).fill(0xc0392b);
        g.circle(sx + 1, sy - 2, 4.5).fill(0xe67e22);
        g.circle(sx + 9, sy - 1, 4.5).fill(0xe9c46a);
        g.moveTo(sx, sy).lineTo(sx, sy - 24).stroke({ width: 2, color: 0x555555 });
        g.moveTo(sx - 24, sy - 20).quadraticCurveTo(sx, sy - 40, sx + 24, sy - 20).fill(cols[i]);
      });
      top = y - 62;
      break;
    }

    case "buka": {
      box(g, x, y, 100, 38, 24, 0xd9a066, 0xb9834b, 0xc99257);
      g.poly([x - 60, y - 34, x + 52, y - 34, x + 80, y - 50, x - 30, y - 54])
        .fill(0xa9b0b8)
        .stroke({ width: 1, color: 0x5e6570 });
      // The big black pot, with steam curling off it.
      g.ellipse(x + 76, y - 2, 13, 9).fill(0x3a2a1f);
      g.moveTo(x + 72, y - 12).quadraticCurveTo(x + 66, y - 24, x + 74, y - 34)
        .stroke({ width: 2.5, color: 0xffffff, alpha: 0.6 });
      win(g, glow, x - 38, y - 26, 22, 12);
      top = y - 58;
      break;
    }

    case "viewing": {
      box(g, x, y, 110, 36, 24, 0xe6d3ae, 0xcdb58f, 0xe2cba1);
      g.circle(x + 40, y - 52, 14).fill(0xe6e6e6).stroke({ width: 1, color: 0x999999 });
      g.moveTo(x + 40, y - 38).lineTo(x + 40, y - 30).stroke({ width: 3, color: 0x999999 });
      g.rect(x - 40, y - 30, 60, 22).fill(0x111111);
      glow.push({ x: x - 38, y: y - 28, w: 56, h: 18 });
      g.rect(x - 38, y - 28, 56, 18).fill(0x3e7ca8);
      for (const d of [-30, -10, 10]) g.roundRect(x + d, y + 10, 12, 10, 3).fill(0xc0392b);
      top = y - 70;
      break;
    }

    case "kiosk": {
      box(g, x, y, 60, 34, 18, 0x2f7d5b, 0x235f45, 0x3b8f69);
      const goods = [0xf4f1ea, 0xf2b705, 0xf4f1ea, 0xe6e6e6];
      for (let i = 0; i < 4; i++) {
        g.rect(x - 26 + i * 13, y - 28, 11, 14).fill(goods[i]).stroke({ width: 1, color: 0x999999 });
      }
      g.poly([x - 34, y - 34, x + 34, y - 34, x + 28, y - 44, x - 28, y - 44]).fill(0xb3261e);
      top = y - 58;
      break;
    }

    case "mosque": {
      const face = flat ? 0xe6c9a0 : 0xf3ecdd;
      box(g, x, y, 110, 40, 28, face, 0xd2c7af, 0xe5dcc6);
      g.moveTo(x - 26, y - 40)
        .arcToSvg(26, 28, 0, 0, 1, x + 26, y - 40)
        .fill(0x2f8a5f);
      g.rect(x + 60, y - 96, 12, 96).fill(face).stroke({ width: 1, color: 0xb9ae96 });
      g.moveTo(x + 60, y - 96).arcToSvg(6, 8, 0, 0, 1, x + 72, y - 96).fill(0x2f8a5f);
      for (let i = 0; i < 3; i++) {
        const wx = x - 42 + i * 30;
        glow.push({ x: wx, y: y - 26, w: 14, h: 14 });
        g.moveTo(wx, y - 12)
          .lineTo(wx, y - 20)
          .arcToSvg(7, 6, 0, 0, 1, wx + 14, y - 20)
          .lineTo(wx + 14, y - 12)
          .fill(GLASS);
      }
      top = y - 104;
      break;
    }

    case "church": {
      box(g, x, y, 90, 44, 26, 0xf4f1ea, 0xd6d1c4, 0xe7e2d5);
      g.poly([x - 50, y - 42, x, y - 74, x + 50, y - 42]).fill(0x8b5a3a);
      g.rect(x - 8, y - 110, 16, 40).fill(0xf4f1ea).stroke({ width: 1, color: 0xb5af9f });
      g.moveTo(x, y - 130).lineTo(x, y - 112).moveTo(x - 7, y - 124).lineTo(x + 7, y - 124)
        .stroke({ width: 3, color: 0x8b5a3a });
      g.rect(x - 10, y - 26, 20, 26).fill(0x6b4a2b);
      for (let i = 0; i < 2; i++) {
        glow.push({ x: x - 36 + i * 58, y: y - 30, w: 14, h: 16 });
        g.rect(x - 36 + i * 58, y - 30, 14, 16).fill(GLASS);
      }
      top = y - 134;
      break;
    }

    case "garage": {
      g.roundRect(x - 100, y - 30, 200, 60, 6).fill(0xb89a6e);
      busSmall(g, x - 50, y - 6, 0xf2b705);
      busSmall(g, x + 20, y - 12, 0xf4f1ea);
      busSmall(g, x + 50, y + 18, 0xf2b705);
      top = y - 56;
      break;
    }

    case "townhall": {
      box(g, x, y, 120, 44, 30, 0xefe7d6, 0xd2c7af, 0xe5dcc6);
      for (let i = 0; i < 5; i++) {
        g.rect(x - 52 + i * 24, y - 44, 6, 44).fill(0xffffff).stroke({ width: 1, color: 0xdddddd });
      }
      g.poly([x - 66, y - 44, x, y - 66, x + 66, y - 44]).fill(0x2f7d5b);
      top = y - 74;
      break;
    }

    case "board": {
      g.rect(x - 4, y - 60, 8, 60).fill(0x6b4a2b);
      g.rect(x + 56, y - 60, 8, 60).fill(0x6b4a2b);
      g.roundRect(x - 14, y - 110, 88, 60, 4).fill(0xc9a06b).stroke({ width: 3, color: 0x8a6a45 });
      // Empty slots: the flyer colours are painted on later from the promo list.
      for (let i = 0; i < 6; i++) {
        g.rect(x - 6 + (i % 3) * 26, y - 102 + Math.floor(i / 3) * 26, 20, 22)
          .fill(0xefe7d6)
          .stroke({ width: 1, color: 0x999999 });
      }
      top = y - 118;
      break;
    }

    case "shelter": {
      g.poly([x - 70, y, x, y - 60, x + 70, y]).fill(0xe6d3ae).stroke({ width: 1, color: 0x8a6a45 });
      g.moveTo(x, y - 80).lineTo(x, y - 62).moveTo(x - 7, y - 74).lineTo(x + 7, y - 74)
        .stroke({ width: 3, color: 0x8b5a3a });
      top = y - 90;
      break;
    }

    case "lm-rock": {
      quads(g, x - 130, y + 20, [
        [20, -140, 110, -170],
        [80, -20, 140, 90],
        [20, 70, 10, 80],
      ]);
      g.fill(0x8e8579).stroke({ width: 3, color: 0x5e574e });
      g.moveTo(x - 60, y - 80).quadraticCurveTo(x - 30, y - 100, x, y - 80)
        .stroke({ width: 4, color: 0x6e665c });
      g.moveTo(x - 10, y - 120).quadraticCurveTo(x + 10, y - 130, x + 30, y - 114)
        .stroke({ width: 4, color: 0x6e665c });
      tree2(g, x - 140, y + 20, 1, trees[0]);
      top = y - 170;
      break;
    }

    case "lm-hills": {
      quads(g, x - 160, y + 20, [
        [60, -150, 130, -80],
        [60, -90, 120, 10],
        [40, -40, 70, 70],
      ]);
      g.fill(0x6e9a4e).stroke({ width: 3, color: 0x4e7a3f });
      g.moveTo(x - 30, y - 60).quadraticCurveTo(x + 10, y - 50, x + 40, y - 80)
        .stroke({ width: 10, color: 0x83a552 });
      top = y - 150;
      break;
    }

    case "lm-water": {
      g.ellipse(x, y, 140, 54).fill(0x4f8590);
      g.ellipse(x, y - 2, 128, 46).fill(0x7fb3b8);
      g.moveTo(x - 60, y).quadraticCurveTo(x - 40, y - 8, x - 20, y)
        .stroke({ width: 3, color: 0xb7dadb });
      g.moveTo(x + 10, y + 12).quadraticCurveTo(x + 30, y + 4, x + 50, y + 12)
        .stroke({ width: 3, color: 0xb7dadb });
      const bx = x + 50;
      const by = y - 6;
      g.poly([bx - 22, by, bx + 22, by, bx + 16, by + 8, bx - 16, by + 8]).fill(0x8b5a3a);
      g.moveTo(bx, by).lineTo(bx, by - 20).stroke({ width: 2, color: 0x5a3e25 });
      tree2(g, x - 150, y - 10, 1, trees[0]);
      tree2(g, x + 150, y, 1, trees[2] || trees[0]);
      top = y - 70;
      break;
    }

    case "lm-bridge": {
      g.moveTo(x - 170, y - 30).quadraticCurveTo(x, y - 90, x + 170, y - 30)
        .stroke({ width: 18, color: 0x9aa3ad });
      for (const d of [-120, -60, 0, 60, 120]) {
        g.rect(x + d - 5, y - 60 + Math.abs(d) / 4, 10, 70 - Math.abs(d) / 4).fill(0x8e96a3);
      }
      g.moveTo(x - 170, y - 38).quadraticCurveTo(x, y - 98, x + 170, y - 38)
        .stroke({ width: 4, color: 0xc4cbd2 });
      top = y - 100;
      break;
    }

    case "lm-palace": {
      box(g, x, y, 170, 40, 40, 0xc98e5a, 0xa9733f, 0xd9a06b, { width: 1, color: 0x50280a, alpha: 0.4 });
      g.moveTo(x - 16, y)
        .lineTo(x - 16, y - 20)
        .arcToSvg(16, 16, 0, 0, 1, x + 16, y - 20)
        .lineTo(x + 16, y)
        .fill(0x4a2a18);
      g.moveTo(x - 30, y - 40).arcToSvg(30, 30, 0, 0, 1, x + 30, y - 40).fill(0x2f8a5f);
      for (let i = 0; i < 10; i++) {
        g.rect(x - 84 + i * 17, y - 46, 9, 6)
          .fill(0xc98e5a)
          .stroke({ width: 1, color: 0x50280a, alpha: 0.4 });
      }
      top = y - 80;
      break;
    }

    case "lm-tower": {
      box(g, x, y, 60, 190, 24, 0xe9e2d2, 0xcfc7b6, 0xddd5c3);
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 2; c++) win(g, glow, x - 20 + c * 24, y - 180 + r * 20, 14, 12);
      }
      g.rect(x - 34, y - 196, 60, 8).fill(0x2f7d5b);
      top = y - 200;
      break;
    }

    case "lm-forest": {
      for (let i = 0; i < 9; i++) {
        tree2(g, x - 100 + (i % 5) * 50, y - 30 + Math.floor(i / 5) * 40, 1.3, i % 2 ? "" : "palm");
      }
      g.moveTo(x - 24, y + 30).lineTo(x - 24, y - 10).lineTo(x + 24, y - 10).lineTo(x + 24, y + 30)
        .stroke({ width: 6, color: 0x8b5a3a });
      top = y - 90;
      break;
    }

    case "lm-market": {
      const cols = [0xf2b705, 0x26355e, 0xb5532e, 0x2f7d5b];
      for (let i = 0; i < 8; i++) {
        const sx = x - 100 + (i % 4) * 60;
        const sy = y - 30 + Math.floor(i / 4) * 40;
        g.rect(sx - 18, sy, 36, 14).fill(0xc99a63);
        g.moveTo(sx - 26, sy - 2).quadraticCurveTo(sx, sy - 26, sx + 26, sy - 2).fill(cols[i % 4]);
      }
      top = y - 70;
      break;
    }

    case "village": {
      bhouse(g, x - 60, y + 10, wall, roof, 46, flat);
      bhouse(g, x + 10, y, wall, roof2, 54, flat);
      bhouse(g, x + 70, y + 14, wall, roof, 40, flat);
      top = y - 48;
      break;
    }

    case "oldtown": {
      smallHouse(g, x - 54, y + 12, wall, roof);
      smallHouse(g, x, y, wall, roof2);
      smallHouse(g, x + 52, y + 14, wall, roof);
      top = y - 46;
      break;
    }

    case "farmstop": {
      bhouse(g, x - 40, y, wall, roof, 50, flat);
      cow(g, x + 40, y + 10);
      cow(g, x + 74, y - 4);
      tree2(g, x - 100, y + 8, 1, trees[0]);
      top = y - 48;
      break;
    }

    default:
      box(g, x, y, 90, 40, 24, wall, 0xcdb58f, 0xe2cba1);
      top = y - 60;
  }

  return { top, glow };
}
