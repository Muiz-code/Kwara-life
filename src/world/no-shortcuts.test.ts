import { describe, expect, it } from "vitest";
import { LGA } from "../data/geography";
import { STATE } from "../data/states";
import { ilorinTown } from "./ilorin-town";
import { townFor } from "./load";
import { router } from "./routing";
import type { WorldMap } from "./types";

/** Every trip stays on the roads: it never goes in one gate of a place and out another on its way. */
function throughBuildings(map: WorldMap): string[] {
  const r = router(map);
  const inside = map.places.filter((p) => p.gates?.length);
  const bad: string[] = [];
  for (const a of map.places)
    for (const b of map.places) {
      if (a.id >= b.id) continue;
      const pts = r.route(a.id, b.id).pts;
      for (const p of inside) {
        if (p.id === a.id || p.id === b.id) continue;
        if (pts.some((q) => q.x === p.x && q.y === p.y)) bad.push(`${a.id} to ${b.id} through ${p.id}`);
      }
    }
  return bad;
}

describe("no short cuts through buildings", () => {
  it("in Ilorin", () => {
    expect(throughBuildings(ilorinTown())).toEqual([]);
  });

  it("in a generated town", () => {
    const l = LGA["lagos/ikeja"];
    const map = townFor({ lgaCode: l.code, state: STATE[l.stateCode], lgaName: l.name, cls: "middle", job: "Tailor" });
    expect(throughBuildings(map)).toEqual([]);
  });
});
