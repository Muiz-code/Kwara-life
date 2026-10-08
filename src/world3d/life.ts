// Life on the streets: traffic for the region (danfos in Lagos, keke and okada up north), Durbar horses
// in Ilorin and the north, Fulani herders driving cattle, townspeople walking the pavements in local dress,
// and children playing football on the nearest pitch. Vehicles drive the town's real road graph and keep
// right; people stay round the camera, so there is always life where you look and phones are not loaded
// with people nobody can see.
import { DoubleSide, Group, Mesh, MeshLambertMaterial, SphereGeometry, type BufferGeometry, type Object3D, type Scene, type Vector3 } from "three";
import { BIOMES, lookOf } from "../data/biomes";
import { STATE } from "../data/states";
import { attireFor } from "../data/attire";
import { cellAt, isLotCode } from "../world/town";
import type { RoadGraph } from "../world/routing";
import type { WorldMap } from "../world/types";
import { Avatar, type People } from "./avatar";
import { CELL, PLOT_H, rng, toWorld } from "./coords";
import { figure, type BuildCtx } from "./buildings";
import { Kit } from "./kit";

export type VehicleKind = "keke" | "okada" | "danfo" | "car" | "taxi" | "horse";

const ROADS = new Set(["a", "r", "t", "b"]);
const MAT = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });

/** One vehicle's model, nose along +z, standing on y = 0. */
export function vehicleGeometry(kind: VehicleKind, colour: string, R: () => number): BufferGeometry {
  const kit = new Kit();
  const ctx: BuildCtx = { kit, biome: "savanna", district: "mixed", rnd: R };
  const wheel = (x: number, z: number, r = 0.32) => kit.cyl(r, r, 0.18, x, r, z, "#1B1D21", 10, 0, Math.PI / 2);
  switch (kind) {
    case "keke":
      kit.box(1.3, 0.9, 2.3, 0, 0.35, 0, colour);
      kit.box(1.36, 0.08, 2.4, 0, 1.75, -0.05, "#1B1D21");
      for (const [x, z] of [[-0.62, 1.0], [0.62, 1.0], [-0.62, -1.1], [0.62, -1.1]]) kit.box(0.06, 0.55, 0.06, x, 1.25, z, "#2B2F36");
      kit.box(1.2, 0.5, 0.05, 0, 1.2, 1.12, "#2F3D48");
      wheel(0, 1.05);
      wheel(-0.55, -0.85);
      wheel(0.55, -0.85);
      figure(ctx, 0, 0.6, "#26355E", 0.9, true);
      break;
    case "okada":
      kit.box(0.28, 0.45, 1.5, 0, 0.45, 0, colour);
      kit.box(0.6, 0.06, 0.06, 0, 1.0, 0.65, "#2B2F36");
      wheel(0, 0.7, 0.33);
      wheel(0, -0.65, 0.33);
      kit.frame.makeTranslation(0, 0.45, -0.15);
      figure(ctx, 0, 0, "#B5532E", 1, true);
      kit.frame.identity();
      kit.ball(0.17, 0, 1.92, -0.15, "#C0392B", 0.9);
      break;
    case "danfo":
      kit.box(1.6, 1.5, 4.2, 0, 0.35, 0, "#F2B705");
      for (const y of [0.85, 1.25]) kit.box(1.62, 0.12, 4.22, 0, y, 0, "#1B1D21");
      kit.box(1.62, 0.5, 3.2, 0, 1.35, -0.3, "#2F3D48");
      kit.box(1.5, 0.55, 0.05, 0, 1.25, 2.1, "#2F3D48");
      for (const [x, z] of [[-0.75, 1.4], [0.75, 1.4], [-0.75, -1.4], [0.75, -1.4]]) wheel(x, z, 0.38);
      break;
    case "taxi":
      // A town cab in its colours, a white band round it.
      kit.box(1.5, 0.6, 3.6, 0, 0.3, 0, colour);
      kit.box(1.52, 0.16, 3.62, 0, 0.62, 0, "#F4F1EA");
      kit.box(1.3, 0.5, 1.8, 0, 0.9, -0.2, "#2F3D48");
      kit.box(1.25, 0.06, 1.7, 0, 1.4, -0.2, colour);
      kit.box(0.5, 0.2, 0.25, 0, 1.46, -0.2, "#F2B705");
      for (const [x, z] of [[-0.7, 1.15], [0.7, 1.15], [-0.7, -1.15], [0.7, -1.15]]) wheel(x, z, 0.32);
      break;
    case "car":
      kit.box(1.5, 0.6, 3.6, 0, 0.3, 0, colour);
      kit.box(1.3, 0.5, 1.8, 0, 0.9, -0.2, "#2F3D48");
      kit.box(1.25, 0.06, 1.7, 0, 1.4, -0.2, colour);
      for (const [x, z] of [[-0.7, 1.15], [0.7, 1.15], [-0.7, -1.15], [0.7, -1.15]]) wheel(x, z, 0.32);
      break;
    case "horse": {
      // A Durbar horse in its bright saddle cloth, the rider in white with a turban.
      kit.box(0.6, 0.75, 1.9, 0, 1.05, 0, "#6B4A2E");
      kit.slab(0.4, 0.9, 0.45, 0, 1.75, 1.0, "#6B4A2E", -0.6);
      kit.box(0.32, 0.4, 0.7, 0, 2.05, 1.45, "#6B4A2E");
      for (const [x, z] of [[-0.2, 0.75], [0.2, 0.75], [-0.2, -0.75], [0.2, -0.75]]) kit.box(0.14, 1.0, 0.14, x, 0, z, "#5A3A22");
      kit.box(0.66, 0.5, 1.0, 0, 1.4, -0.05, ["#C0392B", "#2E7D4F", "#F2B705"][Math.floor(R() * 3)]);
      kit.frame.makeTranslation(0, 1.55, -0.1);
      figure(ctx, 0, 0, "#F4F1EA", 1, true);
      kit.frame.identity();
      kit.ball(0.22, 0, 3.0, -0.1, "#F4F1EA", 0.8);
      break;
    }
  }
  return kit.merge()!;
}

