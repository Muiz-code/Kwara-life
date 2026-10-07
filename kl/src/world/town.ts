// Builds a town on the isometric grid from a TownSpec.
//
// A town is a grid of big blocks, each with one use: an estate, schools, mixed
// buildings and offices, commercial, a street of adverts, low-cost housing, a
// slum, a campus, a park. Wide main roads run between the blocks, with a
// roundabout wherever two of them cross. Inside a block, narrow lanes (or, in the
// slum, dirt tracks) give every plot a street. Every building stands on its own
// plot and faces the street that runs past its front or its back; a road never
// passes under a building and two buildings never share a plot.
import { BIOMES, ROAD_NAMES, type BiomeId } from "../data/biomes";
import { lcg } from "./generate";
import { router } from "./routing";
import type {
  DistrictId, Facing, MapPlace, MapRoad, Point, RoadClass, TownBuilding, TownGrid, TownLot, WorldMap, ZoneKind,
} from "./types";

/** Half a cell's width and height on screen. A 210 px tile's base fits inside the 240 x 120 diamond. */
export const CELL_HW = 120;
export const CELL_HH = 60;

/** One big block of the town and what it is for. */
export interface Zone {
  kind: ZoneKind;
  /** Block column (along u) and row (along v), and how many it spans. */
  col: number;
  row: number;
  cols?: number;
  rows?: number;
  /** What people call it, written on the map when zoomed out. */
  name: string;
}

/** A place to put in town, without its position yet. */
export interface TownPlace extends Omit<MapPlace, "x" | "y"> {
  /** Index of the zone it belongs in, or "out" for a place on a road out of town. */
  zone: number | "out";
  /** Preferred spot inside the block: a along u (0 to 1), c along v (0 to 1). */
  prefer?: { a: number; c: number };
  /** For "out" places: which outskirts road (index) and how far along it (0 to 1). */
  road?: number;
  along?: number;
  /** Belongs to one citizen (home, work, shelter): placed after the shared layout. */
  personal?: boolean;
}

/** A road leaving town: the entrance, or a highway out to villages. */
export interface Outskirts {
  name: string;
  /**
   * Which edge it leaves by: top (-v, up and right on screen), bottom (+v),
   * start (-u, up and left) or end (+u, down and right).
   */
  side: "top" | "bottom" | "start" | "end";
  /** Which main road it continues: the index of the boundary between blocks (0 is the town's edge). */
  at: number;
  /** Length in cells. */
  length: number;
  highway?: boolean;
}

export interface TownSpec {
  id: string;
  name: string;
  biome: BiomeId;
  /** State code, for the landmark tile. */
  state: string;
  /** Seed for the shared layout: the same for everyone in the LGA. */
  seed: number;
  /** Seed for the citizen's own places. */
  personalSeed?: number;
  /** Width of each column of blocks (cells along u) and height of each row (cells along v). */
  colSizes: number[];
  rowSizes: number[];
  zones: Zone[];
  /** A river crossing town after this column of blocks. */
  riverAfterCol?: number;
  hills: boolean;
  farmland: boolean;
  /** outskirts[0] is the town entrance, where buses arrive at the motor park. */
  outskirts: Outskirts[];
  places: TownPlace[];
  /** Mean trip, in the prototype's distance units, the town is scaled to. */
  meanTrip: number;
  /** Street names to use, in order. Defaults to the shared list. */
  streetNames?: string[];
  /** Plots to leave between two places (Chebyshev distance). 1 lets places stand side by side. */
  placeGap?: number;
}

/** Which of the three districts each kind of block counts as, for homes and names. */
export const ZONE_DISTRICT: Record<ZoneKind, DistrictId> = {
  estate: "rich", lowcost: "poor", slum: "poor", schools: "mixed", mixed: "mixed", commercial: "mixed",
  ads: "mixed", civic: "mixed", campus: "mixed", airport: "mixed", park: "mixed",
};

/** One letter per kind of plot in the grid string. */
export const ZONE_CODE: Record<ZoneKind | "out", string> = {
  estate: "E", lowcost: "L", slum: "Z", schools: "S", mixed: "M", commercial: "C", ads: "D", civic: "V",
  campus: "U", airport: "A", park: "G", out: "o",
};
const CODE_ZONE = Object.fromEntries(Object.entries(ZONE_CODE).map(([k, v]) => [v, k])) as Record<string, ZoneKind | "out">;
export const zoneOfCode = (c: string): ZoneKind | "out" | undefined => CODE_ZONE[c];

