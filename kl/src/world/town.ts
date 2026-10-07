// Builds a town on the isometric grid from a TownSpec.
//
// The town is a strip of three districts side by side (rich, mixed centre, poor,
// in an order the seed picks), crossed by long streets. Streets run along the two
// grid directions only, so every corner is square and every junction is a real
// junction. Every other cell is a lot: one plot of land with one building on it,
// facing the street that runs past its front or its back. A road never passes
// under a building and two buildings never share a plot.
import { BIOMES, ROAD_NAMES, type BiomeId } from "../data/biomes";
import { lcg } from "./generate";
import { router } from "./routing";
import type { DistrictId, Facing, MapPlace, MapRoad, Point, RoadClass, TownBuilding, TownGrid, TownLot, WorldMap } from "./types";

/** Half a cell's width and height on screen. A 210 px tile's base fits inside the 240 x 120 diamond. */
export const CELL_HW = 120;
export const CELL_HH = 60;

/** A place to put in town, without its position yet. */
export interface TownPlace extends Omit<MapPlace, "x" | "y"> {
  /** District it belongs in, or "out" for a place on an outskirts road. */
  district: DistrictId | "out";
  /** Preferred spot inside the district: a along the town (0 to 1), c across it (0 to 1). */
  prefer?: { a: number; c: number };
  /** An exact cell to aim for, in a town laid out by regions. */
  cell?: { u: number; v: number };
  /** For "out" places: which outskirts road (index) and how far along it (0 to 1). */
  road?: number;
  along?: number;
  /** Belongs to one citizen (home, work, shelter): placed after the shared layout. */
  personal?: boolean;
}

/** A road leaving town: the entrance, or a highway out to villages. */
export interface Outskirts {
  name: string;
  /** District whose middle cross street the road continues. */
  from: DistrictId;
  /**
   * Which edge it leaves by: top (-v, up and right on screen), bottom (+v),
   * start (-u, up and left) or end (+u, down and right).
   */
  side: "top" | "bottom" | "start" | "end";
  /** Length in cells. */
  length: number;
  highway?: boolean;
  /** Cross street to continue (top or bottom), in a town laid out by regions. */
  atU?: number;
  /** Long street to continue (start or end). */
  atV?: number;
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
  /** Districts along the town, first to last. */
  order: [DistrictId, DistrictId, DistrictId];
  /** Length of each district along the town, in cells. */
  lengths: Record<DistrictId, number>;
  /** Width across the town in cells: 3k + 1 so blocks come out even. */
  width: number;
  names: Record<DistrictId, string>;
  /** A river crossing town between the centre and the next district. */
  river: boolean;
  hills: boolean;
  farmland: boolean;
  /** outskirts[0] is the town entrance, where buses arrive at the motor park. */
  outskirts: Outskirts[];
  places: TownPlace[];
  /** Mean trip, in the prototype's distance units, the town is scaled to. */
  meanTrip: number;
  /** Street names to use, in order. Defaults to the shared list. */
  streetNames?: string[];
  /**
   * A town whose areas are where they really are, instead of three strips. Each
   * anchor claims the cells nearest it, so districts grow round real places.
   * When set, order and lengths only name the districts; size sets the grid.
   */
  regions?: { size: { u: number; v: number }; anchors: { id: DistrictId; u: number; v: number }[] };
  /**
   * Plots to leave between two places (Chebyshev distance). 2 keeps their signs
   * apart; a town that must keep real neighbours side by side can use 1.
   */
  placeGap?: number;
}

/** Cross streets every this many cells, by district. Bigger plots on the rich side. */
const CROSS_EVERY: Record<DistrictId, number> = { rich: 4, mixed: 3, poor: 3 };

/** How full each district's lots are, and with what. */
const FILL: Record<DistrictId | "out", { build: number; kinds: [string, number][] }> = {
  rich: { build: 0.6, kinds: [["duplex", 1]] },
  mixed: { build: 0.85, kinds: [["flats", 0.55], ["house", 0.45]] },
  poor: { build: 0.97, kinds: [["compound", 0.7], ["house", 0.3]] },
  out: { build: 0.25, kinds: [["house", 1]] },
};

const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

