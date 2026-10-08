// A room's floor as a grid of small squares, each free or blocked, worked out from the room's own
// geometry: anything standing between ankle and head height (walls, beds, tables, pews) blocks the squares
// under it. People find their way round with A*, so they walk through doorways and round furniture
// instead of through them.
import type { BufferGeometry } from "three";

export interface P {
  x: number;
  z: number;
}

export class FloorPlan {
  readonly cols: number;
  readonly rows: number;
  private blocked: Uint8Array;

  /** A w by d floor centred on the origin, in squares of the given size. */
  constructor(readonly w: number, readonly d: number, readonly cell = 0.2) {
    this.cols = Math.ceil(w / cell);
    this.rows = Math.ceil(d / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
  }

  private col(x: number) {
    return Math.floor((x + this.w / 2) / this.cell);
  }
  private row(z: number) {
    return Math.floor((z + this.d / 2) / this.cell);
  }
  private centre(c: number, r: number): P {
    return { x: (c + 0.5) * this.cell - this.w / 2, z: (r + 0.5) * this.cell - this.d / 2 };
  }
  private inside(c: number, r: number) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  /** Block the squares under every triangle that reaches between yMin and yMax. */
  markGeometry(g: BufferGeometry, yMin = 0.12, yMax = 1.9) {
    const p = g.getAttribute("position");
    for (let i = 0; i + 2 < p.count; i += 3) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let k = 0; k < 3; k++) {
        const x = p.getX(i + k), y = p.getY(i + k), z = p.getZ(i + k);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      }
      if (y1 < yMin || y0 > yMax) continue;
      this.markBox(x0, z0, x1, z1);
    }
  }

  markBox(x0: number, z0: number, x1: number, z1: number) {
    for (let c = Math.max(0, this.col(x0)); c <= Math.min(this.cols - 1, this.col(x1)); c++)
      for (let r = Math.max(0, this.row(z0)); r <= Math.min(this.rows - 1, this.row(z1)); r++) this.blocked[r * this.cols + c] = 1;
  }

  markCircle(x: number, z: number, radius: number) {
    this.markBox(x - radius, z - radius, x + radius, z + radius);
  }

  /** Grow every blocked area by n squares, so a person's body (not just their centre) keeps clear. */
  grow(n = 1) {
    const src = this.blocked.slice();
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        if (src[r * this.cols + c]) continue;
        for (let dr = -n; dr <= n && !this.blocked[r * this.cols + c]; dr++)
          for (let dc = -n; dc <= n; dc++) {
            const cc = c + dc, rr = r + dr;
            if (this.inside(cc, rr) && src[rr * this.cols + cc]) {
              this.blocked[r * this.cols + c] = 1;
              break;
            }
          }
      }
  }

  free(x: number, z: number) {
    const c = this.col(x), r = this.row(z);
    return this.inside(c, r) && !this.blocked[r * this.cols + c];
  }

  /** The free square nearest a point (the point itself if it is free). */
  nearestFree(x: number, z: number): P | null {
    const c0 = this.col(x), r0 = this.row(z);
    for (let ring = 0; ring < Math.max(this.cols, this.rows); ring++)
      for (let dr = -ring; dr <= ring; dr++)
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const c = c0 + dc, r = r0 + dr;
          if (this.inside(c, r) && !this.blocked[r * this.cols + c]) return ring ? this.centre(c, r) : { x, z };
        }
    return null;
  }

  /** The way from a to b round everything in the way, as points to walk through; [] if there is none. */
  path(a: P, b: P): P[] {
    const start = this.nearestFree(a.x, a.z);
    const goal = this.nearestFree(b.x, b.z);
    if (!start || !goal) return [];
    const sc = this.col(start.x), sr = this.row(start.z), gc = this.col(goal.x), gr = this.row(goal.z);
    const N = this.cols * this.rows;
    const g = new Float32Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    // A binary heap of squares to look at, cheapest first: fast even on a big hall.
    const heap: number[] = [];
    const push = (i: number) => {
      heap.push(i);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (f[heap[p]] <= f[heap[k]]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        k = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1;
          const r = l + 1;
          let m = k;
          if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
          if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top;
    };
    const s = sr * this.cols + sc;
    const t = gr * this.cols + gc;
    const h = (i: number) => Math.hypot((i % this.cols) - gc, Math.floor(i / this.cols) - gr);
    const f = new Float32Array(N).fill(Infinity);
    g[s] = 0;
    f[s] = h(s);
    push(s);
    const closed = new Uint8Array(N);
    while (heap.length) {
      const cur = pop();
      if (closed[cur]) continue;
      if (cur === t) break;
      closed[cur] = 1;
      const cc = cur % this.cols, cr = Math.floor(cur / this.cols);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nc = cc + dc, nr = cr + dr;
        if (!this.inside(nc, nr)) continue;
        const ni = nr * this.cols + nc;
        if (this.blocked[ni] || closed[ni]) continue;
        // No cutting a corner between two blocked squares.
        if (dc && dr && (this.blocked[cr * this.cols + nc] || this.blocked[nr * this.cols + cc])) continue;
        const cost = g[cur] + (dc && dr ? Math.SQRT2 : 1);
        if (cost < g[ni]) {
          g[ni] = cost;
          f[ni] = cost + h(ni);
          from[ni] = cur;
          push(ni);
        }
      }
    }
    if (from[t] === -1 && t !== s) return [];
    const cells: number[] = [];
    for (let i = t; i !== -1; i = from[i]) cells.unshift(i);
    // Keep only the corners, so the walk is smooth rather than square by square.
    const pts = cells.map((i) => this.centre(i % this.cols, Math.floor(i / this.cols)));
    const out: P[] = [];
    for (let i = 1; i < pts.length; i++) {
      const last = i === pts.length - 1;
      if (last || !this.clear(out.length ? out[out.length - 1] : start, pts[i + 1])) out.push(pts[i]);
    }
    if (out.length) out[out.length - 1] = goal;
    return out;
  }

  /** Nothing blocked on the straight line between two points. */
  clear(a: P, b: P): boolean {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (this.cell / 2));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.free(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }
}