/** A humped zebu cow, or the herder walking with his stick. */
function herdGeometry(cow: boolean, R: () => number): BufferGeometry {
  const kit = new Kit();
  if (cow) {
    const coat = ["#F4F1EA", "#B07A4F", "#6B4A2E", "#D8CDB8"][Math.floor(R() * 4)];
    kit.box(0.55, 0.6, 1.4, 0, 0.75, 0, coat);
    kit.ball(0.22, 0, 1.45, 0.45, coat, 0.8);
    kit.box(0.3, 0.32, 0.5, 0, 1.0, 0.85, coat);
    for (const s of [-1, 1]) kit.slab(0.05, 0.05, 0.5, s * 0.25, 1.35, 0.95, "#E8E0CC", 0, s * 0.6);
    for (const [x, z] of [[-0.18, 0.5], [0.18, 0.5], [-0.18, -0.5], [0.18, -0.5]]) kit.box(0.1, 0.75, 0.1, x, 0, z, coat);
  } else {
    figure({ kit, biome: "sahel", district: "out", rnd: R }, 0, 0, "#8C6A4A", 1);
    kit.slab(0.04, 1.8, 0.04, 0.3, 0.9, 0.2, "#5A3A22", 0.2);
    kit.cyl(0.3, 0.12, 0.25, 0, 1.85, 0, "#C9A85A", 10);
  }
  return kit.merge()!;
}

interface Mover {
  mesh: Object3D;
  a: number;
  b: number;
  t: number;
  /** Ground units a second. */
  speed: number;
  /** How far right of the centre line it keeps. */
  lane: number;
  avatar?: Avatar;
}

export interface LifeOptions {
  scene: Scene;
  map: WorldMap;
  graph: RoadGraph;
  fields: { x: number; z: number; w: number; d: number }[];
  slow: boolean;
}

export class StreetLife {
  private movers: Mover[] = [];
  private walkers: Mover[] = [];
  private herd: { lead: Mover; cows: { mesh: Mesh; back: number; side: number }[] } | null = null;
  private kids: { a: Avatar; x: number; z: number; tx: number; tz: number }[] = [];
  private ball = new Mesh(new SphereGeometry(0.22, 12, 10), new MeshLambertMaterial({ color: "#F4F1EA" }));
  private ballAt = { x: 0, z: 0, vx: 0, vz: 0 };
  private field: LifeOptions["fields"][number] | null = null;
  private roadVerts: number[] = [];
  private people: { set: People; clone: (o: Object3D) => Object3D } | null = null;
  private stateCode: string;
  private R = rng(1234);
  private group = new Group();

