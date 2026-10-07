// Vehicles on the isometric streets.
//
// A street runs along one of the two grid directions, so a vehicle only ever
// heads one of four ways. Going up the screen you see its back; coming down the
// screen you see its front. Art comes in two views per vehicle (front and back,
// both heading left) and is mirrored for the other two headings. Until a file
// exists the vehicle is drawn in code, the same four ways.
import { Graphics } from "pixi.js";

export type VehicleKind = "keke" | "okada" | "danfo" | "car" | "suv" | "horse";

/** Down-left, down-right, up-right, up-left on screen. */
export type Heading = "dl" | "dr" | "ur" | "ul";

export const headingOf = (dx: number, dy: number): Heading => (dy >= 0 ? (dx <= 0 ? "dl" : "dr") : dx >= 0 ? "ur" : "ul");

/** Coming towards the viewer. */
export const showsFront = (h: Heading) => h === "dl" || h === "dr";

const V = "/assets/vehicles/";

/** The art file for a vehicle heading a given way, and whether to mirror it. */
export function vehicleArt(kind: VehicleKind, h: Heading): { src: string; flip: boolean } {
  return { src: `${V}${kind}-${showsFront(h) ? "front" : "back"}.webp`, flip: h === "dr" || h === "ul" };
}

/** A traffic light pole, its lamps facing down and to the left. */
export const TRAFFIC_LIGHT_ART = `${V}trafficlight.webp`;

/** Where the three lamps sit on the traffic light art, as fractions of its width and height. */
export const LAMPS = { x: 0.41, red: 0.11, amber: 0.22, green: 0.32, r: 0.06 };

export const ALL_VEHICLE_ART = [
  ...(["keke", "okada", "danfo", "car", "suv", "horse"] as VehicleKind[]).flatMap((k) => [`${V}${k}-front.webp`, `${V}${k}-back.webp`]),
  TRAFFIC_LIGHT_ART,
];

/** Size on screen: length along the street, width across it, height. */
const SIZE: Record<VehicleKind, { l: number; w: number; h: number }> = {
  keke: { l: 30, w: 18, h: 22 },
  okada: { l: 26, w: 7, h: 12 },
  danfo: { l: 50, w: 22, h: 26 },
  car: { l: 40, w: 20, h: 14 },
  suv: { l: 44, w: 22, h: 20 },
  horse: { l: 30, w: 8, h: 20 },
};

const BODY: Record<VehicleKind, number> = {
  keke: 0xf2b705, okada: 0xb3261e, danfo: 0xf2b705, car: 0x2b4c7e, suv: 0x1f1f1f, horse: 0x8b5a3a,
};

const CAR_COLOURS = [0x2b4c7e, 0xc0392b, 0xf4f1ea, 0x2f7d5b, 0x7e8792, 0x1f1f1f];

/** Unit vectors on screen for travel along each heading, and for the street's other axis. */
const AXIS: Record<Heading, { f: [number, number]; s: [number, number] }> = {
  dl: { f: [-0.894, 0.447], s: [0.894, 0.447] },
  dr: { f: [0.894, 0.447], s: [-0.894, 0.447] },
  ur: { f: [0.894, -0.447], s: [0.894, 0.447] },
  ul: { f: [-0.894, -0.447], s: [-0.894, 0.447] },
};

const shade = (c: number, k: number) => {
  const r = Math.round(((c >> 16) & 255) * k);
  const g = Math.round(((c >> 8) & 255) * k);
  const b = Math.round((c & 255) * k);
  return (Math.min(255, r) << 16) | (Math.min(255, g) << 8) | Math.min(255, b);
};

/**
 * Draws a vehicle at (0, 0), its wheels on the ground there, heading h. A box
 * with its visible sides shaded, a windscreen on the front, tail lights on the
 * back, so which way it is going reads at a glance.
 */
