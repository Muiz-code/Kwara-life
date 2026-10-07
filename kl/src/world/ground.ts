// Static ground layer for any LGA map: biome terrain, scattered houses and trees,
// the river, the real road lines and their names. Drawn once.
// Ported from drawMap() in reference/naija-votes-2027.html and kwara-life.html.
import { Container, Graphics, Text } from "pixi.js";
import { BIOMES, type Biome } from "../data/biomes";
import { seeded, type Rng } from "../sim/rng";
import { hash } from "./generate";
import { roadFinder } from "./routing";
import type { MapRoad, Point, WorldMap } from "./types";

const hex = (c: string) => parseInt(c.replace("#", ""), 16);

/** Road width on screen by class. Trunk roads are the widest. */
const ROAD_W: Record<string, number> = { trunk: 30, primary: 25, secondary: 22, tertiary: 17, residential: 10 };
const widthOf = (r: MapRoad) => ROAD_W[r.cls ?? "secondary"] ?? 26;

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
  if (kind === "neem") {
    g.ellipse(x, y + 2, 16 * s, 5 * s).fill({ color: 0x000000, alpha: 0.13 });
    g.rect(x - 2.5 * s, y - 14 * s, 5 * s, 16 * s).fill(0x6b4a2b);
    g.ellipse(x, y - 22 * s, 19 * s, 13 * s).fill(0x7a9a4a);
    g.ellipse(x - 5 * s, y - 26 * s, 9 * s, 6 * s).fill(0x93b25c);
    return;
  }
  if (kind === "mangrove") {
    g.moveTo(x - 10 * s, y).quadraticCurveTo(x - 6 * s, y - 12 * s, x, y - 14 * s).quadraticCurveTo(x + 6 * s, y - 12 * s, x + 10 * s, y).stroke({ width: 2 * s, color: 0x5a4030 });
    g.ellipse(x, y - 22 * s, 18 * s, 11 * s).fill(0x3f6b3a);
    return;
  }
  g.ellipse(x, y + 2, 16 * s, 5 * s).fill({ color: 0x000000, alpha: 0.13 });
  g.rect(x - 2.5 * s, y - 14 * s, 5 * s, 16 * s).fill(0x6b4a2b);
  g.circle(x, y - 20 * s, 15 * s).fill(0x3f6b3a);
  g.circle(x - 6 * s, y - 25 * s, 9 * s).fill(0x56854a);
}

function cow(g: Graphics, x: number, y: number) {
  g.ellipse(x, y - 8, 11, 6).fill(0xf4f1ea).stroke({ width: 1, color: 0x999999 });
  g.circle(x + 11, y - 11, 4).fill(0xf4f1ea).stroke({ width: 1, color: 0x999999 });
  for (const d of [-7, -2, 4, 8]) g.rect(x + d, y - 4, 2, 6).fill(0x999999);
  g.circle(x - 3, y - 9, 3).fill(0x8a6a45);
}

/** Small background house, flat roof in the Sahel and pitched elsewhere. */
function smallHouse(g: Graphics, x: number, y: number, b: Biome, wall: number, roof: number) {
  const w = 30;
  const d = 12;
  const h = 18;
  const L = x - w / 2;
  const R = x + w / 2;
  const T = y - h;
  g.poly([R, y, R + d, y - d * 0.5, R + d, T - d * 0.5, R, T]).fill(b.flat ? 0xb9834b : 0xcdb58f);
  g.poly([L, T, R, T, R + d, T - d * 0.5, L + d, T - d * 0.5]).fill(b.flat ? 0xc99257 : 0xe2cba1);
  g.rect(L, T, w, h).fill(wall);
  if (b.flat) g.rect(L, y - 21, w, 4).fill(roof);
  else g.poly([L - 2, y - 17, R, y - 17, R + 13, y - 24, L + 11, y - 24]).fill(roof);
}

function dashedLine(g: Graphics, pts: Point[], dash: number, gap: number) {
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (!len) continue;
    const ux = (q.x - p.x) / len;
    const uy = (q.y - p.y) / len;
    for (let d = 0; d < len; d += dash + gap) {
      const e = Math.min(len, d + dash);
      g.moveTo(p.x + ux * d, p.y + uy * d).lineTo(p.x + ux * e, p.y + uy * e);
    }
  }
}

const strokePolyline = (g: Graphics, pts: Point[]) => {
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
};

/** The middle of the longest straight piece of a road, for its name label. */
function labelSpot(r: MapRoad): { p: Point; angle: number; len: number } {
  let best = { p: r.pts[0], angle: 0, len: 0 };
  for (let i = 1; i < r.pts.length; i++) {
    const a = r.pts[i - 1];
    const b = r.pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > best.len) {
      let angle = Math.atan2(b.y - a.y, b.x - a.x);
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      best = { p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, angle, len };
    }
  }
  return best;
}