interface Cell {
  kind: "road" | "bridge" | "water" | "lot" | "ground";
  district?: DistrictId | "out";
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

export function buildTown(spec: TownSpec): BuiltTown {
  const R = lcg(spec.seed);
  const names = spec.streetNames ?? ROAD_NAMES;
  let nameAt = Math.floor(R() * names.length);
  const nextName = () => names[nameAt++ % names.length];

  // District bands along u, with the river between the centre and the district after it.
  const band: { id: DistrictId; u0: number; u1: number }[] = [];
  let river: { u0: number; u1: number } | null = null;
  let L: number;
  let W = spec.width;
  if (spec.regions) {
    L = spec.regions.size.u;
    W = spec.regions.size.v;
  } else {
    let u = 0;
    spec.order.forEach((id, i) => {
      band.push({ id, u0: u, u1: u + spec.lengths[id] });
      u += spec.lengths[id];
      if (spec.river && id === "mixed" && i < 2) {
        river = { u0: u + 1, u1: u + 3 };
        u += 3;
      }
    });
    if (spec.river && !river) {
      // The centre came last: put the river before it instead.
      const m = band.find((b) => b.id === "mixed")!;
      for (const b of band) if (b.u0 >= m.u0) { b.u0 += 3; b.u1 += 3; }
      river = { u0: m.u0 - 2, u1: m.u0 };
      u += 3;
    }
    L = u; // the last cross street sits at u = L
  }
  const anchors = spec.regions?.anchors ?? [];
  const districtAt = (uu: number, vv = 0): DistrictId | null => {
    if (!anchors.length) return band.find((b) => uu >= b.u0 && uu < b.u1)?.id ?? null;
    let best: DistrictId = "mixed";
    let bestD = Infinity;
    for (const a of anchors) {
      const d = Math.hypot(a.u - uu, a.v - vv);
      if (d < bestD) {
        bestD = d;
        best = a.id;
      }
    }
    return best;
  };

  // Long streets run the length of town at fixed v. The rich side keeps only every
  // other one, so its plots are bigger and its streets quieter.
  const mainV = 3 * Math.floor((W - 1) / 6);
  const longStreet = (vv: number, uu: number): boolean => {
    if (vv === 0 || vv === W - 1 || vv === mainV) return true;
    if (vv % 3 !== 0) return false;
    return anchors.length > 0 || districtAt(uu, vv) !== "rich" || vv % 6 === 0;
  };
  // Cross streets at the start of every district, every few cells inside it, and at the far end.
  const crossU = new Set<number>([L]);
  if (anchors.length) for (let x = 0; x < L; x += 3) crossU.add(x);
  for (const b of band) {
    for (let x = b.u0; x < b.u1 - 1; x += CROSS_EVERY[b.id]) crossU.add(x);
  }
  if (river) {
    // The river banks are streets on both sides.
    const r = river as { u0: number; u1: number };
    crossU.add(r.u0 - 1);
    crossU.add(r.u1);
  }

  // Outskirts roads continue the middle cross street of a district off the town's edge.
  const middleCross = (d: DistrictId) => {
    const b = band.find((x) => x.id === d) ?? { u0: 0, u1: L };
    const inside = [...crossU].filter((x) => x > b.u0 && x < b.u1).sort((a, c) => a - c);
    return inside.length ? inside[Math.floor(inside.length / 2)] : b.u0;
  };
  const outs = spec.outskirts.map((o) => ({ ...o, u: o.atU ?? middleCross(o.from), v: o.atV ?? mainV }));
  const reach = (side: Outskirts["side"]) => Math.max(0, ...outs.filter((o) => o.side === side).map((o) => o.length));
  const vMin = -reach("top") - 1;
  const vMax = W + reach("bottom");
  /** The k-th cell of a road out, counting from the town's edge. */
  const outCell = (o: (typeof outs)[number], k: number) =>
    o.side === "top" ? { u: o.u, v: -k }
    : o.side === "bottom" ? { u: o.u, v: W - 1 + k }
    : o.side === "start" ? { u: -k, v: o.v }
    : { u: L + k, v: o.v };

  // Lay out every cell.
  const u0 = -reach("start") - 2;
  const v0 = vMin - 1;
  const cols = L - u0 + reach("end") + 3;
  const rows = vMax - v0 + 2;
  const cells: Cell[][] = [];
  const at = (uu: number, vv: number): Cell | undefined => cells[vv - v0]?.[uu - u0];
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < cols; c++) row.push({ kind: "ground" });
    cells.push(row);
  }

  const streetName = new Map<string, string>();
  const nameFor = (key: string) => {
    if (!streetName.has(key)) streetName.set(key, nextName());
    return streetName.get(key)!;
  };

  for (let vv = 0; vv < W; vv++) {
    for (let uu = 0; uu <= L; uu++) {
      const cell = at(uu, vv)!;
      const inRiver = river && uu >= (river as { u0: number }).u0 && uu < (river as { u1: number }).u1;
      const isLong = longStreet(vv, Math.min(uu, L - 1)) && uu <= L;
      const isCross = crossU.has(uu);
      if (inRiver) {
        if (isLong) Object.assign(cell, { kind: "bridge", street: nameFor(`v${vv}`), cls: vv === mainV ? "primary" : "secondary" });
        else cell.kind = "water";
        continue;
      }
      if (isLong || isCross) {
        const main = vv === mainV;
        const d = districtAt(Math.min(uu, L - 1), vv);
        Object.assign(cell, {
          kind: "road",
          street: isLong ? nameFor(`v${vv}`) : nameFor(`u${uu}`),
          cls: main ? "primary" : d === "mixed" ? "secondary" : d === "rich" ? "tertiary" : "residential",
        });
        continue;
      }
      if (uu < L) Object.assign(cell, { kind: "lot", district: districtAt(uu, vv) ?? "mixed" });
    }
  }
  // The river runs on past the town at both ends.
  if (river) {
    const r = river as { u0: number; u1: number };
    for (let vv = v0; vv < v0 + rows; vv++) {
      if (vv >= 0 && vv < W) continue;
      for (let uu = r.u0; uu < r.u1; uu++) {
        const c = at(uu, vv);
        if (c) c.kind = "water";
      }
    }
  }
  // Outskirts roads, with a row of lots along each side for roadside villages.
  for (const o of outs) {
    const name = o.name;
    const acrossU = o.side === "top" || o.side === "bottom";
    for (let k = 1; k <= o.length; k++) {
      const p = outCell(o, k);
      const c = at(p.u, p.v);
      if (!c) continue;
      const wet = c.kind === "water";
      Object.assign(c, { kind: wet ? "bridge" : "road", street: name, cls: "trunk", highway: !!o.highway });
      for (const d of [-1, 1]) {
        const side = acrossU ? at(p.u + d, p.v) : at(p.u, p.v + d);
        if (side && side.kind === "ground") Object.assign(side, { kind: "lot", district: "out" });
      }
    }
  }

  const isRoad = (uu: number, vv: number) => {
    const c = at(uu, vv);
    return !!c && (c.kind === "road" || c.kind === "bridge");
  };
  /** The street side of a lot, front sides first so buildings face the viewer where they can. */
  const faceOf = (uu: number, vv: number): Facing | null => {
    for (const f of [0, 1, 2, 3] as Facing[]) if (isRoad(uu + DIRS[f][0], vv + DIRS[f][1])) return f;
    return null;
  };

  const toXY = (uu: number, vv: number): Point => ({ x: (uu - vv) * CELL_HW, y: (uu + vv) * CELL_HH });
  /** Every side of a lot that has a street. */
  const streetSides = (uu: number, vv: number): Facing[] =>
    ([0, 1, 2, 3] as Facing[]).filter((f) => isRoad(uu + DIRS[f][0], vv + DIRS[f][1]));

  // Lots that touch a street can take a building that people visit.
  const frontage: { u: number; v: number; d: DistrictId | "out"; face: Facing }[] = [];
  for (let vv = v0; vv < v0 + rows; vv++) {
    for (let uu = u0; uu < u0 + cols; uu++) {
      const c = at(uu, vv)!;
      if (c.kind !== "lot") continue;
      const face = faceOf(uu, vv);
      if (face !== null) frontage.push({ u: uu, v: vv, d: c.district!, face });
    }
  }

  // Place the places: shared ones from the LGA seed, the citizen's own from theirs.
  const taken = new Map<string, string>();
  const key = (uu: number, vv: number) => `${uu},${vv}`;
  const placeCells: BuiltTown["placeCells"] = {};
  const shared = spec.places.filter((p) => !p.personal);
  const personal = spec.places.filter((p) => p.personal);
  const PR = lcg(spec.personalSeed ?? spec.seed ^ 0x9e3779b9);

  const spotFor = (p: TownPlace, rng: () => number) => {
    let pool = frontage.filter((f) => !taken.has(key(f.u, f.v)));
    if (p.district === "out") {
      const o = outs[p.road ?? 0];
      if (o) {
        const k = Math.max(1, Math.round((p.along ?? 0.5) * o.length));
        const want = outCell(o, k);
        pool = pool.filter((f) => f.d === "out");
        return nearest(pool, want, 0);
      }
    }
    if (p.cell) {
      // A real spot: the nearest free lot anywhere in town, whatever district it falls in.
      const town = pool.filter((f) => f.d !== "out");
      return nearest(town, p.cell, spec.placeGap ?? 2) ?? nearest(town, p.cell, 1);
    }
    const b = band.find((x) => x.id === p.district) ?? { u0: 0, u1: L };
    const want = {
      u: b.u0 + (p.prefer?.a ?? rng()) * (b.u1 - b.u0 - 1),
      v: (p.prefer?.c ?? rng()) * (W - 1),
    };
    const inDistrict = pool.filter((f) => f.d === p.district);
    // Leave a plot between places where we can, so signs and taps do not crowd.
    return nearest(inDistrict, want, 2) ?? nearest(inDistrict, want, 1) ?? nearest(pool.filter((f) => f.d !== "out"), want, 1);
  };

  const nearest = (pool: typeof frontage, want: { u: number; v: number }, gap: number) => {
    let best: (typeof frontage)[number] | null = null;
    let bestD = Infinity;
    for (const f of pool) {
      if (gap > 1 && [...placeSpots()].some((s) => Math.max(Math.abs(s.u - f.u), Math.abs(s.v - f.v)) < gap)) continue;
      const d = Math.hypot(f.u - want.u, f.v - want.v);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  };
  const placeSpots = () => Object.values(placeCells);

  const places: MapPlace[] = [];
  const lots: TownLot[] = [];
  const put = (p: TownPlace, rng: () => number) => {
    const spot = spotFor(p, rng);
    if (!spot) throw new Error(`No room for ${p.id} in ${spec.id}`);
    taken.set(key(spot.u, spot.v), p.id);
    placeCells[p.id] = { u: spot.u, v: spot.v };
    const xy = toXY(spot.u, spot.v);
    const { district, prefer, road, along, cell, personal: _personal, ...rest } = p;
    void district; void prefer; void road; void along; void cell; void _personal;
    const sides = streetSides(spot.u, spot.v);
    const gates = sides.map((f) => toXY(spot.u + DIRS[f][0], spot.v + DIRS[f][1]));
    // You stand on the pavement just outside the main gate.
    const g0 = toXY(spot.u + DIRS[spot.face][0], spot.v + DIRS[spot.face][1]);
    const stand = { x: xy.x + (g0.x - xy.x) * 0.62, y: xy.y + (g0.y - xy.y) * 0.62 };
    places.push({ ...rest, ...xy, gates, stand, ...(flipFor(spot.face) ? { flip: true } : {}) });
    lots.push({ ...xy, district: spot.d, face: spot.face, gates: sides, use: "place" });
  };
  for (const p of shared) put(p, R);
  for (const p of personal) put(p, PR);

  // Ordinary buildings on the remaining lots. Lots with no street get a garden,
  // so no building is ever cut off from the road.
  const buildings: TownBuilding[] = [];
  const FR = lcg(spec.seed ^ 0x51ed27);
  for (let vv = v0; vv < v0 + rows; vv++) {
    for (let uu = u0; uu < u0 + cols; uu++) {
      const c = at(uu, vv)!;
      if (c.kind !== "lot" || taken.has(key(uu, vv))) continue;
      const xy = toXY(uu, vv);
      const face = faceOf(uu, vv);
      const fill = FILL[c.district!];
      if (face === null || FR() > fill.build) {
        lots.push({ ...xy, district: c.district!, face: face ?? 0, gates: streetSides(uu, vv), use: "garden" });
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
      lots.push({ ...xy, district: c.district!, face, gates: streetSides(uu, vv), use: "building" });
    }
  }

  // Streets as polylines through cell centres, one per straight run, so crossing
  // streets share the junction point and the router joins them there.
  const roads: MapRoad[] = [];
  const pushRun = (run: { u: number; v: number }[]) => {
    if (run.length < 2) return;
    const first = at(run[0].u, run[0].v)!;
    const mid = at(run[run.length - 1].u, run[run.length - 1].v)!.highway
      ? at(run[run.length - 1].u, run[run.length - 1].v)!
      : at(run[Math.floor(run.length / 2)].u, run[Math.floor(run.length / 2)].v)!;
    roads.push({
      name: mid.street ?? first.street ?? "",
      cls: mid.cls ?? "secondary",
      ...(mid.highway ? { highway: true } : {}),
      pts: run.map((c) => toXY(c.u, c.v)),
    });
  };
  // A run of road cells becomes one street. Where a town street turns into a
  // highway out of town, the run splits there (sharing the junction point), so
  // the highway keeps its own name and its rules.
  const highwayAt = (uu: number, vv: number) => !!at(uu, vv)?.highway;
  const scan = (cellsInLine: { u: number; v: number }[], next: (c: { u: number; v: number }) => boolean) => {
    let run: { u: number; v: number }[] = [];
    for (const c of cellsInLine) {
      if (!next(c)) {
        pushRun(run);
        run = [];
        continue;
      }
      if (run.length && highwayAt(run[run.length - 1].u, run[run.length - 1].v) !== highwayAt(c.u, c.v)) {
        const joint = run[run.length - 1];
        pushRun(run);
        run = [joint];
      }
      run.push(c);
    }
    pushRun(run);
  };
  // Along u (fixed v): long streets.
  for (let vv = v0; vv < v0 + rows; vv++) {
    const line = Array.from({ length: cols + 1 }, (_, i) => ({ u: u0 + i, v: vv }));
    scan(line, (c) => isRoad(c.u, c.v) && (isRoad(c.u - 1, c.v) || isRoad(c.u + 1, c.v)));
  }
  // Along v (fixed u): cross streets and the outskirts roads.
  for (let uu = u0; uu < u0 + cols; uu++) {
    const line = Array.from({ length: rows + 1 }, (_, i) => ({ u: uu, v: v0 + i }));
    scan(line, (c) => isRoad(c.u, c.v) && (isRoad(c.u, c.v - 1) || isRoad(c.u, c.v + 1)));
  }

  // Traffic lights at the crossroads that carry the most traffic: every one on the
  // main road, and the town centre's.
  const lights: Point[] = [];
  for (let vv = 0; vv < W; vv++) {
    for (let uu = 0; uu <= L; uu++) {
      const c = at(uu, vv);
      if (!c || c.kind !== "road") continue;
      const ways = DIRS.filter(([du, dv]) => isRoad(uu + du, vv + dv)).length;
      if (ways < 4) continue;
      if (vv === mainV || districtAt(Math.min(uu, L - 1), vv) === "mixed") lights.push(toXY(uu, vv));
    }
  }

  // Shift everything so the map starts at a margin.
  const corners = [toXY(u0, v0), toXY(u0 + cols, v0), toXY(u0, v0 + rows), toXY(u0 + cols, v0 + rows)];
  const minX = Math.min(...corners.map((p) => p.x)) - CELL_HW;
  const minY = Math.min(...corners.map((p) => p.y)) - CELL_HH;
  const maxX = Math.max(...corners.map((p) => p.x)) + CELL_HW;
  const maxY = Math.max(...corners.map((p) => p.y)) + CELL_HH * 4;
  const mv = <T extends Point>(p: T): T => ({ ...p, x: p.x - minX, y: p.y - minY });

  const grid: TownGrid = {
    hw: CELL_HW,
    hh: CELL_HH,
    ox: -minX,
    oy: -minY,
    u0,
    v0,
    cols,
    rows,
    cells: cells
      .map((row) =>
        row
          .map((c) => {
            if (c.kind === "road") return "r";
            if (c.kind === "bridge") return "b";
            if (c.kind === "water") return "w";
            if (c.kind === "lot") return c.district === "rich" ? "R" : c.district === "poor" ? "P" : c.district === "out" ? "o" : "M";
            return ".";
          })
          .join(""),
      )
      .join(""),
  };

  // Name each district on the ground: under its strip, or at the middle of its region.
  const districts = band.length
    ? band.map((b) => ({ id: b.id, name: spec.names[b.id], ...mv(toXY((b.u0 + b.u1) / 2, W + 0.6)) }))
    : (["rich", "mixed", "poor"] as DistrictId[]).flatMap((id) => {
        const mine = anchors.filter((a) => a.id === id);
        if (!mine.length) return [];
        const cu = mine.reduce((t, a) => t + a.u, 0) / mine.length;
        const cv = mine.reduce((t, a) => t + a.v, 0) / mine.length;
        return [{ id, name: spec.names[id], ...mv(toXY(cu, cv)) }];
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

/** The ground colour for a district's yards, from the zone's look. */
export function yardColour(biome: BiomeId, d: DistrictId | "out"): string {
  const b = BIOMES[biome];
  if (d === "rich") return "#8DB866";
  if (d === "mixed") return "#D9CDB4";
  if (d === "poor") return b.flat ? "#C9A46A" : "#B98E5E";
  return b.patch;
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
