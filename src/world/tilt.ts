// The camera tilt: the map canvas leans back with a CSS 3D transform as you zoom in to the streets,
// so the far side of town recedes towards a hazy sky. Pure maths here; GameMap applies it.
// The transform is perspective(P) rotateX(θ) about the bottom centre of the canvas.

/** Steepest lean, in degrees, when fully zoomed in. Flat when zoomed out to see the whole town. */
export const MAX_TILT = 12;
/** Perspective distance as a multiple of the canvas height. Smaller looks more dramatic. */
export const PERSPECTIVE = 2.2;

export interface TiltView {
  /** Canvas size in CSS pixels. */
  w: number;
  h: number;
  /** Lean in degrees. */
  deg: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Lean for a zoom level: flat at the widest zoom, MAX_TILT at the closest. Zooms are viewport scales. */
export function tiltFor(scale: number, minScale: number, maxScale: number): number {
  if (!(maxScale > minScale) || !(scale > 0)) return 0;
  const z = Math.log(scale / minScale) / Math.log(maxScale / minScale);
  return MAX_TILT * smooth(0.3, 1, z);
}

/** The CSS transform for the canvas. */
export const tiltCss = (v: TiltView) => `perspective(${Math.round(v.h * PERSPECTIVE)}px) rotateX(${v.deg.toFixed(2)}deg)`;

/** Where a point on the flat canvas appears on screen, both relative to the canvas's top-left. */
export function project(v: TiltView, x: number, y: number): { x: number; y: number } {
  const P = v.h * PERSPECTIVE;
  const X = x - v.w / 2;
  const Y = y - v.h;
  const k = P / (P - Y * Math.sin(rad(v.deg)));
  return { x: v.w / 2 + X * k, y: v.h + Y * Math.cos(rad(v.deg)) * k };
}

/** The point on the flat canvas under a screen point: the inverse of project. */
export function unproject(v: TiltView, sx: number, sy: number): { x: number; y: number } {
  const P = v.h * PERSPECTIVE;
  const s = Math.sin(rad(v.deg));
  const c = Math.cos(rad(v.deg));
  const X = sx - v.w / 2;
  const Y = sy - v.h;
  const flatY = (Y * P) / (P * c + Y * s);
  const k = P / (P - flatY * s);
  return { x: v.w / 2 + X / k, y: v.h + flatY };
}