/** Where two segments cross, if they do. Used to put a bridge over the water. */
function crossing(a: Point, b: Point, c: Point, d: Point): Point | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s2 = { x: d.x - c.x, y: d.y - c.y };
  const denom = r.x * s2.y - r.y * s2.x;
  if (!denom) return null;
  const t = ((c.x - a.x) * s2.y - (c.y - a.y) * s2.x) / denom;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + t * r.x, y: a.y + t * r.y };
}

export function buildGround(map: WorldMap, fonts: { ui: string }): Container {
  const B = BIOMES[map.biome];
  const R: Rng = seeded(hash(`${map.id}deco`) % 2147483646 || 7);
  const W = map.width;
  const H = map.height;
  const root = new Container();
  const g = new Graphics();
  root.addChild(g);

  g.rect(-3000, -3000, W + 6000, H + 6000).fill(hex(B.ground));

  // Dry grass tufts, thinner on green biomes.
  for (let i = 0; i < 1400; i++) {
    const x = R() * (W + 800) - 400;
    const y = R() * (H + 800) - 400;
    g.moveTo(x, y + 6).lineTo(x + 3, y).lineTo(x + 6, y + 6);
  }
  g.stroke({ width: 1.5, color: hex(B.patch), alpha: 0.5 });

  // Fields and bare patches.
  for (let i = 0; i < 26; i++) {
    const x = R() * W;
    const y = R() * H;
    g.poly([x, y, x + 160, y - 24, x + 184, y + 46, x + 24, y + 70]).fill({ color: hex(B.patch), alpha: 0.55 });
  }
  if (B.extra === "hills" || B.extra === "rocks") {
    for (let i = 0; i < 7; i++) {
      const x = R() * W;
      const y = R() * H;
      if (B.extra === "hills") g.ellipse(x, y, 120 + R() * 80, 50 + R() * 30).fill({ color: 0x7fa350, alpha: 0.7 });
      else {
        g.moveTo(x - 40, y).quadraticCurveTo(x - 20, y - 50, x + 10, y - 46).quadraticCurveTo(x + 44, y - 42, x + 50, y)
          .closePath().fill(0x9a9184).stroke({ width: 1, color: 0x6e665c });
      }
    }
  }
  if (B.extra === "red") {
    for (let i = 0; i < 10; i++) g.ellipse(R() * W, R() * H, 90, 40).fill({ color: 0xb5643a, alpha: 0.25 });
  }

  // The river, when the area has water.
  if (map.river && map.river.length > 1) {
    strokePolyline(g, map.river);
    g.stroke({ width: 96, color: 0x3f7580, cap: "round", join: "round" });
    strokePolyline(g, map.river);
    g.stroke({ width: 80, color: 0x6fa7b0, join: "round" });
    for (let i = 1; i < map.river.length - 1; i += 2) {
      const p = map.river[i];
      g.poly([p.x - 22, p.y, p.x + 22, p.y, p.x + 16, p.y + 7, p.x - 16, p.y + 7]).fill(0x8b5a3a);
      g.circle(p.x + 4, p.y - 6, 4).fill(0x4a2a18);
    }
    if (B.extra === "water") {
      for (let i = 0; i < 30; i++) {
        const p = map.river[Math.floor(R() * map.river.length)];
        tree(g, p.x + (R() - 0.5) * 260, p.y + (R() < 0.5 ? -70 : 70) + (R() - 0.5) * 30, 0.8, "mangrove");
      }
    }
  }

  const roads = roadFinder(map);
  const river = map.river ? roadFinder({ ...map, roads: [{ name: "", pts: map.river }] }) : null;
  const riverDist = (x: number, y: number) => (river ? river.distance({ x, y }) : 1e9);
  const near = (x: number, y: number, d: number) => roads.distance({ x, y }) < d;
  const tiles = map.places.map((p) => ({ x: p.x, y: p.y }));

  // Neighbourhood houses, packed near the places, never on a road or in the river.
  const houses: Point[] = [];
  const spots = tiles.length ? tiles : [{ x: W / 2, y: H / 2 }];
  for (let i = 0; i < 3000 && houses.length < 700; i++) {
    const c = spots[Math.floor(R() * spots.length)];
    const a = R() * 6.28;
    const r = 60 + R() * 340;
    const x = c.x + Math.cos(a) * r;
    const y = c.y + Math.sin(a) * r * 0.78;
    if (x < -200 || y < -200 || x > W + 200 || y > H + 200) continue;
    if (tiles.some((l) => Math.hypot(l.x - x, (l.y - y) * 1.2) < 155)) continue;
    if (near(x, y, 28)) continue;
    if (riverDist(x, y) < 70) continue;
    if (houses.some((h) => Math.abs(h.x - x) < 36 && Math.abs(h.y - y) < 28)) continue;
    houses.push({ x, y });
  }
  houses.sort((a, b) => a.y - b.y).forEach((h, i) => {
    smallHouse(g, h.x, h.y, B, hex(B.wall[i % B.wall.length]), hex(B.roof[(i * 7) % B.roof.length]));
  });

  for (let i = 0; i < 170; i++) {
    const x = R() * W;
    const y = R() * H;
    if (near(x, y, 30) || tiles.some((l) => Math.hypot(l.x - x, l.y - y) < 150) || riverDist(x, y) < 60) continue;
    tree(g, x, y, 0.8 + R() * 0.5, B.trees[i % B.trees.length]);
  }
  if (B.extra === "cattle") {
    for (let i = 0; i < 8; i++) {
      const x = R() * W;
      const y = R() * H;
      if (tiles.some((l) => Math.hypot(l.x - x, l.y - y) < 150)) continue;
      cow(g, x, y);
      cow(g, x + 24, y + 8);
    }
  }

  // Roads: dark edge, tarmac, dashed centre line. Widest class first so junctions read well.
  const byWidth = [...map.roads].sort((a, b) => widthOf(b) - widthOf(a));
  for (const r of byWidth) {
    strokePolyline(g, r.pts);
    g.stroke({ width: widthOf(r) + 6, color: 0x3f3b37, cap: "round", join: "round" });
  }
  for (const r of byWidth) {
    strokePolyline(g, r.pts);
    g.stroke({ width: widthOf(r), color: hex(B.road), cap: "round", join: "round" });
  }
  for (const r of byWidth) {
    // Only the bigger roads are painted with a centre line.
    if (widthOf(r) < 17) continue;
    dashedLine(g, r.pts, 12, 12);
  }
  g.stroke({ width: 2, color: 0xe8e2d0 });

  // A bridge wherever a road crosses the water.
  if (map.river && map.river.length > 1) {
    for (const r of map.roads) {
      for (let i = 1; i < r.pts.length; i++) {
        for (let k = 1; k < map.river.length; k++) {
          const hit = crossing(r.pts[i - 1], r.pts[i], map.river[k - 1], map.river[k]);
          if (!hit) continue;
          const ang = Math.atan2(r.pts[i].y - r.pts[i - 1].y, r.pts[i].x - r.pts[i - 1].x);
          const w = widthOf(r) + 14;
          const len = 118;
          const ux = Math.cos(ang) * len * 0.5;
          const uy = Math.sin(ang) * len * 0.5;
          const nx = -Math.sin(ang) * w * 0.5;
          const ny = Math.cos(ang) * w * 0.5;
          g.poly([
            hit.x - ux + nx, hit.y - uy + ny, hit.x + ux + nx, hit.y + uy + ny,
            hit.x + ux - nx, hit.y + uy - ny, hit.x - ux - nx, hit.y - uy - ny,
          ]).fill(0x9aa3ad).stroke({ width: 2, color: 0x5e6570 });
          g.moveTo(hit.x - ux - nx, hit.y - uy - ny).lineTo(hit.x + ux - nx, hit.y + uy - ny);
          g.moveTo(hit.x - ux + nx, hit.y - uy + ny).lineTo(hit.x + ux + nx, hit.y + uy + ny);
          g.stroke({ width: 3, color: 0xc4cbd2 });
        }
      }
    }
  }

  // Named roundabouts.
  for (const j of map.junctions ?? []) {
    g.circle(j.x, j.y, 22).fill(hex(B.road)).stroke({ width: 3, color: 0x3f3b37 });
    g.circle(j.x, j.y, 11).fill(0x5f8a4a);
  }

  const labelStyle = { fontFamily: fonts.ui, fontWeight: "800" as const, fill: 0xf7f2e4, stroke: { color: 0x3f3b37, width: 3 } };
  const labelled = new Set<string>();
  for (const r of map.roads) {
    if (!r.name) continue;
    const spot = labelSpot(r);
    if (spot.len < 170 || widthOf(r) < 17) continue;
    // One label per street name keeps a long road from shouting.
    if (labelled.has(r.name) && R() < 0.6) continue;
    labelled.add(r.name);
    const t = new Text({ text: r.name, style: { ...labelStyle, fontSize: 12.5 } });
    t.anchor.set(0.5);
    t.position.set(spot.p.x, spot.p.y);
    t.rotation = spot.angle;
    root.addChild(t);
  }
  for (const j of map.junctions ?? []) {
    const t = new Text({ text: j.name, style: { ...labelStyle, fontSize: 13, fill: 0x3f2a16, stroke: { color: 0xf3e6c8, width: 3 } } });
    t.anchor.set(0.5, 0);
    t.position.set(j.x, j.y + 28);
    root.addChild(t);
  }
  return root;
}
