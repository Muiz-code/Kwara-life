// Traffic on a town's streets: vehicles keep to the right-hand lane, mostly go
// straight on, turn at junctions, queue behind each other and stop at red lights.
import { Container, Graphics, Sprite, Texture, type Container as PixiContainer } from "pixi.js";
import type { RoadGraph } from "./routing";
import type { Point, WorldMap } from "./types";
import { drawVehicle, headingOf, LAMPS, TRAFFIC_LIGHT_ART, vehicleArt, type Heading, type VehicleKind } from "./vehicles";

/** Length of a full light cycle, and how it splits: green one way, amber, green the other way, amber. */
const CYCLE = 12000;
const GREEN = 5000;
const AMBER = 1000;

/** Which way may go: along u (down-right and up-left on screen) or along v. */
export type LightState = { u: "green" | "amber" | "red"; v: "green" | "amber" | "red" };

export function lightState(now: number): LightState {
  const t = now % CYCLE;
  if (t < GREEN) return { u: "green", v: "red" };
  if (t < GREEN + AMBER) return { u: "amber", v: "red" };
  if (t < GREEN * 2 + AMBER) return { u: "red", v: "green" };
  return { u: "red", v: "amber" };
}

/** On-screen width of each vehicle's art. */
const ART_W: Record<VehicleKind, number> = { keke: 58, okada: 50, danfo: 84, car: 70, suv: 76, horse: 64 };

interface Car {
  kind: VehicleKind;
  tint: number;
  a: number;
  b: number;
  t: number;
  speed: number;
  view: Container;
  drawn: Partial<Record<Heading, Graphics>>;
  sprite?: Sprite;
  heading?: Heading;
}

export class Traffic {
  private cars: Car[] = [];
  private lightAt = new Set<number>();
  private lightGfx = new Graphics();
  /** One pole per direction at each light junction, with its lamps painted live. */
  private poles: { axis: "u" | "v"; lamps: Graphics; w: number; h: number }[] = [];
  private lastPhase = "";
  private hw: number;
  private hh: number;
  private noEntry = new Set<number>();

  constructor(
    private map: WorldMap,
    private graph: RoadGraph,
    layer: PixiContainer,
    lightsLayer: PixiContainer,
    private hasArt: (src: string) => boolean,
  ) {
    this.hw = map.grid?.hw ?? 120;
    this.hh = map.grid?.hh ?? 60;
    // Cars stay on the road: the vertex inside each plot is for people, not traffic.
    for (const g of Object.values(graph.gate)) if (g.own) this.noEntry.add(g.v);
    for (const p of map.lights ?? []) {
      const v = graph.verts.find((x) => Math.hypot(x.x - p.x, x.y - p.y) < 4);
      if (v) this.lightAt.add(v.id);
    }
    lightsLayer.addChild(this.lightGfx);
    if (hasArt(TRAFFIC_LIGHT_ART)) {
      // A pole on the left corner of the junction for traffic along u, and one
      // on the right corner, mirrored, for traffic along v.
      for (const p of map.lights ?? []) {
        for (const axis of ["u", "v"] as const) {
          const pole = new Container();
          const sp = new Sprite(Texture.from(TRAFFIC_LIGHT_ART));
          sp.anchor.set(0.5, 0.92);
          const k = 40 / sp.texture.width;
          const flip = axis === "v";
          sp.scale.set(flip ? -k : k, k);
          const lamps = new Graphics();
          pole.addChild(sp, lamps);
          const x = p.x + (flip ? 1 : -1) * this.hw * 0.72;
          const y = p.y + 6;
          pole.position.set(x, y);
          pole.zIndex = y;
          pole.cullable = true;
          layer.addChild(pole);
          const w = sp.texture.width * k;
          const h = sp.texture.height * k;
          lamps.scale.x = flip ? -1 : 1;
          this.poles.push({ axis, lamps, w, h });
        }
      }
    }

    const road = graph.verts.filter((v) => !this.noEntry.has(v.id) && v.edges.some((e) => !this.noEntry.has(e.to)));
    if (!road.length) return;
    const count = Math.min(40, Math.max(8, Math.round(road.length / 6)));
    const kinds: VehicleKind[] = ["keke", "keke", "car", "okada", "danfo", "keke", "car", "okada", "suv", "car"];
    for (let i = 0; i < count; i++) {
      const v = road[(i * 7919) % road.length];
      const next = v.edges.find((e) => !this.noEntry.has(e.to));
      if (!next) continue;
      const kind = kinds[i % kinds.length];
      const view = new Container();
      view.cullable = true;
      layer.addChild(view);
      this.cars.push({ kind, tint: i, a: v.id, b: next.to, t: ((i * 37) % 100) / 100, speed: 0.00022 * (0.8 + ((i * 13) % 10) / 25), view, drawn: {} });
    }
  }

  /** Where a car is and which way it faces, keeping right. */
  private place(c: Car): { p: Point; h: Heading } {
    const P = this.graph.verts[c.a];
    const Q = this.graph.verts[c.b];
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    // Grid direction of travel, then the lane to its right.
    const du = Math.sign(Math.round((dx / this.hw + dy / this.hh) / 2 * 100));
    const dv = Math.sign(Math.round((dy / this.hh - dx / this.hw) / 2 * 100));
    const right = du !== 0 ? { u: 0, v: du } : { u: -dv, v: 0 };
    const lane = 0.24;
    return {
      p: {
        x: P.x + dx * c.t + (right.u - right.v) * this.hw * lane,
        y: P.y + dy * c.t + (right.u + right.v) * this.hh * lane,
      },
      h: headingOf(dx, dy),
    };
  }