export function drawVehicle(g: Graphics, kind: VehicleKind, h: Heading, tint = 0): void {
  const { l, w, h: ht } = SIZE[kind];
  const { f, s } = AXIS[h];
  const body = kind === "car" ? CAR_COLOURS[tint % CAR_COLOURS.length] : BODY[kind];
  const at = (a: number, b: number, up = 0): [number, number] => [f[0] * a + s[0] * b, f[1] * a + s[1] * b - up];

  // Shadow on the road.
  const sh = [at(l / 2, w / 2), at(l / 2, -w / 2), at(-l / 2, -w / 2), at(-l / 2, w / 2)].flat();
  g.poly(sh).fill({ color: 0x000000, alpha: 0.22 });

  const base = { fl: at(l / 2, w / 2), fr: at(l / 2, -w / 2), br: at(-l / 2, -w / 2), bl: at(-l / 2, w / 2) };
  const up = (p: [number, number]): [number, number] => [p[0], p[1] - ht];
  // The four sides, back to front, so nearer sides cover farther ones.
  const sides: { pts: [number, number][]; front: boolean; back: boolean }[] = [
    { pts: [base.fl, base.fr, up(base.fr), up(base.fl)], front: true, back: false },
    { pts: [base.br, base.bl, up(base.bl), up(base.br)], front: false, back: true },
    { pts: [base.fr, base.br, up(base.br), up(base.fr)], front: false, back: false },
    { pts: [base.bl, base.fl, up(base.fl), up(base.bl)], front: false, back: false },
  ];
  sides.sort((a, b) => a.pts.reduce((t, p) => t + p[1], 0) - b.pts.reduce((t, p) => t + p[1], 0));
  for (const side of sides) {
    const midY = side.pts.reduce((t, p) => t + p[1], 0) / 4;
    g.poly(side.pts.flat()).fill(shade(body, midY > -ht / 2 ? 0.78 : 0.62)).stroke({ width: 1, color: 0x000000, alpha: 0.25 });
    // Windscreen on the front, rear window and tail lights on the back.
    if (side.front || side.back) {
      const [a, b] = [side.pts[0], side.pts[1]];
      const k = (p: [number, number], q: [number, number], t: number): [number, number] => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      const lo = 0.45;
      const hi = 0.9;
      const win = [k(a, b, 0.12), k(a, b, 0.88)].map((p) => p);
      g.poly([
        win[0][0], win[0][1] - ht * lo, win[1][0], win[1][1] - ht * lo,
        win[1][0], win[1][1] - ht * hi, win[0][0], win[0][1] - ht * hi,
      ]).fill(side.front ? 0x9cc3d5 : 0x5f7f90);
      if (side.back) {
        for (const t of [0.15, 0.85]) {
          const p = k(a, b, t);
          g.circle(p[0], p[1] - ht * 0.25, 2).fill(0xe0322a);
        }
      } else {
        for (const t of [0.15, 0.85]) {
          const p = k(a, b, t);
          g.circle(p[0], p[1] - ht * 0.25, 2).fill(0xfff2b0);
        }
      }
    }
  }
  // Roof. A keke's canopy and a danfo's roof rack are dark.
  const roof = [up(base.fl), up(base.fr), up(base.br), up(base.bl)].flat();
  g.poly(roof).fill(kind === "keke" || kind === "danfo" ? 0x2a2a2a : shade(body, 1.08));
  if (kind === "danfo") {
    // The black stripe along each side.
    for (const [p, q] of [[base.fr, base.br], [base.bl, base.fl]] as [[number, number], [number, number]][]) {
      g.moveTo(p[0], p[1] - ht * 0.32).lineTo(q[0], q[1] - ht * 0.32).stroke({ width: 2, color: 0x111111 });
    }
  }
  if (kind === "okada" || kind === "horse") {
    // The rider.
    const c = at(-l * 0.1, 0, ht + 8);
    g.circle(c[0], c[1], 4).fill(0x4a2a18);
    g.rect(c[0] - 3, c[1] + 3, 6, 8).fill(kind === "horse" ? 0xf4f1ea : 0x2b4c7e);
  }
}
