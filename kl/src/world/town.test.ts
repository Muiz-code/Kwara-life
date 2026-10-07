import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LGAS } from "../data/geography";
import { PLACES } from "../data/ilorin/places";
import { lgaPlaces } from "../data/lga";
import { STATES } from "../data/states";
import { route as oldRoute } from "../sim/world";
import { MODES } from "../sim/travel";
import { ilorinTown } from "./ilorin-town";
import { router } from "./routing";
import { allTiles } from "./tile-art";
import { buildTown, cellAt, type BuiltTown } from "./town";
import { PROTOTYPE_MEAN_TRIP, townSpecFor, type TownRequest } from "./town-spec";
import type { WorldMap } from "./types";

const state = (code: string) => STATES.find((s) => s.code === code)!;
const lgaOf = (code: string) => LGAS.find((l) => l.code === code)!;

function town(lgaCode: string, ctx: Partial<TownRequest["ctx"]> = {}, citizenSeed = "a"): BuiltTown {
  const lga = lgaOf(lgaCode);
  return buildTown(
    townSpecFor({
      lgaCode,
      state: state(lga.stateCode),
      lgaName: lga.name,
      ctx: { cls: "poor", job: "Tailor", home: "a room", underFlyover: false, ...ctx },
      citizenSeed,
    }),
  );
}

/** The grid cell a point on the map sits in. */
function cellOf(map: WorldMap, x: number, y: number): { u: number; v: number } {
  const g = map.grid!;
  const X = (x - g.ox) / g.hw;
  const Y = (y - g.oy) / g.hh;
  return { u: Math.round((X + Y) / 2), v: Math.round((Y - X) / 2) };
}

const LOT = new Set(["R", "M", "P", "o"]);
const ROAD = new Set(["r", "b"]);

function checkPlots(map: WorldMap) {
  const g = map.grid!;
  const used = new Set<string>();
  for (const b of [...map.places, ...(map.buildings ?? [])]) {
    const c = cellOf(map, b.x, b.y);
    // On a plot, never on a road, on water or out in the bush.
    expect(LOT.has(cellAt(g, c.u, c.v))).toBe(true);
    // One building per plot.
    const k = `${c.u},${c.v}`;
    expect(used.has(k)).toBe(false);
    used.add(k);
  }
  for (const p of map.places) {
    // Every place has a gate, and every gate opens onto a street next to its plot.
    expect(p.gates?.length).toBeGreaterThan(0);
    const c = cellOf(map, p.x, p.y);
    for (const gt of p.gates!) {
      const gc = cellOf(map, gt.x, gt.y);
      expect(ROAD.has(cellAt(g, gc.u, gc.v))).toBe(true);
      expect(Math.abs(gc.u - c.u) + Math.abs(gc.v - c.v)).toBe(1);
    }
  }
}