  private axisOf(c: Car): "u" | "v" {
    const P = this.graph.verts[c.a];
    const Q = this.graph.verts[c.b];
    // Along u, x and y change the same way on screen.
    return Math.sign(Q.x - P.x) === Math.sign(Q.y - P.y) ? "u" : "v";
  }

  update(dt: number, now: number, running: boolean) {
    const lights = lightState(now);
    this.drawLights(lights);
    if (!running) return;
    for (const c of this.cars) {
      const P = this.graph.verts[c.a];
      const Q = this.graph.verts[c.b];
      const len = Math.hypot(Q.x - P.x, Q.y - P.y) || 1;
      let step = (c.speed * dt * 300) / len;
      // Stop at the line on red or amber, unless already in the junction.
      if (this.lightAt.has(c.b) && lights[this.axisOf(c)] !== "green" && c.t < 0.5) {
        step = Math.min(step, Math.max(0, 0.42 - c.t));
      }
      // Queue behind the car in front on the same stretch.
      for (const o of this.cars) {
        if (o === c || o.a !== c.a || o.b !== c.b || o.t <= c.t) continue;
        step = Math.min(step, Math.max(0, o.t - c.t - 0.34));
      }
      c.t += step;
      if (c.t >= 1) {
        c.t = 0;
        const prev = c.a;
        c.a = c.b;
        const here = this.graph.verts[c.a];
        const opts = here.edges.filter((e) => e.to !== prev && !this.noEntry.has(e.to));
        const list = opts.length ? opts : here.edges.filter((e) => !this.noEntry.has(e.to));
        if (!list.length) continue;
        // Mostly straight on; sometimes a turn.
        const ahead = list.find((e) => {
          const n = this.graph.verts[e.to];
          return Math.sign(n.x - here.x) === Math.sign(here.x - P.x) && Math.sign(n.y - here.y) === Math.sign(here.y - P.y);
        });
        c.b = ahead && Math.random() < 0.7 ? ahead.to : list[Math.floor(Math.random() * list.length)].to;
      }
    }
    for (const c of this.cars) this.show(c);
  }

  private show(c: Car) {
    const { p, h } = this.place(c);
    c.view.position.set(p.x, p.y);
    c.view.zIndex = p.y;
    if (c.heading === h) return;
    c.heading = h;
    const art = vehicleArt(c.kind, h);
    if (this.hasArt(art.src)) {
      if (!c.sprite) {
        c.sprite = new Sprite();
        c.sprite.anchor.set(0.5, 0.85);
        c.view.addChild(c.sprite);
      }
      c.sprite.texture = Texture.from(art.src);
      const k = ART_W[c.kind] / c.sprite.texture.width;
      c.sprite.scale.set(art.flip ? -k : k, k);
      return;
    }
    // No art yet: the vehicle drawn in code, one drawing per heading.
    for (const g of Object.values(c.drawn)) if (g) g.visible = false;
    let g = c.drawn[h];
    if (!g) {
      g = new Graphics();
      drawVehicle(g, c.kind, h, c.tint);
      c.drawn[h] = g;
      c.view.addChild(g);
    }
    g.visible = true;
  }

  /** A pole on the corner of each light junction, with a head for each direction. */
  private drawLights(s: LightState) {
    const key = `${s.u}${s.v}`;
    if (key === this.lastPhase) return;
    this.lastPhase = key;
    if (this.poles.length) {
      // Paint each lamp over the picture: lit or dark, by the phase for that pole's direction.
      const lit = { red: 0xff3b30, amber: 0xffb300, green: 0x3ddc84 };
      const dark = { red: 0x4a1c1a, amber: 0x4a3a10, green: 0x163a24 };
      for (const pole of this.poles) {
        const g = pole.lamps;
        g.clear();
        const st = s[pole.axis];
        // Positions are from the anchor (bottom, 92% down the picture).
        const x0 = (LAMPS.x - 0.5) * pole.w;
        for (const lamp of ["red", "amber", "green"] as const) {
          const y = (LAMPS[lamp] - 0.92) * pole.h;
          g.circle(x0, y, LAMPS.r * pole.w).fill(st === lamp ? lit[lamp] : dark[lamp]);
          if (st === lamp) g.circle(x0, y, LAMPS.r * pole.w * 1.9).fill({ color: lit[lamp], alpha: 0.25 });
        }
      }
      return;
    }
    const g = this.lightGfx;
    g.clear();
    const colour = { green: 0x3ddc84, amber: 0xffb300, red: 0xff3b30 };
    for (const p of this.map.lights ?? []) {
      // On the pavement at the junction's left corner.
      const x = p.x - this.hw * 0.78;
      const y = p.y - 4;
      g.ellipse(x, y + 2, 7, 3).fill({ color: 0x000000, alpha: 0.25 });
      g.rect(x - 2, y - 46, 4, 46).fill(0x3a3a3a);
      for (const [i, axis] of (["u", "v"] as const).entries()) {
        const hx = x - 7 + i * 14;
        const hy = y - 64;
        g.roundRect(hx - 5, hy, 10, 24, 3).fill(0x1d1d1d);
        const st = s[axis];
        g.circle(hx, hy + 5, 3).fill(st === "red" ? colour.red : 0x4a1c1a);
        g.circle(hx, hy + 12, 3).fill(st === "amber" ? colour.amber : 0x4a3a10);
        g.circle(hx, hy + 19, 3).fill(st === "green" ? colour.green : 0x163a24);
      }
    }
  }
}