/**
 * How a block is cut up inside: lanes every so many cells (0 for one big compound
 * with no lanes), and the lane kind.
 */
const INSIDE: Record<ZoneKind, { every: number; lane: "lane" | "track" | null }> = {
  estate: { every: 4, lane: "lane" },
  lowcost: { every: 3, lane: "lane" },
  slum: { every: 3, lane: "track" },
  schools: { every: 0, lane: null },
  mixed: { every: 3, lane: "lane" },
  commercial: { every: 3, lane: "lane" },
  ads: { every: 3, lane: "lane" },
  civic: { every: 3, lane: "lane" },
  campus: { every: 0, lane: null },
  airport: { every: 0, lane: null },
  park: { every: 0, lane: null },
};

/** How full each kind of block's plots are, and with what. */
const FILL: Record<ZoneKind | "out", { build: number; kinds: [string, number][] }> = {
  estate: { build: 0.62, kinds: [["duplex", 1]] },
  lowcost: { build: 0.95, kinds: [["compound", 0.65], ["house", 0.35]] },
  slum: { build: 1, kinds: [["shacks", 1]] },
  schools: { build: 0.45, kinds: [["school", 1]] },
  mixed: { build: 0.88, kinds: [["flats", 0.5], ["office", 0.25], ["house", 0.25]] },
  commercial: { build: 0.95, kinds: [["flats", 0.45], ["market", 0.25], ["buka", 0.15], ["house", 0.15]] },
  ads: { build: 0.7, kinds: [["flats", 0.5], ["office", 0.3], ["buka", 0.2]] },
  civic: { build: 0.85, kinds: [["office", 0.45], ["flats", 0.35], ["house", 0.2]] },
  campus: { build: 0.35, kinds: [["flats", 1]] },
  airport: { build: 0, kinds: [["house", 1]] },
  park: { build: 0, kinds: [["house", 1]] },
  out: { build: 0.25, kinds: [["house", 1]] },
};

const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

type CellKind = "main" | "lane" | "track" | "bridge" | "island" | "water" | "lot" | "ground";

interface Cell {
  kind: CellKind;
  zone?: ZoneKind | "out";
  zoneIndex?: number;
  /** Street the road cell belongs to, for naming. */
  street?: string;
  cls?: RoadClass;
  highway?: boolean;
}

export interface BuiltTown {
  map: WorldMap;
  /** Cell of every place, for tests. */
  placeCells: Record<string, { u: number; v: number }>;
}

const ROADLIKE = new Set<CellKind>(["main", "lane", "track", "bridge"]);

