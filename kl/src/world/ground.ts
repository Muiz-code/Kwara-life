// Static ground layer: terrain, scattered houses and trees, roads and their names.
// Drawn once. Ported from drawMap() in reference/kwara-life.html.
import { Container, Graphics, Text } from "pixi.js";
import { PLACES, WAYPOINTS } from "../data/ilorin/places";
import { ROADS } from "../data/ilorin/roads";
import { seeded, type Rng } from "../sim/rng";
import { WORLD_H, WORLD_W, nodePos, placePos, type Point } from "../sim/world";
import { segmentDistance } from "./layout";

const OUT_OF_TOWN = new Set(["shao", "farm", "kwasu", "poly"]);
const HOUSE_WALLS = [0xead7b5, 0xe6c9a0, 0xd9c3a0, 0xf0e2c4];
const HOUSE_ROOFS = [0x9aa3ad, 0x8b5a3a, 0xa9b0b8, 0x7e6a55];

function tree(g: Graphics, x: number, y: number, s: number, kind: "" | "palm" | "baobab") {
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
    g.ellipse(x, y - 36 * s, 24 * s, 11 * s).fill(0x6b8a3a);
    return;
  }
  g.ellipse(x, y + 2, 16 * s, 5 * s).fill({ color: 0x000000, alpha: 0.13 });
  g.rect(x - 2.5 * s, y - 14 * s, 5 * s, 16 * s).fill(0x6b4a2b);
  g.circle(x, y - 20 * s, 15 * s).fill(0x3f6b3a);
  g.circle(x - 6 * s, y - 25 * s, 9 * s).fill(0x56854a);
}

function dashedLine(g: Graphics, p: Point, q: Point, dash: number, gap: number) {
  const len = Math.hypot(q.x - p.x, q.y - p.y);
  const ux = (q.x - p.x) / len;
  const uy = (q.y - p.y) / len;
  for (let d = 0; d < len; d += dash + gap) {
    const e = Math.min(len, d + dash);
    g.moveTo(p.x + ux * d, p.y + uy * d).lineTo(p.x + ux * e, p.y + uy * e);
  }
}

export function buildGround(fonts: { ui: string }): Container {
  const R: Rng = seeded(7);
  const root = new Container();
  const g = new Graphics();
  root.addChild(g);

  g.rect(-3000, -3000, WORLD_W + 6000, WORLD_H + 6000).fill(0xd3b67f);
  // Dry grass tufts
  for (let i = 0; i < 1400; i++) {
    const x = R() * (WORLD_W + 800) - 400;
    const y = R() * (WORLD_H + 800) - 400;
    g.moveTo(x, y + 6).lineTo(x + 3, y).lineTo(x + 6, y + 6);
  }
  g.stroke({ width: 1.5, color: 0xa98f52, alpha: 0.5 });

  const city = PLACES.filter((p) => !OUT_OF_TOWN.has(p.id)).map((p) => placePos(p.id));
  for (const c of city) g.ellipse(c.x, c.y, 260, 200).fill({ color: 0xe2cfa6, alpha: 0.55 });

  for (let i = 0; i < 40; i++) {
    const x = R() * WORLD_W;
    const y = R() * WORLD_H * 0.55;
    g.poly([x, y, x + 140, y - 20, x + 160, y + 40, x + 20, y + 60]).fill({ color: R() < 0.5 ? 0xb9a35f : 0xa8b86a, alpha: 0.45 });
  }

  const segs = ROADS.map((r) => [nodePos(r.a), nodePos(r.b)] as const);
  const nearRoad = (x: number, y: number, d: number) => segs.some(([a, b]) => segmentDistance({ x, y }, a, b) < d);
  const allPlaces = PLACES.map((p) => placePos(p.id));

  const houses: Point[] = [];
  for (let i = 0; i < 2600 && houses.length < 900; i++) {
    const c = city[Math.floor(R() * city.length)];
    const a = R() * 6.28;
    const r = 40 + R() * 300;
    const x = c.x + Math.cos(a) * r;
    const y = c.y + Math.sin(a) * r * 0.75;
    if (allPlaces.some((l) => Math.hypot(l.x - x, (l.y - y) * 1.2) < 150)) continue;
    if (nearRoad(x, y, 26)) continue;
    if (houses.some((h) => Math.abs(h.x - x) < 34 && Math.abs(h.y - y) < 26)) continue;
    houses.push({ x, y });
  }
  houses.sort((a, b) => a.y - b.y).forEach((h, i) => {
    g.rect(h.x - 13, h.y - 10, 26, 14).fill({ color: HOUSE_WALLS[i % 4], alpha: 0.9 });
    g.poly([h.x - 16, h.y - 9, h.x + 16, h.y - 9, h.x + 10, h.y - 20, h.x - 10, h.y - 20]).fill({ color: HOUSE_ROOFS[(i * 7) % 4], alpha: 0.9 });
  });

  for (let i = 0; i < 160; i++) {
    const x = R() * WORLD_W;
    const y = R() * WORLD_H;
    if (nearRoad(x, y, 30)) continue;
    if (allPlaces.some((l) => Math.hypot(l.x - x, l.y - y) < 140)) continue;
    const s = 0.7 + R() * 0.5;
    const north = y < WORLD_H * 0.5;
    tree(g, x, y, s, north ? (R() < 0.3 ? "baobab" : "") : R() < 0.25 ? "palm" : "");
  }

  // Roads: dark edge, tarmac, dashed centre line.
  for (const r of ROADS) {
    const [p, q] = [nodePos(r.a), nodePos(r.b)];
    g.moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ width: r.highway ? 26 : 32, color: 0x3f3b37, cap: "round" });
  }
  for (const r of ROADS) {
    const [p, q] = [nodePos(r.a), nodePos(r.b)];
    g.moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ width: r.highway ? 20 : 26, color: 0x66615b, cap: "round" });
  }
  for (const r of ROADS) dashedLine(g, nodePos(r.a), nodePos(r.b), 12, 12);
  g.stroke({ width: 2, color: 0xe8e2d0 });

  for (const w of WAYPOINTS) {
    const p = placePos(w.id);
    g.circle(p.x, p.y, 22).fill(0x66615b).stroke({ width: 3, color: 0x3f3b37 });
    g.circle(p.x, p.y, 11).fill(0x5f8a4a);
  }

  const labelStyle = { fontFamily: fonts.ui, fontWeight: "800" as const, fill: 0xf7f2e4, stroke: { color: 0x3f3b37, width: 3 } };
  for (const r of ROADS) {
    if (!r.name) continue;
    const [p, q] = [nodePos(r.a), nodePos(r.b)];
    if (Math.hypot(q.x - p.x, q.y - p.y) < 170) continue;
    let ang = Math.atan2(q.y - p.y, q.x - p.x);
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    const t = new Text({ text: r.name, style: { ...labelStyle, fontSize: 12.5 } });
    t.anchor.set(0.5);
    t.position.set((p.x + q.x) / 2, (p.y + q.y) / 2);
    t.rotation = ang;
    root.addChild(t);
  }
  for (const w of WAYPOINTS) {
    const p = placePos(w.id);
    const t = new Text({ text: w.name, style: { ...labelStyle, fontSize: 13, fill: 0x3f2a16, stroke: { color: 0xf3e6c8, width: 3 } } });
    t.anchor.set(0.5, 0);
    t.position.set(p.x, p.y + 28);
    root.addChild(t);
  }
  return root;
}
