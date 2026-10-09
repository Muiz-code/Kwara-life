// Ilorin as a grid town, in the same system as every other LGA, laid out after
// the user's sketch: big blocks with one use each and roundabouts where the main
// roads cross. It keeps its 27 real places, their names, art and actions, each in
// the block that suits it: the airport and Unilorin at the top, Taiwo Oke and
// Sawmill trading, the old city round the Post Office and Oja Oba, offices along
// Ahmadu Bello Way, the Poly with the schools, Adewole and the GRA estates, Metro
// Square and the stadium, KWASU, the Fate Road strip with its adverts, and Tanke
// and Oke-Odo. Shao and the farms lie out along the Malete road.
import { PLACES, PROTOTYPE_PLACES } from "../data/ilorin/places";
import { route as oldRoute } from "../sim/world";
import { TILE_ART } from "./art";
import { router } from "./routing";
import { buildTown, type TownPlace, type TownSpec, type Zone } from "./town";
import type { WorldMap } from "./types";

export const ILORIN_TOWN_ID = "kwara/ilorin";

/**
 * The blocks, row by row, after the sketch. Tanke and Oke-Odo sit beside
 * Unilorin, as they really do: the university's main gate is on their side.
 */
const ZONES: Zone[] = [
  { kind: "airport", col: 0, row: 0, name: "Ilorin Airport" },
  { kind: "campus", col: 1, row: 0, name: "Unilorin" },
  { kind: "lowcost", col: 2, row: 0, name: "Tanke and Oke-Odo" },
  { kind: "civic", col: 0, row: 2, name: "Post Office and Oja Oba" },
  { kind: "mixed", col: 1, row: 1, name: "Ahmadu Bello Way" },
  { kind: "commercial", col: 2, row: 2, name: "Taiwo Oke" },
  { kind: "estate", col: 0, row: 1, name: "Adewole" },
  { kind: "park", col: 1, row: 2, name: "Metro Square" },
  { kind: "estate", col: 2, row: 1, name: "GRA and Fate" },
  { kind: "mixed", col: 0, row: 3, name: "Gaa-Akanbi" },
  { kind: "ads", col: 1, row: 3, name: "Fate Road" },
  { kind: "schools", col: 2, row: 3, name: "Schools" },
  { kind: "slum", col: 0, row: 4, name: "Railway Line" },
  { kind: "lowcost", col: 1, row: 4, name: "Baboko" },
  { kind: "mixed", col: 2, row: 4, name: "Oke-Oyi" },
];

/** Which block each place is in (index into ZONES), or "out" on the Malete road. */
const BLOCK: Record<string, number | "out"> = {
  airport: 0,
  unilorin: 1,
  home: 2, item7: 2, okeodo: 2, club: 2,
  klario: 5,
  raavon: 4,
  po: 3, palace: 3, adabata: 3,
  secretariat: 4, hub: 4, govhouse: 4, hotel: 4,
  taiwo: 5, sawmill: 5,
  adewole: 6,
  metro: 7, stadium: 7, flower: 7,
  evergreen: 8, irewolede: 8,
  // KWASU is in Malete, out along the Malete road past Shao and the farms.
  kwasu: "out",
  terminal: "out",
  station: "out",
  amala: 10, froyo: 10, mall: 10,
  poly: 11,
  shao: "out", farm: "out",
  // Civic places: VINEC on Ahmadu Bello Way, the polling unit in the Tanke school, the rest round Post Office.
  inec: 4,
  sync: 4,
  pu: 11,
  viewing: 2,
  kiosk: 3, board: 3, hall: 3,
};

const OUT_AT: Record<string, { road: number; along: number }> = {
  // On Ibadan Road, the way coaches and the railway come in from the south.
  terminal: { road: 1, along: 0.3 },
  station: { road: 1, along: 0.85 },
  shao: { road: 0, along: 0.35 },
  farm: { road: 0, along: 0.6 },
  kwasu: { road: 0, along: 0.95 },
};

export function ilorinSpec(): TownSpec {
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
    zone: BLOCK[p.id],
    ...(BLOCK[p.id] === "out" ? OUT_AT[p.id] : {}),
  }));
  return {
    id: ILORIN_TOWN_ID,
    name: "Ilorin",
    biome: "savanna",
    state: "kwara",
    seed: 0x11071,
    colSizes: [11, 11, 11],
    rowSizes: [8, 8, 11, 8, 8],
    zones: ZONES,
    hills: false,
    farmland: true,
    // Out to Shao, the farms and KWASU at Malete; buses come into town the same way.
    outskirts: [
      { name: "Malete Rd", side: "start", at: 4, length: 11, highway: true },
      { name: "Ibadan Rd", side: "end", at: 3, length: 10, highway: true },
    ],
    places,
    meanTrip: 1600,
    streetNames: ["Ahmadu Bello Way", "Ibrahim Taiwo Rd", "Unity Rd", "Murtala Mohammed Way", "Fate Rd", "Tanke Rd", "Taiwo Rd", "Asa Dam Rd", "Sawmill Rd", "Unilorin Rd", "Taoheed Rd", "Reservation Rd", "Adewole Rd", "Adabata Rd"],
    placeGap: 1,
  };
}

/**
 * The Ilorin town, with trip lengths scaled so the typical trip (the median, over
 * every pair of places) is as long as it was on the hand-built map, so fares and
 * times feel the same to players used to the old map.
 */
export function ilorinTown(): WorldMap {
  const { map } = buildTown(ilorinSpec());
  const r = router({ ...map, lengthScale: 1 });
  const ratios: number[] = [];
  // Scaled on the prototype's places, so places added since do not change fares.
  const ids = PLACES.slice(0, PROTOTYPE_PLACES).map((p) => p.id);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      ratios.push(oldRoute(ids[i], ids[j]).length / r.route(ids[i], ids[j]).length);
    }
  }
  ratios.sort((x, y) => x - y);
  return { ...map, lengthScale: ratios[Math.floor(ratios.length / 2)] ?? 1, start: "home" };
}
