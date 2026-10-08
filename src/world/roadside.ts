// Advertising on the open ground just outside town: the sand on the far side of a main road, where
// nothing is built. Three kinds of spot, all facing the road:
// - billboards, spaced along the roadside, and smart LED screens that play video ads;
// - attention spots, big lit boards where a road leaves town and at the town's corners, which every
//   arriving player drives past;
// - poster grounds, a cleared patch with a hoarding for flyers and civic posters.
// Pure grid maths, so the 2D and 3D maps (and tests) agree on where everything stands.
import { cellAt } from "./town";
import type { Facing, WorldMap } from "./types";

export type RoadsideKind = "billboard" | "square" | "smart" | "tall" | "attention" | "posters";

export interface RoadsideSpot {
  id: string;
  kind: RoadsideKind;
  /** Grid cell. */
  u: number;
  v: number;
  /** The side the road is on, which the spot faces. */
  face: Facing;
}

/** Steps for each Facing: +u, +v, -u, -v. */
const STEP: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const MAIN = new Set(["a"]);
const ROAD = new Set(["a", "r", "t", "b", "i"]);

/** Cells kept clear between any two spots, so boards never crowd each other. */
export const SPOT_GAP = 3;
/** Most of each kind in one town, so a phone isn't asked to draw a forest of boards. */
export const MAX_SPOTS: Record<RoadsideKind, number> = { attention: 8, billboard: 12, square: 6, smart: 6, tall: 6, posters: 8 };
/** Every this many roadside spots, one is a poster ground instead of a billboard. */
const POSTERS_EVERY = 4;

/** Every billboard, attention spot and poster ground outside town, in order round the town. */
export function roadsideSpots(map: WorldMap): RoadsideSpot[] {
  const g = map.grid;
  if (!g) return [];
  const at = (u: number, v: number) => cellAt(g, u, v);

  // Open ground with a main road on exactly one side and more open ground behind it: the outside
  // verge of a road, not a sliver squeezed between two roads.
  const verge: { u: number; v: number; face: Facing }[] = [];
  for (let v = g.v0 - 1; v <= g.v0 + g.rows; v++) {
    for (let u = g.u0 - 1; u <= g.u0 + g.cols; u++) {
      if (at(u, v) !== ".") continue;
      const roads = STEP.map(([du, dv], f) => (MAIN.has(at(u + du, v + dv)) ? f : -1)).filter((f) => f >= 0);
      if (roads.length !== 1) continue;
      const face = roads[0] as Facing;
      const [du, dv] = STEP[face];
      if (at(u - du, v - dv) !== ".") continue;
      verge.push({ u, v, face });
    }
  }
  if (!verge.length) return [];

  // Walk round the town, so kinds alternate evenly along every side.
  const cu = g.u0 + g.cols / 2;
  const cv = g.v0 + g.rows / 2;
  verge.sort((a, b) => Math.atan2(a.v - cv, a.u - cu) - Math.atan2(b.v - cv, b.u - cu) || a.u - b.u || a.v - b.v);

  const taken: { u: number; v: number }[] = [];
  const clear = (s: { u: number; v: number }) => taken.every((t) => Math.max(Math.abs(t.u - s.u), Math.abs(t.v - s.v)) >= SPOT_GAP);
  const count: Record<RoadsideKind, number> = { attention: 0, billboard: 0, square: 0, smart: 0, tall: 0, posters: 0 };
  const out: RoadsideSpot[] = [];
  const add = (s: (typeof verge)[number], kind: RoadsideKind) => {
    taken.push(s);
    count[kind]++;
    out.push({ id: `${kind}-${s.u}_${s.v}`, kind, u: s.u, v: s.v, face: s.face });
  };

  // Attention spots first, so they get the best ground: beside a road that crosses the verge
  // (a road leaving town), or at the end of a straight run of verge (a corner of town).
  for (const s of verge) {
    if (count.attention >= MAX_SPOTS.attention) break;
    if (!clear(s)) continue;
    const [du, dv] = STEP[s.face];
    // Along the road: turn the facing a quarter.
    const sides = [(s.face + 1) % 4, (s.face + 3) % 4].map((f) => STEP[f]);
    const exit = sides.some(([au, av]) => [1, 2].some((k) => ROAD.has(at(s.u + au * k, s.v + av * k))));
    const corner = sides.some(([au, av]) => at(s.u + au, s.v + av) === "." && !MAIN.has(at(s.u + au + du, s.v + av + dv)));
    if (exit || corner) add(s, "attention");
  }

  // Then the boards along every roadside, taking turns: wide, square, wide screen, tall screen; and a poster
  // ground every few spots. Every shape of picture has boards made for it in every town.
  let n = 0;
  const TURNS: RoadsideKind[] = ["billboard", "square", "smart", "tall"];
  let turn = 0;
  const pattern = (i: number): RoadsideKind => (i % POSTERS_EVERY === 0 ? "posters" : TURNS[turn++ % TURNS.length]);
  for (const s of verge) {
    if (!clear(s)) continue;
    const want = pattern(++n);
    // When one kind is used up, the spot goes to whichever kind still has room.
    const kind = ([want, ...TURNS, "posters"] as RoadsideKind[]).find((k) => count[k] < MAX_SPOTS[k]);
    if (!kind) break;
    add(s, kind);
  }
  return out;
}