export function buildTown(spec: TownSpec): BuiltTown {
  const R = lcg(spec.seed);
  const names = spec.streetNames ?? ROAD_NAMES;
  let nameAt = Math.floor(R() * names.length);
  const nextName = () => names[nameAt++ % names.length];

  // Main roads sit on the boundaries between blocks: one cell wide, at bu[i]
  // along u and bv[j] along v. A river after a column adds two cells of water and
  // a road on the far bank.
  const bu: number[] = [0];
  const water: [number, number][] = [];
  spec.colSizes.forEach((s, i) => {
    let next = bu[bu.length - 1] + s + 1;
    if (spec.riverAfterCol === i && i < spec.colSizes.length - 1) {
      water.push([next + 1, next + 3]);
      bu.push(next);
      next += 3;
    }
    bu.push(next);
  });
  const bv: number[] = [0];
  for (const s of spec.rowSizes) bv.push(bv[bv.length - 1] + s + 1);
  const L = bu[bu.length - 1];
  const H = bv[bv.length - 1];
  // A block's first interior cell along u, per column (skipping the river's bank road).
  const colStart: number[] = [];
  {
    let k = 0;
    spec.colSizes.forEach((_, i) => {
      colStart.push(bu[k] + 1);
      k += spec.riverAfterCol === i && i < spec.colSizes.length - 1 ? 2 : 1;
    });
  }
  const rowStart = spec.rowSizes.map((_, j) => bv[j] + 1);
  const inWater = (u: number) => water.some(([a, b]) => u >= a && u < b);

  const outs = spec.outskirts.map((o) => ({
    ...o,
    line: o.side === "top" || o.side === "bottom" ? bu[Math.min(o.at, bu.length - 1)] : bv[Math.min(o.at, bv.length - 1)],
  }));
  const reach = (side: Outskirts["side"]) => Math.max(0, ...outs.filter((o) => o.side === side).map((o) => o.length));
  const outCell = (o: (typeof outs)[number], k: number) =>
    o.side === "top" ? { u: o.line, v: -k }
    : o.side === "bottom" ? { u: o.line, v: H + k }
    : o.side === "start" ? { u: -k, v: o.line }
    : { u: L + k, v: o.line };

  const u0 = -reach("start") - 3;
  const v0 = -reach("top") - 3;
  const cols = L - u0 + reach("end") + 4;
  const rows = H - v0 + reach("bottom") + 4;
  const cells: Cell[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ kind: "ground" as CellKind })));
  const at = (u: number, v: number): Cell | undefined => cells[v - v0]?.[u - u0];

  const streetName = new Map<string, string>();
  const nameFor = (key: string) => {
    if (!streetName.has(key)) streetName.set(key, nextName());
    return streetName.get(key)!;
  };

  // The blocks, and what each cell inside them is.
  spec.zones.forEach((z, zi) => {
    const cu0 = colStart[z.col];
    const cv0 = rowStart[z.row];
    const lastCol = z.col + (z.cols ?? 1) - 1;
    const lastRow = z.row + (z.rows ?? 1) - 1;
    const cu1 = colStart[lastCol] + spec.colSizes[lastCol];
    const cv1 = rowStart[lastRow] + spec.rowSizes[lastRow];
    const inside = INSIDE[z.kind];
    // Lanes run every few cells, but never right beside a main road.
    const laneAt = (i: number, size: number) => inside.every > 0 && i % inside.every === inside.every - 1 && i < size - 2;
    for (let v = cv0; v < cv1; v++) {
      for (let u = cu0; u < cu1; u++) {
        const c = at(u, v)!;
        // A spanning block swallows the main road between its parts.
        const lane = laneAt(u - cu0, cu1 - cu0) || laneAt(v - cv0, cv1 - cv0);
        if (lane && inside.lane) {
          Object.assign(c, {
            kind: inside.lane,
            zone: z.kind,
            zoneIndex: zi,
            street: nameFor(laneAt(u - cu0, cu1 - cu0) ? `lane-u${u}-${zi}` : `lane-v${v}-${zi}`),
            cls: inside.lane === "track" ? "residential" : "tertiary",
          });
        } else Object.assign(c, { kind: "lot", zone: z.kind, zoneIndex: zi });
      }
    }
  });

  // Main roads round every block.
  for (let v = 0; v <= H; v++) {
    for (let u = 0; u <= L; u++) {
      const onU = bu.includes(u);
      const onV = bv.includes(v);
      if (!onU && !onV) continue;
      const c = at(u, v)!;
      if (c.kind === "lot" && c.zone && !onU !== !onV) {
        // Inside a spanning block, the boundary is part of the block, not a road.
        const z = spec.zones[c.zoneIndex!];
        if ((z.cols ?? 1) > 1 || (z.rows ?? 1) > 1) continue;
      }
      if (inWater(u)) {
        if (onV) Object.assign(c, { kind: "bridge", street: nameFor(`v${v}`), cls: "primary" });
        else c.kind = "water";
        continue;
      }
      Object.assign(c, {
        kind: "main",
        street: onV ? nameFor(`v${v}`) : nameFor(`u${u}`),
        cls: "primary",
      });
    }
  }
  // Water fills the river band from edge to edge.
  for (const [a, b] of water) {
    for (let v = v0; v < v0 + rows; v++) {
      for (let u = a; u < b; u++) {
        const c = at(u, v)!;
        if (c.kind !== "bridge") c.kind = "water";
      }
    }
  }

  // Roundabouts where main roads cross inside town: the crossing becomes an
  // island and the eight cells round it the ring.
  const roundabouts: Point[] = [];
  for (const u of bu.slice(1, -1)) {
    for (const v of bv.slice(1, -1)) {
      if (inWater(u)) continue;
      const ring = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
      if (!DIRS.every(([du, dv]) => at(u + du * 2, v + dv * 2)?.kind === "main")) continue;
      for (const [du, dv] of ring) Object.assign(at(u + du, v + dv)!, { kind: "main", cls: "primary", street: "Roundabout" });
      Object.assign(at(u, v)!, { kind: "island", street: undefined });
      roundabouts.push({ x: u, y: v });
    }
  }

  // Roads out of town, with a row of plots along each side for roadside villages.
  for (const o of outs) {
    const acrossU = o.side === "top" || o.side === "bottom";
    for (let k = 1; k <= o.length; k++) {
      const p = outCell(o, k);
      const c = at(p.u, p.v);
      if (!c) continue;
      const wet = c.kind === "water";
      Object.assign(c, { kind: wet ? "bridge" : "main", street: o.name, cls: "trunk", highway: !!o.highway });
      for (const d of [-1, 1]) {
        const side = acrossU ? at(p.u + d, p.v) : at(p.u, p.v + d);
        if (side && side.kind === "ground") Object.assign(side, { kind: "lot", zone: "out" });
      }
    }
  }

  const isRoad = (u: number, v: number) => ROADLIKE.has(at(u, v)?.kind ?? "ground");
  const faceOf = (u: number, v: number): Facing | null => {
    for (const f of [0, 1, 2, 3] as Facing[]) if (isRoad(u + DIRS[f][0], v + DIRS[f][1])) return f;
    return null;
  };
  const streetSides = (u: number, v: number): Facing[] => ([0, 1, 2, 3] as Facing[]).filter((f) => isRoad(u + DIRS[f][0], v + DIRS[f][1]));
  const toXY = (u: number, v: number): Point => ({ x: (u - v) * CELL_HW, y: (u + v) * CELL_HH });

  // Plots that touch a street can take a place.
  const frontage: { u: number; v: number; z: number | "out"; face: Facing }[] = [];
  for (let v = v0; v < v0 + rows; v++) {
    for (let u = u0; u < u0 + cols; u++) {
      const c = at(u, v)!;
      if (c.kind !== "lot") continue;
      const face = faceOf(u, v);
      if (face !== null) frontage.push({ u, v, z: c.zone === "out" ? "out" : c.zoneIndex!, face });
    }
  }

  const taken = new Map<string, string>();
  const key = (u: number, v: number) => `${u},${v}`;
  const placeCells: BuiltTown["placeCells"] = {};
  const gap = spec.placeGap ?? 1;

  const nearest = (pool: typeof frontage, want: { u: number; v: number }, minGap: number) => {
    let best: (typeof frontage)[number] | null = null;
    let bestD = Infinity;
    const spots = Object.values(placeCells);
    for (const f of pool) {
      if (minGap > 1 && spots.some((s) => Math.max(Math.abs(s.u - f.u), Math.abs(s.v - f.v)) < minGap)) continue;
      const d = Math.hypot(f.u - want.u, f.v - want.v);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  };

  const spotFor = (p: TownPlace, rng: () => number) => {
    const free = frontage.filter((f) => !taken.has(key(f.u, f.v)));
    if (p.zone === "out") {
      const o = outs[p.road ?? 0];
      if (!o) return null;
      const k = Math.max(1, Math.round((p.along ?? 0.5) * o.length));
      return nearest(free.filter((f) => f.z === "out"), outCell(o, k), 1);
    }
    const z = spec.zones[p.zone];
    const cu0 = colStart[z.col];
    const cv0 = rowStart[z.row];
    const lastCol = z.col + (z.cols ?? 1) - 1;
    const lastRow = z.row + (z.rows ?? 1) - 1;
    const cu1 = colStart[lastCol] + spec.colSizes[lastCol];
    const cv1 = rowStart[lastRow] + spec.rowSizes[lastRow];
    const want = {
      u: cu0 + (p.prefer?.a ?? rng()) * (cu1 - cu0 - 1),
      v: cv0 + (p.prefer?.c ?? rng()) * (cv1 - cv0 - 1),
    };
    const inZone = free.filter((f) => f.z === p.zone);
    return nearest(inZone, want, gap) ?? nearest(inZone, want, 1) ?? nearest(free.filter((f) => f.z !== "out"), want, 1);
  };

  const places: MapPlace[] = [];
  const lots: TownLot[] = [];
  const put = (p: TownPlace, rng: () => number) => {
    const spot = spotFor(p, rng);
    if (!spot) throw new Error(`No room for ${p.id} in ${spec.id}`);
    taken.set(key(spot.u, spot.v), p.id);
    placeCells[p.id] = { u: spot.u, v: spot.v };
    const xy = toXY(spot.u, spot.v);
    const { zone, prefer, road, along, personal: _personal, ...rest } = p;
    void zone; void prefer; void road; void along; void _personal;
    const sides = streetSides(spot.u, spot.v);
    const gates = sides.map((f) => toXY(spot.u + DIRS[f][0], spot.v + DIRS[f][1]));
    // You stand on the pavement just outside the main gate.
    const g0 = toXY(spot.u + DIRS[spot.face][0], spot.v + DIRS[spot.face][1]);
    const stand = { x: xy.x + (g0.x - xy.x) * 0.62, y: xy.y + (g0.y - xy.y) * 0.62 };
    places.push({ ...rest, ...xy, gates, stand, ...(flipFor(spot.face) ? { flip: true } : {}) });
    const zk = at(spot.u, spot.v)!.zone!;
    lots.push({ ...xy, district: zk === "out" ? "out" : ZONE_DISTRICT[zk], zone: zk, face: spot.face, gates: sides, use: "place" });
  };
  const PR = lcg(spec.personalSeed ?? spec.seed ^ 0x9e3779b9);
  for (const p of spec.places.filter((x) => !x.personal)) put(p, R);
  for (const p of spec.places.filter((x) => x.personal)) put(p, PR);

  // Ordinary buildings on the remaining plots. A plot with no street becomes a
  // garden (or, in a school, the playing field), so no building is ever cut off.
  const buildings: TownBuilding[] = [];
  const FR = lcg(spec.seed ^ 0x51ed27);
  for (let v = v0; v < v0 + rows; v++) {
    for (let u = u0; u < u0 + cols; u++) {
      const c = at(u, v)!;
      if (c.kind !== "lot" || taken.has(key(u, v))) continue;
      const xy = toXY(u, v);
      const face = faceOf(u, v);
      const zk = c.zone!;
      const district = zk === "out" ? "out" : ZONE_DISTRICT[zk];
      const fill = FILL[zk];
      if (face === null || FR() > fill.build) {
        const use = zk === "schools" || zk === "campus" ? "field" : zk === "airport" ? "apron" : "garden";
        lots.push({ ...xy, district, zone: zk, face: face ?? 0, gates: streetSides(u, v), use });
        continue;
      }
      let roll = FR();
      let kind = fill.kinds[0][0];
      for (const [k, w] of fill.kinds) {
        if (roll < w) {
          kind = k;
          break;
        }
        roll -= w;
      }
      buildings.push({ ...xy, kind, ...(flipFor(face) ? { flip: true } : {}) });
      lots.push({ ...xy, district, zone: zk, face, gates: streetSides(u, v), use: "building" });
    }
  }

  // Streets as polylines through cell centres, one per straight run, so crossing
  // streets share the junction point and the router joins them there.
  const roads: MapRoad[] = [];
  const pushRun = (run: { u: number; v: number }[]) => {
    if (run.length < 2) return;
    const last = at(run[run.length - 1].u, run[run.length - 1].v)!;
    const mid = last.highway ? last : at(run[Math.floor(run.length / 2)].u, run[Math.floor(run.length / 2)].v)!;
    roads.push({
      name: mid.street ?? "",
      cls: mid.cls ?? "secondary",
      ...(mid.highway ? { highway: true } : {}),
      pts: run.map((c) => toXY(c.u, c.v)),
    });
  };
  // Runs split where a town street becomes a highway, or a main road meets a lane,
  // sharing the joint so the router still joins them.
  const sortOf = (u: number, v: number) => {
    const c = at(u, v);
    return `${c?.highway ? "h" : ""}${c?.kind === "lane" || c?.kind === "track" ? "l" : "m"}`;
  };
  const scan = (line: { u: number; v: number }[], next: (c: { u: number; v: number }) => boolean) => {
    let run: { u: number; v: number }[] = [];
    for (const c of line) {
      if (!next(c)) {
        pushRun(run);
        run = [];
        continue;
      }
      if (run.length && sortOf(run[run.length - 1].u, run[run.length - 1].v) !== sortOf(c.u, c.v)) {
        const joint = run[run.length - 1];
        pushRun(run);
        run = [joint];
      }
      run.push(c);
    }
    pushRun(run);
  };
  for (let v = v0; v < v0 + rows; v++) {
    scan(Array.from({ length: cols + 1 }, (_, i) => ({ u: u0 + i, v })), (c) => isRoad(c.u, c.v) && (isRoad(c.u - 1, c.v) || isRoad(c.u + 1, c.v)));
  }
  for (let u = u0; u < u0 + cols; u++) {
    scan(Array.from({ length: rows + 1 }, (_, i) => ({ u, v: v0 + i })), (c) => isRoad(c.u, c.v) && (isRoad(c.u, c.v - 1) || isRoad(c.u, c.v + 1)));
  }

  // Traffic lights where a lane crosses a main road in the busy blocks.
  const BUSY = new Set<ZoneKind | "out" | undefined>(["commercial", "ads", "mixed", "civic"]);
  const lights: Point[] = [];
  for (let v = 0; v <= H; v++) {
    for (let u = 0; u <= L; u++) {
      const c = at(u, v);
      if (!c || c.kind !== "main") continue;
      if (DIRS.filter(([du, dv]) => isRoad(u + du, v + dv)).length < 4) continue;
      const lanes = DIRS.map(([du, dv]) => at(u + du, v + dv)).filter((n) => n?.kind === "lane");
      if (lanes.length && lanes.some((n) => BUSY.has(n!.zone))) lights.push(toXY(u, v));
    }
  }

  // Bus stops along the main roads: every few cells, on the kerb beside a plot.
  const stops: { x: number; y: number; face: Facing }[] = [];
  let since = 3;
  for (let v = 0; v <= H; v++) {
    for (let u = 0; u <= L; u++) {
      const c = at(u, v);
      if (!c || c.kind !== "main" || c.street === "Roundabout") continue;
      since++;
      if (since < 6) continue;
      const side = ([0, 1, 2, 3] as Facing[]).find((f) => at(u + DIRS[f][0], v + DIRS[f][1])?.kind === "lot");
      const straight = (isRoad(u - 1, v) && isRoad(u + 1, v)) !== (isRoad(u, v - 1) && isRoad(u, v + 1));
      if (side === undefined || !straight) continue;
      stops.push({ ...toXY(u, v), face: side });
      since = 0;
    }
  }

  // Shift everything so the map starts at a margin.
  const corners = [toXY(u0, v0), toXY(u0 + cols, v0), toXY(u0, v0 + rows), toXY(u0 + cols, v0 + rows)];
  const minX = Math.min(...corners.map((p) => p.x)) - CELL_HW;
  const minY = Math.min(...corners.map((p) => p.y)) - CELL_HH;
  const maxX = Math.max(...corners.map((p) => p.x)) + CELL_HW;
  const maxY = Math.max(...corners.map((p) => p.y)) + CELL_HH * 4;
  const mv = <T extends Point>(p: T): T => ({ ...p, x: p.x - minX, y: p.y - minY });

  const code = (c: Cell): string => {
    switch (c.kind) {
      case "main": return "a";
      case "lane": return "r";
      case "track": return "t";
      case "bridge": return "b";
      case "island": return "i";
      case "water": return "w";
      case "lot": return ZONE_CODE[c.zone ?? "mixed"];
      default: return ".";
    }
  };
  const grid: TownGrid = {
    hw: CELL_HW, hh: CELL_HH, ox: -minX, oy: -minY, u0, v0, cols, rows,
    cells: cells.map((row) => row.map(code).join("")).join(""),
  };

  // Each block's outline, for drawing a campus, park or airfield as one piece of ground.
  const blocks = spec.zones.map((z) => {
    const lastCol = z.col + (z.cols ?? 1) - 1;
    const lastRow = z.row + (z.rows ?? 1) - 1;
    const a = colStart[z.col];
    const b = colStart[lastCol] + spec.colSizes[lastCol] - 1;
    const c = rowStart[z.row];
    const d = rowStart[lastRow] + spec.rowSizes[lastRow] - 1;
    const t = toXY(a, c);
    const r = toXY(b, c);
    const bo = toXY(b, d);
    const l = toXY(a, d);
    return {
      zone: z.kind,
      corners: [
        mv({ x: t.x, y: t.y - CELL_HH }), mv({ x: r.x + CELL_HW, y: r.y }),
        mv({ x: bo.x, y: bo.y + CELL_HH }), mv({ x: l.x - CELL_HW, y: l.y }),
      ],
    };
  });

  // Each block's name, at its middle.
  const districts = spec.zones.map((z) => {
    const lastCol = z.col + (z.cols ?? 1) - 1;
    const lastRow = z.row + (z.rows ?? 1) - 1;
    const cu = (colStart[z.col] + colStart[lastCol] + spec.colSizes[lastCol]) / 2;
    const cv = (rowStart[z.row] + rowStart[lastRow] + spec.rowSizes[lastRow]) / 2;
    return { id: ZONE_DISTRICT[z.kind], zone: z.kind, name: z.name, ...mv(toXY(cu - 0.5, cv - 0.5)) };
  });

  let map: WorldMap = {
    id: spec.id,
    name: spec.name,
    biome: spec.biome,
    state: spec.state,
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
    places: places.map((p) => ({ ...mv(p), ...(p.gates ? { gates: p.gates.map(mv) } : {}), ...(p.stand ? { stand: mv(p.stand) } : {}) })),
    lights: lights.map(mv),
    roundabouts: roundabouts.map((r) => mv(toXY(r.x, r.y))),
    blocks,
    stops: stops.map(mv),
    scenery: { farmland: spec.farmland, hills: spec.hills },
    roads: roads.map((r) => ({ ...r, pts: r.pts.map(mv) })),
    buildings: buildings.map(mv),
    lots: lots.map(mv),
    districts,
    grid,
    source: "generated",
    start: places.find((p) => p.id === "home")?.id ?? places.find((p) => p.id === "park")?.id ?? places[0]?.id,
  };

  // Scale trips so a typical one costs what it costs in the prototype.
  const mean = meanTrip(map);
  map = { ...map, lengthScale: mean ? spec.meanTrip / mean : 1 };
  return { map, placeCells };
}

