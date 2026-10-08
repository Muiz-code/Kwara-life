// A kit for building low-poly scenery out of boxes, roofs, cylinders and balls. Every part is baked
// into one geometry with a colour per vertex, so a whole neighbourhood is one mesh and one draw call.
import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Euler, Float32BufferAttribute, IcosahedronGeometry,
  Matrix4, Quaternion, Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const colour = new Color();
const local = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const one = new Vector3(1, 1, 1);
const at = new Vector3();

/** A roof with sloped faces over a w by d rectangle (w along x). ridge is half the ridge length. */
function roofGeometry(w: number, d: number, h: number, ridge: number): BufferGeometry {
  const x = w / 2;
  const z = d / 2;
  const A = [-x, 0, -z], B = [x, 0, -z], C = [x, 0, z], D = [-x, 0, z];
  const R1 = [-ridge, h, 0], R2 = [ridge, h, 0];
  const tris = [D, C, R2, D, R2, R1, B, A, R1, B, R1, R2, A, D, R1, C, B, R2];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

export class Kit {
  private parts: BufferGeometry[] = [];
  /** Applied after each part's own placement: the building's plot and the way it faces. */
  frame = new Matrix4();

  get size() {
    return this.parts.length;
  }

  /** Add a geometry, placed at (x, y, z) and turned by (rx, ry, rz), in one colour. */
  add(geometry: BufferGeometry, color: string | number, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    if (g.getAttribute("uv")) g.deleteAttribute("uv");
    q.setFromEuler(e.set(rx, ry, rz));
    local.compose(at.set(x, y, z), q, one);
    g.applyMatrix4(local.premultiply(this.frame));
    colour.set(color);
    const n = g.getAttribute("position").count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c[i * 3] = colour.r;
      c[i * 3 + 1] = colour.g;
      c[i * 3 + 2] = colour.b;
    }
    g.setAttribute("color", new Float32BufferAttribute(c, 3));
    this.parts.push(g);
  }

  /** A box standing on y (its bottom), centred on x and z. */
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: string | number, ry = 0) {
    this.add(new BoxGeometry(w, h, d), color, x, y + h / 2, z, ry);
  }

  /** A box centred on (x, y, z) and tilted: a sloping zinc sheet, a ramp, a leaning post. */
  slab(w: number, h: number, d: number, x: number, y: number, z: number, color: string | number, rx = 0, ry = 0, rz = 0) {
    this.add(new BoxGeometry(w, h, d), color, x, y, z, ry, rx, rz);
  }

  /** An upright cylinder standing on y. Six sides is plenty for a post or a pipe. */
  cyl(rTop: number, rBottom: number, h: number, x: number, y: number, z: number, color: string | number, sides = 8, rx = 0, rz = 0) {
    this.add(new CylinderGeometry(rTop, rBottom, h, sides), color, x, y + h / 2, z, 0, rx, rz);
  }

  /** A faceted ball: tree canopies, domes, heads. sy squashes it. */
  ball(r: number, x: number, y: number, z: number, color: string | number, sy = 1, detail = 0) {
    const g = new IcosahedronGeometry(r, detail);
    if (sy !== 1) g.scale(1, sy, 1);
    this.add(g, color, x, y, z);
  }

  /** A hip roof (four slopes) over a w by d footprint, sitting on y. */
  hip(w: number, d: number, h: number, x: number, y: number, z: number, color: string | number, ry = 0) {
    const turn = d > w;
    const [a, b] = turn ? [d, w] : [w, d];
    this.add(roofGeometry(a, b, h, (a - b) / 2), color, x, y, z, ry + (turn ? Math.PI / 2 : 0));
  }

  /** A gable roof (two slopes, ridge along x) over a w by d footprint. */
  gable(w: number, d: number, h: number, x: number, y: number, z: number, color: string | number, ry = 0) {
    this.add(roofGeometry(w, d, h, w / 2), color, x, y, z, ry);
  }

  /** Everything added so far, as one geometry. The kit is empty afterwards. */
  merge(): BufferGeometry | null {
    if (!this.parts.length) return null;
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    return g;
  }
}
