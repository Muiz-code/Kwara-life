import { describe, expect, it } from "vitest";
import { LGAS } from "../data/geography";
import { STATE } from "../data/states";
import { townFor } from "./load";
import { MAX_SPOTS, roadsideSpots, SPOT_GAP } from "./roadside";
import { cellAt } from "./town";
import type { WorldMap } from "./types";

const STEP: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function mapOf(lgaCode: string): WorldMap {
  const lga = LGAS.find((l) => l.code === lgaCode)!;
  return townFor({
    lgaCode, state: STATE[lga.stateCode], lgaName: lga.name, pu: 0, cls: "poor", job: "Tailor", home: "a room",
    under: false, wasUnder: false, visiting: false, career: "artisan", citizenSeed: "a",
  });
}

describe("roadside advertising", () => {
  const sample = ["kwara/offa", "kano/fagge", "lagos/surulere", "kwara/ilorin-west", "borno/maiduguri"].filter((c) => LGAS.some((l) => l.code === c));

  it.each(sample)("stands every spot on open ground facing a main road in %s", (code) => {
    const map = mapOf(code);
    const g = map.grid!;
    const spots = roadsideSpots(map);
    expect(spots.length).toBeGreaterThan(0);
    for (const s of spots) {
      expect(cellAt(g, s.u, s.v)).toBe(".");
      const [du, dv] = STEP[s.face];
      expect(cellAt(g, s.u + du, s.v + dv)).toBe("a");
    }
  });

  it.each(sample)("spaces spots out, caps each kind and gives every kind a place in %s", (code) => {
    const spots = roadsideSpots(mapOf(code));
    for (const [i, a] of spots.entries())
      for (const b of spots.slice(i + 1)) expect(Math.max(Math.abs(a.u - b.u), Math.abs(a.v - b.v))).toBeGreaterThanOrEqual(SPOT_GAP);
    for (const kind of ["billboard", "square", "smart", "tall", "attention", "posters"] as const) {
      const n = spots.filter((s) => s.kind === kind).length;
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(MAX_SPOTS[kind]);
    }
    expect(new Set(spots.map((s) => s.id)).size).toBe(spots.length);
  });

  it("puts the same boards in the same places for everyone", () => {
    expect(roadsideSpots(mapOf("kano/fagge"))).toEqual(roadsideSpots(mapOf("kano/fagge")));
  });

  it("has nothing to place on a map without a grid", () => {
    expect(roadsideSpots({ ...mapOf("kano/fagge"), grid: undefined })).toEqual([]);
  });
});