/** Tiles face down and to the left; mirror one whose street is down and to the right. */
const flipFor = (f: Facing) => f === 0 || f === 3;

/** Mean route length over every pair of places, unscaled. */
function meanTrip(map: WorldMap): number {
  const r = router({ ...map, lengthScale: 1 });
  let t = 0;
  let n = 0;
  for (let i = 0; i < map.places.length; i++) {
    for (let j = i + 1; j < map.places.length; j++) {
      t += r.route(map.places[i].id, map.places[j].id).length;
      n++;
    }
  }
  return n ? t / n : 0;
}

/** The ground colour of a plot, by what kind of block it is in and the zone's look. */
export function yardColour(biome: BiomeId, zone: ZoneKind | "out" | undefined): string {
  const b = BIOMES[biome];
  switch (zone) {
    case "estate": return "#8DB866";
    case "park": return "#7FAF5A";
    case "schools":
    case "campus": return "#A3C47A";
    case "airport": return "#B8B5AC";
    case "commercial":
    case "ads": return "#D6CCBC";
    case "mixed":
    case "civic": return "#DDD3C0";
    case "lowcost": return b.flat ? "#C9A46A" : "#B98E5E";
    case "slum": return b.flat ? "#B58D57" : "#9C6E48";
    default: return b.patch;
  }
}

/** The centre of a grid cell, in map pixels. */
export const cellCentre = (g: TownGrid, u: number, v: number): Point => ({
  x: g.ox + (u - v) * g.hw,
  y: g.oy + (u + v) * g.hh,
});

/** The character for one cell, or "." outside the grid. */
export function cellAt(g: TownGrid, u: number, v: number): string {
  const c = u - g.u0;
  const r = v - g.v0;
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return ".";
  return g.cells[r * g.cols + c];
}

/** Road cells in the grid string: main roads, lanes, dirt tracks and bridges. */
export const ROAD_CODES = new Set(["a", "r", "t", "b"]);
/** Plot cells: one capital letter per kind of block, and "o" out of town. */
export const isLotCode = (c: string) => c === "o" || (c >= "A" && c <= "Z");
