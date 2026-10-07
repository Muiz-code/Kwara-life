// Ilorin as a grid town, in the same system as every other LGA.
//
// It keeps its 27 real places, their names, art and actions. Each place sits on
// the lot nearest its spot on the hand-built map, and the districts grow round
// their real areas: the GRA, Adewole and Irewolede side, the old centre round the
// Post Office and the Emir's Palace, and Tanke and Oke-Odo by the university. So
// north is still up and trips keep roughly the length they had. KWASU, Shao and
// the farms lie out along the Malete road, the Poly up the Sango road and the
// airport down the Airport road.
import { PLACES } from "../data/ilorin/places";
import { placePos, route as oldRoute } from "../sim/world";
import { TILE_ART } from "./art";
import { router } from "./routing";
import { buildTown, CELL_HH, CELL_HW, type Outskirts, type TownPlace, type TownSpec } from "./town";
import type { DistrictId, WorldMap } from "./types";

export const ILORIN_TOWN_ID = "kwara/ilorin";

/** Which area each place is in. "out" places sit on a road out of town. */
const AREA: Record<string, DistrictId | "out"> = {
  // GRA, Adewole and Irewolede: the rich side
  govhouse: "rich", flower: "rich", hotel: "rich", hub: "rich", secretariat: "rich",
  adewole: "rich", evergreen: "rich", irewolede: "rich", mall: "rich", froyo: "rich", amala: "rich",
  // Post Office, Emir's Palace and the old town: the centre
  po: "mixed", palace: "mixed", adabata: "mixed", taiwo: "mixed", stadium: "mixed", sawmill: "mixed", metro: "mixed",
  // Tanke and Oke-Odo, by the university
  home: "poor", item7: "poor", okeodo: "poor", unilorin: "poor",
  // Out of town
  shao: "out", farm: "out", kwasu: "out", poly: "out", airport: "out",
};

/** Roads out of town, where they really leave from, and the places along them. */
const OUTSKIRTS: (Omit<Outskirts, "atU"> & { near: string })[] = [
  // Out of the old city by the Emir's Palace, past Shao and the farms to KWASU.
  // The old map squashed this road to fit KWASU on screen; 7 cells balances trips
  // from the Post Office (which it made short) and from Tanke (which it made long).
  { name: "Malete Rd", from: "mixed", side: "start", length: 7, highway: true, near: "palace" },
  // North from the Tanke side to the Poly.
  { name: "Sango Rd", from: "poor", side: "top", length: 3, near: "item7" },
  // South-west from Geri Alimi, by Sawmill, to the airport.
  { name: "Airport Rd", from: "rich", side: "bottom", length: 2, near: "geri" },
];
const OUT_AT: Record<string, { road: number; along: number }> = {
  shao: { road: 0, along: 0.25 },
  farm: { road: 0, along: 0.6 },
  kwasu: { road: 0, along: 1 },
  poly: { road: 1, along: 1 },
  airport: { road: 2, along: 1 },
};

/**
 * How much bigger than the hand-built layout the town is drawn, so every tile has
 * its own plot. 2 gave the closest trip times to the old map (scanned 1.1 to 2.4).
 */
export const STRETCH_DEFAULT = 2;

/** A spot on the hand-built map as a grid cell, so north is still up on screen. */
function rawCell(id: string, stretch = STRETCH_DEFAULT): { u: number; v: number } {
  const p = placePos(id);
  const X = p.x * stretch;
  const Y = p.y * stretch;
  return { u: (X / CELL_HW + Y / CELL_HH) / 2, v: (Y / CELL_HH - X / CELL_HW) / 2 };
}

export function ilorinSpec(stretch = STRETCH_DEFAULT): TownSpec {
  const inTown = PLACES.filter((p) => AREA[p.id] !== "out").map((p) => p.id);
  const raw = Object.fromEntries(inTown.map((id) => [id, rawCell(id, stretch)]));
  // Start the town two cells in from its edge streets.
  const minU = Math.min(...inTown.map((id) => raw[id].u));
  const minV = Math.min(...inTown.map((id) => raw[id].v));
  const shift = (c: { u: number; v: number }) => ({ u: c.u - minU + 2, v: c.v - minV + 2 });
  const cells = Object.fromEntries(inTown.map((id) => {
    const c = shift(raw[id]);
    return [id, { u: Math.round(c.u), v: Math.round(c.v) }];
  }));
  const size = {
    u: 3 * Math.ceil((Math.max(...inTown.map((id) => cells[id].u)) + 3) / 3),
    v: 3 * Math.ceil((Math.max(...inTown.map((id) => cells[id].v)) + 3) / 3) + 1,
  };
  // A road out leaves from the cross street nearest where it really starts.
  const outskirts: Outskirts[] = OUTSKIRTS.map(({ near, ...o }) => {
    const c = shift(rawCell(near, stretch));
    return {
      ...o,
      atU: Math.min(size.u, Math.max(0, 3 * Math.round(c.u / 3))),
      atV: Math.min(size.v - 1, Math.max(0, 3 * Math.round(c.v / 3))),
    };
  });

  const places: TownPlace[] = PLACES.map((p) => ({
    id: p.id,
    name: p.name,
    area: p.area,
    kind: p.kind,
    blurb: p.blurb,
    open: p.open,
    gen: p.gen,
    art: TILE_ART[p.id],
    ...(p.variant ? { variant: p.variant } : {}),
    district: AREA[p.id],
    ...(AREA[p.id] === "out" ? OUT_AT[p.id] : { cell: cells[p.id] }),
  }));
  return {
    id: ILORIN_TOWN_ID,
    name: "Ilorin",
    biome: "savanna",
    state: "kwara",
    seed: 0x11071,
    order: ["rich", "mixed", "poor"],
    lengths: { rich: 0, mixed: 0, poor: 0 },
    width: size.v,
    names: { rich: "GRA and Adewole", mixed: "Post Office and Oja Oba", poor: "Tanke and Oke-Odo" },
    river: false,
    hills: false,
    farmland: true,
    outskirts,
    places,
    meanTrip: 1600,
    streetNames: ["Ahmadu Bello Way", "Ibrahim Taiwo Rd", "Unity Rd", "Murtala Mohammed Way", "Fate Rd", "Tanke Rd", "Taiwo Rd", "Asa Dam Rd", "Sawmill Rd", "Unilorin Rd", "Taoheed Rd", "Reservation Rd", "Adewole Rd", "Adabata Rd"],
    // Real neighbours (the Post Office and the Secretariat) stay side by side.
    placeGap: 1,
    regions: { size, anchors: inTown.map((id) => ({ id: AREA[id] as DistrictId, ...cells[id] })) },
  };
}

/**
 * The Ilorin town, with trip lengths scaled so the typical trip (the median, over
 * every pair of places) is as long as it was on the hand-built map. The old map's
 * sparse roads made some trips detour a long way round; the grid goes direct, so
 * those few get shorter, and the scale is not dragged about by them.
 */
export function ilorinTown(stretch = STRETCH_DEFAULT): WorldMap {
  const { map } = buildTown(ilorinSpec(stretch));
  const r = router({ ...map, lengthScale: 1 });
  const ratios: number[] = [];
  const ids = PLACES.map((p) => p.id);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      ratios.push(oldRoute(ids[i], ids[j]).length / r.route(ids[i], ids[j]).length);
    }
  }
  ratios.sort((x, y) => x - y);
  return { ...map, lengthScale: ratios[Math.floor(ratios.length / 2)] ?? 1, start: "home" };
}