  constructor(private o: LifeOptions) {
    this.stateCode = o.map.state ?? "kwara";
    o.scene.add(this.group);
    const g = o.map.grid!;
    // Only vertices on real road cells: traffic never cuts through a plot to reach a gate.
    const onRoad = o.graph.verts.map((v) => {
      const w = toWorld(g, v);
      return ROADS.has(cellAt(g, Math.round(w.x / CELL), Math.round(w.z / CELL)));
    });
    this.onRoad = onRoad;
    this.roadVerts = o.graph.verts.filter((v, i) => onRoad[i] && v.edges.some((e) => onRoad[e.to])).map((v) => v.id);
    if (!this.roadVerts.length) return;
    this.spawnTraffic();
    this.spawnHerd();
  }
  private onRoad: boolean[] = [];

  private look() {
    const st = STATE[this.stateCode];
    return st ? lookOf(st) : "savanna";
  }

  private zone() {
    return STATE[this.stateCode]?.zone ?? "NC";
  }

  /** The traffic mix for the region. */
  private mix(): [VehicleKind, number][] {
    const z = this.zone();
    const look = this.look();
    // Abuja keeps okadas and kekes out of the city: cars and its green cabs.
    if (look === "fct") return [["car", 0.55], ["taxi", 0.35], ["danfo", 0.1]];
    if (look === "calabar" || look === "igbo") return [["keke", 0.35], ["car", 0.35], ["taxi", 0.2], ["okada", 0.1]];
    if (look === "creek") return [["keke", 0.35], ["okada", 0.3], ["car", 0.3], ["taxi", 0.05]];
    if (this.stateCode === "lagos") return [["danfo", 0.4], ["car", 0.3], ["keke", 0.2], ["okada", 0.1]];
    if (z === "NW" || z === "NE") return [["keke", 0.4], ["okada", 0.25], ["car", 0.25], ["horse", 0.1]];
    if (this.stateCode === "kwara") return [["keke", 0.35], ["okada", 0.25], ["car", 0.3], ["danfo", 0.05], ["horse", 0.05]];
    if (z === "SW") return [["danfo", 0.25], ["keke", 0.3], ["car", 0.3], ["okada", 0.15]];
    return [["keke", 0.35], ["car", 0.35], ["okada", 0.2], ["danfo", 0.1]];
  }

  private randomVert() {
    return this.roadVerts[Math.floor(this.R() * this.roadVerts.length)];
  }

  private nextEdge(at: number, from: number): number | null {
    const opts = this.o.graph.verts[at].edges.filter((e) => this.onRoad[e.to] && e.to !== from);
    const list = opts.length ? opts : this.o.graph.verts[at].edges.filter((e) => this.onRoad[e.to]);
    return list.length ? list[Math.floor(this.R() * list.length)].to : null;
  }

  private spawnTraffic() {
    const n = Math.max(16, Math.min(this.o.slow ? 30 : 55, Math.round(this.roadVerts.length / 6)));
    const mix = this.mix();
    const keke = BIOMES[this.look()].taxi ?? (this.zone() === "NW" || this.zone() === "NE" ? "#2E7D4F" : "#F2B705");
    const cache = new Map<string, BufferGeometry>();
    for (let i = 0; i < n; i++) {
      let r = this.R();
      let kind: VehicleKind = mix[0][0];
      for (const [k, w] of mix) {
        if (r < w) {
          kind = k;
          break;
        }
        r -= w;
      }
      const colour = kind === "keke" || kind === "taxi" ? keke : kind === "okada" ? ["#C0392B", "#2B2F36", "#2B5C9A"][i % 3] : ["#C0392B", "#F4F1EA", "#2B2F36", "#2B5C9A", "#8E979F", "#E0A526"][i % 6];
      const key = `${kind}|${colour}`;
      let geo = cache.get(key);
      if (!geo) cache.set(key, (geo = vehicleGeometry(kind, colour, this.R)));
      const mesh = new Mesh(geo, MAT);
      mesh.castShadow = true;
      this.group.add(mesh);
      const a = this.randomVert();
      const b = this.nextEdge(a, -1);
      if (b === null) continue;
      const speed = kind === "horse" ? 2.2 : kind === "okada" ? 11 : kind === "keke" ? 8 : kind === "danfo" ? 9 : 10;
      this.movers.push({ mesh, a, b, t: this.R(), speed: speed * (0.8 + this.R() * 0.4), lane: kind === "horse" ? 3.6 : 1.4 });
    }
  }

