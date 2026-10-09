// The outside of a home you are inspecting: the house itself, the compound round it and what the listing
// promises. The flat inside (home.ts) sits on the same footprint, 12 by 10 with the front door on its -z side,
// so the camera can walk out of the front door into this. Grander homes get more: interlocking tiles, an
// estate security post, two storeys, boys quarters and, for the mansion, the pool.
import type { HouseModel } from "../data/shops";
import type { Kit } from "./kit";

/** Where the camera looks at things outside, for the tour. */
export interface CompoundMarks {
  gen: [number, number, number] | null;
  pool: [number, number, number] | null;
  gate: [number, number, number];
}

const GRASS = "#6E9A4A";
const SAND = "#C9A877";
const TILE = ["#B9A88C", "#A8957A"];

export function buildCompound(kit: Kit, h: HouseModel, opts: { gutter?: boolean } = {}): CompoundMarks {
  const tier = h.tier;
  const storeys = tier >= 3 ? 2 : 1;
  const H = 3.6 * storeys;
  const paint = tier === 4 ? "#F4F1EA" : tier === 3 ? "#EDE3CF" : tier === 2 ? "#E6D3AE" : "#D9C7A3";
  const roof = tier >= 3 ? "#3A4A5C" : "#8C5A3C";

  // The ground: grass all round, the compound inside the fence tiled (or sand where the road is not tarred).
  kit.box(60, 0.1, 60, 0, -0.12, -6, GRASS);
  const yard = tier >= 2;
  for (let x = -14; x < 14; x += 2)
    for (let z = -18; z < 8; z += 2) kit.box(2, 0.08, 2, x + 1, -0.06, z + 1, yard ? TILE[((x + z) / 2) & 1] : SAND);

  // The fence and the gate on the -z side.
  const fence = tier >= 3 ? "#E6E2D8" : "#C9B79A";
  const fh = tier >= 3 ? 2.6 : 2.0;
  kit.box(28, fh, 0.3, 0, 0, 8, fence);
  kit.box(0.3, fh, 26, -14, 0, -5, fence);
  kit.box(0.3, fh, 26, 14, 0, -5, fence);
  kit.box(11, fh, 0.3, -8.5, 0, -18, fence);
  kit.box(11, fh, 0.3, 8.5, 0, -18, fence);
  for (const x of [-3, 3]) kit.box(0.7, fh + 0.5, 0.7, x, 0, -18, fence);
  kit.box(5.4, fh - 0.2, 0.1, 0, 0.1, -18, tier >= 3 ? "#2B2F36" : "#4A6B8A"); // the gate
  for (let i = 0; i < 9; i++) kit.box(0.05, fh - 0.4, 0.14, -2.4 + i * 0.6, 0.2, -18, "#1B1D21");

  // The house: walls, windows, the front door and the roof.
  kit.box(12.4, H, 10.4, 0, 0, 0, paint);
  kit.box(12.6, 0.3, 10.6, 0, 0, 0, "#7A6A58");
  kit.box(1.2, 2.3, 0.1, 1.2, 0, -5.25, "#5A3A22");
  kit.box(2.6, 0.2, 1.6, 1.2, 0, -5.9, "#9C8F7A"); // the step
  for (let s = 0; s < storeys; s++)
    for (const x of [-4.2, -1.6, 3.8]) {
      kit.box(1.6, 1.3, 0.08, x, 1.2 + s * 3.6, -5.22, "#9ED0E6");
      for (let i = 0; i < 5; i++) kit.box(0.05, 1.3, 0.12, x - 0.64 + i * 0.32, 1.2 + s * 3.6, -5.26, "#2B2F36");
    }
  if (storeys > 1) kit.box(4.0, 0.15, 1.6, 1.2, 3.4, -6.0, paint); // a balcony over the door
  kit.hip(13.4, 11.4, 2.4, 0, H, 0, roof);

  // A parking space by the gate, with a car for the grander homes.
  kit.box(5, 0.08, 6, -7.5, -0.03, -12, "#8F877C");
  if (tier >= 3) {
    kit.box(1.9, 0.8, 4.2, -7.5, 0.3, -12, tier === 4 ? "#1B1D21" : "#C9CED3");
    kit.box(1.7, 0.6, 2.2, -7.5, 1.1, -12.2, "#2B3540");
    for (const [x, z] of [[-8.4, -10.6], [-6.6, -10.6], [-8.4, -13.4], [-6.6, -13.4]] as const) kit.cyl(0.35, 0.35, 0.3, x, 0.35, z, "#111", 12, 0, Math.PI / 2);
  }

  // The generator in its own little house, by the right fence.
  let gen: CompoundMarks["gen"] = null;
  if (h.generator) {
    kit.box(3, 2.4, 2.4, 10.5, 0, -10, "#C9B79A");
    kit.gable(3.4, 2.8, 1.0, 10.5, 2.4, -10, "#8C5A3C");
    kit.box(1.8, 1.0, 1.0, 10.5, 0, -11.25, tier >= 3 ? "#2B7FB8" : "#E0A526"); // the generator, out front
    kit.cyl(0.08, 0.08, 1.4, 11.2, 1.0, -11.2, "#5E6B73", 8);
    gen = [10.5, 1, -10.5];
  }

  // Estate security: a post by the gate with the security man's chair.
  if (tier >= 3) {
    kit.box(2.2, 2.6, 2.2, 5.5, 0, -16, "#E6E2D8");
    kit.hip(2.8, 2.8, 0.8, 5.5, 2.6, -16, roof);
    kit.box(1.0, 0.9, 0.06, 5.5, 1.2, -17.12, "#9ED0E6");
  }

  // The mansion: boys quarters at the back left and the pool on the right, with loungers.
  let pool: CompoundMarks["pool"] = null;
  if (tier === 4) {
    kit.box(6, 3.0, 4, -9.5, 0, 4.5, paint);
    kit.hip(6.6, 4.6, 1.4, -9.5, 3.0, 4.5, roof);
    // The deck round the pool, then the water, a little above it so it shows.
    kit.box(7.4, 0.14, 6.4, 10, 0, 1.5, "#F4F1EA");
    kit.box(6.2, 0.06, 5.2, 10, 0.12, 1.5, "#2E8FC0");
    kit.box(5.6, 0.07, 4.6, 10, 0.13, 1.5, "#5CC3E6");
    for (const z of [-1.6, -0.6]) {
      kit.box(0.7, 0.3, 1.8, 7.0 + (z + 1.6) * 1.2, 0, -3.2, "#F4F1EA");
      kit.box(0.7, 0.5, 0.1, 7.0 + (z + 1.6) * 1.2, 0.3, -4.0, "#F4F1EA");
    }
    kit.cyl(0.04, 0.04, 2.2, 9.6, 0, -3.4, "#C9CED3", 6);
    kit.cyl(1.1, 0.1, 0.4, 9.6, 2.2, -3.4, "#C0392B", 10);
    pool = [10, 0, 1.5];
  }

  // Trees and flowers along the fence.
  for (const [x, z] of [[-12, 6], [12, 6], [-12, -15], [12, -15]] as const) {
    kit.cyl(0.18, 0.25, 2.2, x, 0, z, "#6B4A2E", 8);
    kit.ball(1.4, x, 2.8, z, "#3F6B2A", 1.1);
  }
  if (tier >= 2) for (let i = 0; i < 6; i++) kit.ball(0.35, -5 + i * 2, 0.2, -6.6, ["#C0392B", "#F2B705", "#8C2F5A"][i % 3], 0.7);

  // What the agent warned about: the gutter outside the gate, full of nylon and leaves.
  if (opts.gutter) {
    kit.box(14, 0.12, 0.8, 0, -0.04, -19.4, "#3A3A30");
    for (let i = 0; i < 10; i++) kit.ball(0.2, -6 + i * 1.3, 0.05, -19.4, ["#2B7FB8", "#E6E2D8", "#6B4A2E"][i % 3], 0.6);
  }
  return { gen, pool, gate: [0, 1, -18] };
}