describe("a town", () => {
  const kano = town("kano/fagge");

  it("never puts a building on a road, and gives every building its own plot", () => {
    checkPlots(kano.map);
  });

  it("has exactly the LGA's places", () => {
    const want = lgaPlaces({ state: state("kano"), lgaName: "Fagge", cls: "poor", job: "Tailor", home: "a room", underFlyover: false });
    expect(kano.map.places.map((p) => p.id).sort()).toEqual(want.map((p) => p.id).sort());
  });

  it("is the same for everyone in the LGA, and different in the next one", () => {
    const rich = town("kano/fagge", { cls: "rich", job: "Contractor" }, "someone else");
    for (const id of ["market", "inec", "pu", "park", "mosque", "church", "hall", "landmark", "hotel"]) {
      expect(rich.placeCells[id]).toEqual(kano.placeCells[id]);
    }
    const other = town("kano/nassarawa");
    expect(JSON.stringify(other.placeCells)).not.toEqual(JSON.stringify(kano.placeCells));
  });

  it("puts each class's home in its own district", () => {
    const districtOf = (t: BuiltTown, id: string) => {
      const c = t.placeCells[id];
      return cellAt(t.map.grid!, c.u, c.v);
    };
    expect(districtOf(kano, "home")).toBe("P");
    expect(districtOf(town("kano/fagge", { cls: "middle", job: "Teacher" }), "home")).toBe("M");
    expect(districtOf(town("kano/fagge", { cls: "rich", job: "Contractor" }), "home")).toBe("R");
    expect(districtOf(kano, "market")).toBe("M");
    expect(districtOf(kano, "hotel")).toBe("R");
    expect(districtOf(kano, "buka")).toBe("P");
  });

  it("puts the motor park by the town entrance, where the buses come in", () => {
    const r = router(kano.map);
    // The entrance road is the first highway; its far end is where buses arrive.
    const entrance = kano.map.roads.find((x) => x.highway)!;
    const end = entrance.pts.reduce((a, b) => (b.y < a.y ? b : a));
    const park = kano.map.places.find((p) => p.id === "park")!;
    const toEdge = Math.hypot(park.x - end.x, park.y - end.y);
    const market = kano.map.places.find((p) => p.id === "market")!;
    expect(toEdge).toBeLessThan(Math.hypot(market.x - end.x, market.y - end.y) + 1);
    expect(r.route("park", "market").length).toBeGreaterThan(0);
  });

  it("can route between every pair of places, at the prototype's trip scale", () => {
    const r = router(kano.map);
    let total = 0;
    let n = 0;
    for (const a of kano.map.places) {
      for (const b of kano.map.places) {
        if (a.id === b.id) continue;
        total += r.route(a.id, b.id).length;
        n++;
      }
    }
    expect(Math.abs(total / n - PROTOTYPE_MEAN_TRIP) / PROTOTYPE_MEAN_TRIP).toBeLessThan(0.02);
  });

  it("has a river with bridges where the zone or the landmark has water, and none elsewhere", () => {
    const delta = town("delta/warri-south").map;
    expect(delta.grid!.cells).toContain("w");
    expect(delta.grid!.cells).toContain("b");
    expect(kano.map.grid!.cells).not.toContain("w");
  });

  it("has traffic lights at its busy junctions", () => {
    expect(kano.map.lights!.length).toBeGreaterThan(2);
    for (const p of kano.map.lights!) {
      const c = cellOf(kano.map, p.x, p.y);
      expect(cellAt(kano.map.grid!, c.u, c.v)).toBe("r");
    }
  });

  it("leaves out a visitor's home, work and shelter", () => {
    const ids = town("kano/fagge", { visiting: true }).map.places.map((p) => p.id);
    expect(ids).not.toContain("home");
    expect(ids).not.toContain("work");
    expect(ids).toContain("park");
  });

  it("builds a town for every LGA in the country, with every place on its own plot", () => {
    for (const l of LGAS) {
      if (l.code.startsWith("kwara/ilorin")) continue;
      const { map } = town(l.code, { underFlyover: l.code.length % 3 === 0 });
      expect(map.places.length).toBeGreaterThan(10);
      checkPlots(map);
    }
  });
});

describe("Ilorin as a grid town", () => {
  const map = ilorinTown();

  it("keeps all 27 places, their names and their art", () => {
    expect(map.places.map((p) => p.id).sort()).toEqual(PLACES.map((p) => p.id).sort());
    for (const p of PLACES) {
      const mine = map.places.find((q) => q.id === p.id)!;
      expect(mine.name).toBe(p.name);
      expect(mine.art).toBeTruthy();
    }
    checkPlots(map);
  });

  /*
   * This replaces the old pin on the hand-built map's straight-line trips. The old
   * map's sparse roads sent some trips the long way round (Tanke to the Post
   * Office went via Fate), and the grid goes direct, so trip by trip the numbers
   * cannot all match. What must hold is that a typical trip takes and costs what
   * it did, and that the long commutes keep their length.
   */
  it("keeps typical trips within about 25% of the old times and fares", () => {
    const r = router(map);
    const ids = PLACES.map((p) => p.id);
    const timeErr: number[] = [];
    const fareErr: number[] = [];
    let oldTotal = 0;
    let newTotal = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = r.route(ids[i], ids[j]).length;
        const b = oldRoute(ids[i], ids[j]).length;
        oldTotal += b;
        newTotal += a;
        timeErr.push(Math.abs(MODES.keke.minutes(a) - MODES.keke.minutes(b)) / MODES.keke.minutes(b));
        fareErr.push(Math.abs(MODES.keke.fare(a) - MODES.keke.fare(b)) / MODES.keke.fare(b));
      }
    }
    const median = (x: number[]) => [...x].sort((p, q) => p - q)[Math.floor(x.length / 2)];
    expect(Math.abs(newTotal - oldTotal) / oldTotal).toBeLessThan(0.1);
    expect(median(timeErr)).toBeLessThanOrEqual(0.26);
    expect(median(fareErr)).toBeLessThanOrEqual(0.26);
    for (const [a, b] of [["home", "unilorin"], ["home", "kwasu"], ["home", "airport"], ["po", "kwasu"]]) {
      const mine = r.route(a, b).length;
      const old = oldRoute(a, b).length;
      expect(Math.abs(mine - old) / old).toBeLessThan(0.25);
    }
  });
});

describe("tile art", () => {
  it("only hands out files that exist", () => {
    for (const src of allTiles()) {
      expect(existsSync(path.resolve(__dirname, "../../public", `.${src}`))).toBe(true);
    }
  });
});