  /** A Fulani herder driving cattle along the roads, in the north. */
  private spawnHerd() {
    const z = this.zone();
    if (z !== "NW" && z !== "NE" && z !== "NC") return;
    const lead = new Mesh(herdGeometry(false, this.R), MAT);
    this.group.add(lead);
    const a = this.randomVert();
    const b = this.nextEdge(a, -1);
    if (b === null) return;
    const cows = Array.from({ length: 6 }, (_, i) => {
      const m = new Mesh(herdGeometry(true, this.R), MAT);
      m.castShadow = true;
      this.group.add(m);
      return { mesh: m, back: 1.8 + Math.floor(i / 2) * 1.8, side: (i % 2 ? 1 : -1) * 0.8 };
    });
    this.herd = { lead: { mesh: lead, a, b, t: 0, speed: 1.1, lane: 2.5 }, cows };
  }

  /** Townspeople and the children's football need the real people models: called once they load. */
  setPeople(set: People, clone: (o: Object3D) => Object3D) {
    this.people = { set, clone };
    this.ball.castShadow = true;
    this.group.add(this.ball);
  }

  /** Move a mover along its road; returns its world position and heading. */
  private advance(m: Mover, dt: number, g = this.o.map.grid!) {
    const P = this.o.graph.verts[m.a];
    const Q = this.o.graph.verts[m.b];
    const p = toWorld(g, P);
    const q = toWorld(g, Q);
    const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    m.t += (m.speed * dt) / len;
    if (m.t >= 1) {
      m.t = 0;
      const prev = m.a;
      m.a = m.b;
      const next = this.nextEdge(m.a, prev);
      if (next !== null) m.b = next;
      return this.place(m, g);
    }
    return this.place(m, g);
  }

  private place(m: Mover, g = this.o.map.grid!) {
    const p = toWorld(g, this.o.graph.verts[m.a]);
    const q = toWorld(g, this.o.graph.verts[m.b]);
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    // Keep right: offset to the right of the way of travel.
    const rx = -dz / len;
    const rz = dx / len;
    const x = p.x + dx * m.t - rx * m.lane;
    const z = p.z + dz * m.t - rz * m.lane;
    const y = isLotCode(cellAt(g, Math.round(x / CELL), Math.round(z / CELL))) ? PLOT_H : 0.03;
    m.mesh.position.set(x, y, z);
    m.mesh.rotation.y = Math.atan2(dx, dz);
    return { x, z, heading: m.mesh.rotation.y };
  }

  /** Townspeople walking near the camera: kept to a dozen, re-placed when the camera moves on. */
  private tendWalkers(target: Vector3) {
    if (!this.people) return;
    const want = this.o.slow ? 6 : 12;
    const g = this.o.map.grid!;
    // Add one new walker a frame, so the people arrive without a stall.
    if (this.walkers.length < want) {
      const near = this.roadVerts.filter((id) => {
        const w = toWorld(g, this.o.graph.verts[id]);
        return Math.hypot(w.x - target.x, w.z - target.z) < 70;
      });
      const a = near.length ? near[Math.floor(this.R() * near.length)] : this.randomVert();
      const b = this.nextEdge(a, -1);
      if (b !== null) {
        const look = { g: (["m", "f", "h"] as const)[Math.floor(this.R() * 3)], skin: ["#8D5524", "#6B3E26", "#4A2A18", "#A86B3C"][Math.floor(this.R() * 4)], cloth: ["#F4F1EA", "#2F7D7A", "#8C2F5A", "#26355E", "#B5532E", "#3F6B3A", "#C9A227"][Math.floor(this.R() * 7)] };
        const av = new Avatar(this.people.set, look, attireFor(this.stateCode, look.g), this.people.clone);
        this.group.add(av.root);
        this.walkers.push({ mesh: av.root, a, b, t: this.R(), speed: 1.3 + this.R() * 0.5, lane: 4.0, avatar: av });
      }
    }
    // Anyone who has wandered far from the camera starts again somewhere near it.
    for (const w of this.walkers) {
      const d = Math.hypot(w.mesh.position.x - target.x, w.mesh.position.z - target.z);
      if (d > 110) {
        const near = this.roadVerts.filter((id) => {
          const p = toWorld(g, this.o.graph.verts[id]);
          return Math.hypot(p.x - target.x, p.z - target.z) < 60;
        });
        if (near.length) {
          w.a = near[Math.floor(this.R() * near.length)];
          w.b = this.nextEdge(w.a, -1) ?? w.b;
          w.t = 0;
        }
      }
    }
  }

