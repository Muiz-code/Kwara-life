// A jointed low-poly person who walks, runs and stands about, dressed for where they are from. Hips,
// knees, shoulders and elbows are pivots, so a walk is legs and arms swinging in turn, and a run leans
// forward with bent knees and a bounce. Flowing clothes (agbada, babban riga, wrappers) sway as they go.
import {
  BoxGeometry, CapsuleGeometry, CylinderGeometry, DoubleSide, FrontSide, Group, Mesh, MeshLambertMaterial, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from "three";
import type { Attire } from "../data/attire";
import type { Gender } from "../data/character";
import { fabric, shade, type Weave } from "./fabric";

/** Walking and running speeds, in ground units (about metres) a second. */
export const WALK_SPEED = 4.2;
export const RUN_SPEED = 9;

export interface Look {
  g: Gender;
  skin: string;
  cloth: string;
}

/** A material for a cloth, or a plain colour when the pattern is plain. */
function cloth(colour: string, weave: Weave = "plain", double = false) {
  const map = fabric(weave, colour);
  return new MeshLambertMaterial({ color: map ? "#ffffff" : colour, map, side: double ? DoubleSide : FrontSide });
}

function part(geometry: BufferGeometry, material: MeshLambertMaterial, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** A limb: a pivot at the top joint, the upper part, a second pivot at the knee or elbow, the lower part. */
function limb(upper: number, lower: number, r: number, top: MeshLambertMaterial, bottom: MeshLambertMaterial, end?: Mesh) {
  const joint = new Group();
  joint.add(part(new CapsuleGeometry(r, upper - r * 2, 3, 8), top, 0, -upper / 2, 0));
  const bend = new Group();
  bend.position.y = -upper;
  bend.add(part(new CapsuleGeometry(r * 0.9, lower - r * 2, 3, 8), bottom, 0, -lower / 2, 0));
  if (end) {
    end.position.y = -lower;
    bend.add(end);
  }
  joint.add(bend);
  return { joint, bend };
}

/** An open tube of cloth from y0 up to y1, wider at the bottom. */
const tube = (rTop: number, rBottom: number, y0: number, y1: number, m: MeshLambertMaterial) =>
  part(new CylinderGeometry(rTop, rBottom, y1 - y0, 14, 1, true), m, 0, (y0 + y1) / 2, 0);

export class Character {
  readonly root = new Group();
  private body = new Group();
  private legs: { joint: Group; bend: Group }[] = [];
  private arms: { joint: Group; bend: Group }[] = [];
  /** Clothes that swing as you walk. */
  private sway: Mesh[] = [];
  /** How much the arms swing: less under a wide agbada. */
  private armSwing = 1;
  private phase = 0;
  /** Smoothed speed, so starting and stopping ease in. */
  private pace = 0;
  private materials: MeshLambertMaterial[] = [];

  constructor(look: Look, attire: Attire) {
    const { skin } = look;
    const main = look.cloth;
    const trim = shade(main, 0.7);
    const M = (colour: string, weave: Weave = "plain", double = false) => {
      const m = cloth(colour, weave, double);
      this.materials.push(m);
      return m;
    };
    const skinM = M(skin);
    const fab = M(main, attire.pattern);
    const fabDouble = M(main, attire.pattern, true);
    const dark = M(attire.body === "isiagu" ? "#1E1E22" : trim);
    const sandal = M("#3B2A1E");
    this.root.add(this.body);

    // Who shows a leg: trousers under men's clothes, bare ankles under a wrapper or gown.
    const trousers = attire.body === "agbada" || attire.body === "babbanriga" || attire.body === "kaftan" ? (attire.body === "agbada" ? fab : dark) : attire.body === "isiagu" ? dark : skinM;
    for (const side of [-1, 1]) {
      const foot = part(new BoxGeometry(0.13, 0.08, 0.26), sandal, 0, -0.02, 0.06);
      const l = limb(0.44, 0.42, 0.075, trousers, trousers, foot);
      l.joint.position.set(side * 0.11, 0.92, 0);
      this.body.add(l.joint);
      this.legs.push(l);
    }

    // The top half: a fitted top in the outfit's cloth.
    const torso = part(new CapsuleGeometry(0.19, 0.42, 4, 12), fab, 0, 1.24, 0);
    torso.scale.set(1.05, 1, 0.75);
    this.body.add(torso);

    const sleeves = attire.body === "abaya" || attire.body === "agbada" || attire.body === "babbanriga" || attire.body === "kaftan" || attire.body === "etibo";
    switch (attire.body) {
      case "agbada":
      case "babbanriga": {
        // The great flowing robe: front and back panels from the shoulders, wide enough to cover the arms.
        const long = attire.body === "babbanriga";
        const robe = M(main, attire.pattern === "asooke" ? "asooke" : "embroidery", true);
        const bottom = long ? 0.14 : 0.5;
        const h = 1.56 - bottom;
        for (const z of [0.16, -0.16]) {
          const panel = part(new BoxGeometry(long ? 1.1 : 1.0, h, 0.05), robe, 0, bottom + h / 2, z);
          this.body.add(panel);
          this.sway.push(panel);
        }
        this.body.add(part(new BoxGeometry(long ? 1.1 : 1.0, 0.08, 0.38), robe, 0, 1.55, 0));
        // Embroidery down the chest.
        this.body.add(part(new BoxGeometry(0.34, 0.5, 0.01), M(main, "embroidered-panel"), 0, 1.25, 0.19));
        if (!long) this.body.add(tube(0.2, 0.26, 0.55, 1.0, fab));
        this.armSwing = 0.4;
        break;
      }
      case "kaftan":
      case "etibo": {
        // A long shirt to the knee; under an etibo, a wrapper to the ankle.
        if (attire.body === "etibo") {
          const wrapper = tube(0.21, 0.29, 0.1, 0.98, M(trim, attire.pattern, true));
          this.body.add(wrapper);
          this.sway.push(wrapper);
          this.body.add(tube(0.22, 0.3, 0.55, 1.02, M(main, "plain", true)));
        } else {
          const tail = tube(0.22, 0.3, 0.5, 1.02, fabDouble);
          this.body.add(tail);
          this.sway.push(tail);
        }
        this.body.add(part(new BoxGeometry(0.1, 0.32, 0.02), M(main, "embroidered-panel"), 0, 1.36, 0.15));
        break;
      }
      case "isiagu":
        this.body.add(tube(0.21, 0.24, 0.86, 1.05, fab));
        break;
      case "iro": {
        // The iro tied at the waist down to the ankle, the buba's hem over it, the ipele on one shoulder.
        const iro = tube(0.2, 0.3, 0.08, 0.98, fabDouble);
        this.body.add(iro, tube(0.22, 0.27, 0.86, 1.08, fab));
        this.sway.push(iro);
        const ipele = part(new BoxGeometry(0.1, 0.75, 0.42), fabDouble, 0.16, 1.2, 0);
        ipele.rotation.z = 0.55;
        this.body.add(ipele);
        break;
      }
      case "wrapper": {
        // A blouse with puffed sleeves and a double wrapper.
        const inner = tube(0.2, 0.3, 0.08, 0.98, fabDouble);
        const outer = tube(0.23, 0.31, 0.5, 0.98, M(main, attire.pattern, true));
        this.body.add(inner, outer);
        this.sway.push(inner, outer);
        for (const side of [-1, 1]) this.body.add(part(new SphereGeometry(0.1, 10, 8), fab, side * 0.27, 1.46, 0));
        break;
      }
      case "abaya": {
        const gown = tube(0.24, 0.33, 0.08, 1.45, M(main, "plain", true));
        this.body.add(gown);
        this.sway.push(gown);
        break;
      }
    }

    // Arms swing from the shoulders.
    for (const side of [-1, 1]) {
      const hand = part(new SphereGeometry(0.055, 8, 6), skinM);
      const a = limb(0.3, 0.28, 0.06, fab, sleeves ? fab : skinM, hand);
      a.joint.position.set(side * 0.27, 1.48, 0);
      a.joint.rotation.z = side * 0.08;
      this.body.add(a.joint);
      this.arms.push(a);
    }

    // Neck, head and beads.
    this.body.add(part(new CylinderGeometry(0.06, 0.07, 0.1, 8), skinM, 0, 1.6, 0));
    const head = part(new SphereGeometry(0.14, 14, 12), skinM, 0, 1.75, 0);
    head.scale.set(0.95, 1.08, 1);
    this.body.add(head);
    if (attire.beads) {
      const coral = M("#D9532B");
      for (const [r, y] of [[0.1, 1.6], [0.13, 1.56]] as const) {
        const ring = part(new TorusGeometry(r, 0.025, 6, 16), coral, 0, y, 0.02);
        ring.rotation.x = Math.PI / 2 + 0.25;
        this.body.add(ring);
      }
    }
    this.hat(attire, main, trim, M);
  }

  private hat(attire: Attire, main: string, trim: string, M: (c: string, w?: Weave, d?: boolean) => MeshLambertMaterial) {
    const b = this.body;
    switch (attire.head) {
      case "fila": {
        // A soft cap folded over to one side.
        const fila = part(new CylinderGeometry(0.13, 0.145, 0.14, 14), M(trim, attire.pattern === "asooke" ? "asooke" : "plain"), 0.02, 1.88, 0);
        fila.rotation.z = -0.3;
        const fold = part(new SphereGeometry(0.08, 8, 6), M(trim), 0.12, 1.93, 0);
        b.add(fila, fold);
        break;
      }
      case "hula":
        b.add(part(new CylinderGeometry(0.145, 0.145, 0.14, 16), M(attire.pattern === "anger" ? "#F2F0EA" : main, "embroidered-panel"), 0, 1.88, 0));
        break;
      case "okpu":
        b.add(part(new CylinderGeometry(0.14, 0.145, 0.15, 16), M("#B3261E", "okpu"), 0, 1.88, 0));
        break;
      case "bowler":
        b.add(part(new CylinderGeometry(0.24, 0.24, 0.02, 18), M("#2B2F36"), 0, 1.86, 0));
        b.add(part(new SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M("#2B2F36"), 0, 1.86, 0));
        break;
      case "gele": {
        // A gele, tied high and wide, in the outfit's cloth.
        const m = M(main, attire.pattern, true);
        for (const [x, y, s] of [[0, 1.92, 0.21], [-0.13, 1.97, 0.14], [0.14, 1.99, 0.13], [0, 2.05, 0.1]] as const) {
          const knot = part(new SphereGeometry(s, 12, 8), m, x, y, -0.02);
          knot.scale.set(1.35, 0.72, 1.05);
          b.add(knot);
        }
        break;
      }
      case "ichafu": {
        const m = M(main, attire.pattern, true);
        const wrap = part(new SphereGeometry(0.16, 12, 8), m, 0, 1.86, -0.01);
        wrap.scale.set(1.05, 0.75, 1.1);
        b.add(wrap, part(new SphereGeometry(0.07, 8, 6), m, 0.08, 1.95, -0.12));
        break;
      }
      case "mayafi": {
        // A long veil over the head, falling past the shoulders.
        const m = M(shade(main, 1.25), "plain", true);
        const veil = part(new SphereGeometry(0.17, 12, 10), m, 0, 1.77, -0.01);
        veil.scale.set(1, 1.12, 1);
        const fall = tube(0.17, 0.36, 1.05, 1.68, m);
        b.add(veil, fall);
        this.sway.push(fall);
        break;
      }
      case "hijab": {
        const m = M(main, "plain", true);
        const veil = part(new SphereGeometry(0.17, 12, 10), m, 0, 1.77, -0.01);
        veil.scale.set(1, 1.12, 1);
        b.add(veil, tube(0.15, 0.28, 1.42, 1.68, m));
        break;
      }
    }
  }

  /** Move the limbs. speed is in ground units a second: 0 stands, WALK_SPEED walks, RUN_SPEED runs. */
  update(dt: number, speed: number) {
    this.pace += (speed - this.pace) * Math.min(1, dt * 8);
    const v = this.pace;
    const run = Math.max(0, Math.min(1, (v - WALK_SPEED) / (RUN_SPEED - WALK_SPEED)));
    const moving = Math.min(1, v / WALK_SPEED);
    this.phase += dt * (v > 0.05 ? 2.2 + v * 0.55 : 0) * Math.PI;
    const s = Math.sin(this.phase);
    const swing = moving * (0.55 + run * 0.45);
    this.legs.forEach((l, i) => {
      l.joint.rotation.x = (i ? -s : s) * swing;
      // The knee bends as the leg comes forward, more when running.
      l.bend.rotation.x = Math.max(0, -Math.cos(this.phase + (i ? Math.PI : 0))) * (0.5 + run * 0.9) * moving;
    });
    this.arms.forEach((a, i) => {
      a.joint.rotation.x = (i ? s : -s) * swing * (0.8 + run * 0.4) * this.armSwing;
      a.bend.rotation.x = -(0.15 + run * 1.1) * moving;
    });
    // Lean into a run, bob with each step, breathe when standing.
    this.body.rotation.x = run * 0.22;
    this.body.position.y = moving ? Math.abs(Math.cos(this.phase)) * (0.03 + run * 0.08) : Math.sin(performance.now() / 600) * 0.008;
    for (const m of this.sway) m.rotation.x = -s * swing * 0.1;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}