  /** Children playing football on the pitch nearest the camera. */
  private tendKids(target: Vector3, dt: number) {
    if (!this.people || !this.o.fields.length) return;
    const near = [...this.o.fields].sort((a, b) => Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z))[0];
    if (Math.hypot(near.x - target.x, near.z - target.z) > 160) return;
    if (near !== this.field) {
      this.field = near;
      this.ballAt = { x: near.x, z: near.z, vx: 0, vz: 0 };
      for (const k of this.kids) k.a.root.visible = true;
    }
    const f = near;
    while (this.kids.length < (this.o.slow ? 4 : 8)) {
      const look = { g: (this.kids.length % 3 ? "m" : "f") as "m" | "f", skin: ["#8D5524", "#6B3E26", "#4A2A18"][this.kids.length % 3], cloth: ["#C0392B", "#2B5C9A"][this.kids.length % 2] };
      const a = new Avatar(this.people.set, look, attireFor("lagos", look.g), this.people.clone);
      a.root.scale.setScalar(0.62);
      this.group.add(a.root);
      this.kids.push({ a, x: f.x + (this.R() - 0.5) * f.w * 0.6, z: f.z + (this.R() - 0.5) * f.d * 0.6, tx: f.x, tz: f.z });
    }
    // The ball rolls and slows; the nearest child runs to it and kicks it somewhere new.
    const b = this.ballAt;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.vx *= 1 - dt * 0.9;
    b.vz *= 1 - dt * 0.9;
    b.x = Math.max(f.x - f.w / 2 + 1, Math.min(f.x + f.w / 2 - 1, b.x));
    b.z = Math.max(f.z - f.d / 2 + 1, Math.min(f.z + f.d / 2 - 1, b.z));
    this.ball.position.set(b.x, PLOT_H + 0.25, b.z);
    let chaser = this.kids[0];
    for (const k of this.kids) if (Math.hypot(k.x - b.x, k.z - b.z) < Math.hypot(chaser.x - b.x, chaser.z - b.z)) chaser = k;
    for (const k of this.kids) {
      const tx = k === chaser ? b.x : k.tx;
      const tz = k === chaser ? b.z : k.tz;
      const dx = tx - k.x;
      const dz = tz - k.z;
      const d = Math.hypot(dx, dz);
      const speed = k === chaser ? 5 : d > 1 ? 2.5 : 0;
      if (d > 0.2) {
        k.x += (dx / d) * Math.min(d, speed * dt);
        k.z += (dz / d) * Math.min(d, speed * dt);
        k.a.root.rotation.y = Math.atan2(dx, dz);
      }
      if (k === chaser && d < 0.6) {
        // Kick it.
        const ang = this.R() * Math.PI * 2;
        b.vx = Math.cos(ang) * 9;
        b.vz = Math.sin(ang) * 9;
      }
      if (k !== chaser && d < 1 && this.R() < dt) {
        k.tx = f.x + (this.R() - 0.5) * f.w * 0.8;
        k.tz = f.z + (this.R() - 0.5) * f.d * 0.8;
      }
      k.a.root.position.set(k.x, PLOT_H + 0.02, k.z);
      k.a.update(dt, k === chaser ? speed : d > 1 ? 2.5 : 0);
    }
  }

  update(dt: number, target: Vector3, running: boolean) {
    if (!running) dt = 0;
    for (const m of this.movers) this.advance(m, dt);
    if (this.herd) {
      const h = this.advance(this.herd.lead, dt);
      const back = -Math.sin(h.heading);
      const backZ = -Math.cos(h.heading);
      for (const c of this.herd.cows) {
        const sx = Math.cos(h.heading) * c.side;
        const sz = -Math.sin(h.heading) * c.side;
        c.mesh.position.set(h.x + back * c.back + sx, this.herd.lead.mesh.position.y, h.z + backZ * c.back + sz);
        c.mesh.rotation.y = h.heading;
      }
    }
    this.tendWalkers(target);
    for (const w of this.walkers) {
      this.advance(w, dt);
      w.avatar?.update(dt, dt ? w.speed : 0);
    }
    this.tendKids(target, dt);
  }

  dispose() {
    for (const w of this.walkers) w.avatar?.dispose();
    for (const k of this.kids) k.a.dispose();
    this.group.removeFromParent();
  }
}
