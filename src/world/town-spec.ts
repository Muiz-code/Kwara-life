// What goes into each LGA's town: its blocks, its places, its roads out.
// Everything shared comes from a seed made from the LGA code, so every player in
// an LGA gets the same town, and every LGA gets a different one.
import { BIOMES, ROAD_NAMES, baseOf, lookOf, type BiomeId } from "../data/biomes";
import { AIRPORT_NAMES, airportLga, CAPITALS } from "../data/capitals";
import { GENERIC_DISTRICTS, LGA_DISTRICTS } from "../data/districts";
import type { ClassId } from "../data/jobs";
import { lgaPlaces, type LgaContext, type LgaPlace } from "../data/lga";
import type { State } from "../data/states";
import { hash, lcg } from "./generate";
import type { Outskirts, TownPlace, TownSpec, Zone } from "./town";
import { isPlaceKind, type PlaceKind, type ZoneKind } from "./types";

/**
 * States known for farming, whose towns get green fields round the edges. Taken
 * from the states' own slogans and the Kaduna note in src/data/biomes.ts.
 */
const FARMING_STATES = new Set(["kaduna", "benue", "zamfara", "kebbi", "niger", "plateau", "nasarawa"]);

/** The prototype's generated towns average about this trip length (src/world/generate.ts, measured). */
export const PROTOTYPE_MEAN_TRIP = 1000;

export interface TownRequest {
  /** LGA code, e.g. "kano/fagge". */
  lgaCode: string;
  state: State;
  lgaName: string;
  ctx: Omit<LgaContext, "state" | "lgaName">;
  /** Seed for the citizen's own places: the same citizen always gets the same home. */
  citizenSeed?: string;
}

/**
 * Town plans, blocks row by row from the rich end to the poor end: estates, then
 * schools and offices, the commercial heart with its street of adverts, then
 * low-cost housing and the slum.
 */
const PLANS: ZoneKind[][][] = [
  [
    ["estate", "estate"],
    ["schools", "mixed"],
    ["commercial", "ads"],
    ["civic", "lowcost"],
    ["slum", "lowcost"],
  ],
  [
    ["estate", "estate", "park"],
    ["mixed", "schools", "civic"],
    ["commercial", "ads", "commercial"],
    ["lowcost", "slum", "lowcost"],
  ],
];

/**
 * Plans of their own for the places that are built differently: Abuja's big blocks round green parks,
 * Lagos packed tight with trade on every block, the northern old cities with the market at the heart
 * inside the walls, Calabar's colonial core by the park.
 */
const LOOK_PLANS: Partial<Record<BiomeId, { plan: ZoneKind[][]; size?: number }>> = {
  fct: {
    size: 11,
    plan: [
      ["estate", "park", "estate"],
      ["civic", "ads", "civic"],
      ["schools", "commercial", "mixed"],
      ["lowcost", "park", "lowcost"],
    ],
  },
  lagos: {
    size: 8,
    plan: [
      ["estate", "ads", "estate", "mixed"],
      ["commercial", "commercial", "ads", "mixed"],
      ["mixed", "schools", "civic", "lowcost"],
      ["lowcost", "slum", "lowcost", "slum"],
    ],
  },
  hausa: {
    plan: [
      ["lowcost", "mixed", "lowcost"],
      ["mixed", "commercial", "civic"],
      ["schools", "ads", "estate"],
      ["slum", "lowcost", "estate"],
    ],
  },
  kanuri: {
    plan: [
      ["lowcost", "commercial", "lowcost"],
      ["civic", "ads", "mixed"],
      ["estate", "schools", "slum"],
    ],
  },
  calabar: {
    plan: [
      ["estate", "park", "mixed"],
      ["civic", "commercial", "ads"],
      ["schools", "lowcost", "lowcost"],
      ["slum", "mixed", "lowcost"],
    ],
  },
};

/** Which kinds of block each place belongs in, best first. */
function kindsFor(p: LgaPlace, cls: ClassId): ZoneKind[] {
  switch (p.id) {
    case "home":
      if (p.kind === "flyover") return ["slum", "lowcost"];
      return cls === "rich" ? ["estate"] : cls === "middle" ? ["mixed", "civic"] : ["lowcost", "slum"];
    case "work":
      if (p.kind === "tower") return ["ads", "commercial"];
      if (p.kind === "workshop") return ["lowcost", "slum"];
      if (p.kind === "market") return ["commercial"];
      if (p.kind === "school") return ["schools"];
      return ["mixed", "civic"];
    case "shelter": return ["slum", "lowcost"];
    case "hotel": return ["ads", "estate", "commercial"];
    case "park": return ["commercial"];
    case "market": return ["commercial"];
    case "buka": return ["lowcost", "commercial"];
    case "inec": return ["civic", "mixed"];
    case "hall": return ["civic", "mixed"];
    case "board": return ["commercial", "civic"];
    case "pu": return ["schools"];
    case "mosque": return ["mixed", "civic", "lowcost"];
    case "church": return ["lowcost", "mixed"];
    case "mosque2": return ["lowcost", "commercial", "mixed"];
    case "church2": return ["civic", "mixed", "lowcost"];
    case "viewing": return ["ads", "commercial"];
    case "kiosk": return ["commercial", "ads"];
    case "club": return ["ads", "commercial", "mixed"];
    case "airport": return ["airport"];
    case "bank": return ["commercial", "ads", "civic"];
    case "raavon": return ["ads", "mixed", "civic"];
    case "terminal": return ["commercial", "lowcost"];
    case "station": return ["lowcost", "slum", "commercial"];
    case "landmark": return ["park", "ads", "commercial"];
    case "supermarket": return ["commercial", "ads", "mixed"];
    case "boutique": return ["ads", "commercial", "mixed"];
    case "cardealer": return ["ads", "civic", "commercial"];
    case "estateagent": return ["civic", "estate", "mixed"];
    default: return ["mixed"];
  }
}

/** Towns on the water: Lagos Island's Marina, the Lekki coast, and the Delta and Calabar waterfronts. */
const COAST: Record<string, NonNullable<TownSpec["coast"]>> = {
  "lagos/lagos-island": { road: "Marina", water: "Lagos Lagoon", promenade: "The Marina" },
  "lagos/eti-osa": { road: "Lagos-Calabar Coastal Highway", water: "Atlantic Ocean", promenade: "Bar Beach" },
  "rivers/bonny": { road: "Bonny Waterfront Road", water: "Bonny River", promenade: "Waterfront" },
  "cross-river/calabar-south": { road: "Marina Road", water: "Calabar River", promenade: "Calabar Marina" },
  "akwa-ibom/oron": { road: "Oron Beach Road", water: "Cross River estuary", promenade: "Oron Beach" },
};

export function townSpecFor(req: TownRequest): TownSpec {
  const seed = hash(req.lgaCode);
  const R = lcg(seed);
  // Each state is drawn in its own region's look: Kano's mud and horns, Calabar's verandas, Abuja's glass.
  const biome: BiomeId = lookOf(req.state);
  const base = baseOf(biome);

  // The plan, which way up, and which way round.
  const own = LOOK_PLANS[biome];
  const pickPlan = Math.floor(R() * PLANS.length);
  let plan = (own?.plan ?? PLANS[pickPlan]).map((row) => [...row]);
  const richAtStart = R() < 0.5;
  if (!richAtStart) plan = plan.reverse();
  if (R() < 0.5) plan = plan.map((row) => row.reverse());
  const sizes = [8, 11];
  const sizeOf = () => own?.size ?? sizes[Math.floor(R() * 2)];
  const colSizes = plan[0].map(() => sizeOf());
  const rowSizes = plan.map((row) => (row.includes("estate") && !own?.size ? 11 : sizeOf()));

  // Each block's name: real neighbourhoods where we have them, plain words where we do not.
  const real = LGA_DISTRICTS[req.lgaCode];
  // No two blocks share a name: each takes the first of its names still free.
  const used = new Set<string>();
  const firstFree = (names: string[], fallback: string): string => {
    const name = names.find((n) => !used.has(n)) ?? `${fallback} ${used.size + 1}`;
    used.add(name);
    return name;
  };
  const nameOf = (k: ZoneKind): string => {
    const mixed = real?.mixed.length ? real.mixed : [];
    switch (k) {
      case "estate": return firstFree([...(real?.rich ?? []), "GRA", "New GRA", "Estate"], "Estate");
      case "lowcost": return firstFree([...(real?.poor ?? []), "Low-cost", "New Layout", "Old Town"], "Low-cost");
      // Never a real neighbourhood's name on a slum: that would insult the people who live there.
      case "slum": return firstFree(["Railway Line", "Under the Bridge"], "Railway Line");
      case "commercial": return firstFree([...mixed, "Central Market area", "Old Town"], "Market area");
      case "civic":
      case "mixed": return firstFree([...[...mixed].reverse(), ...GENERIC_DISTRICTS.mixed, "Central Area"], "Layout");
      case "ads": return firstFree(["Commercial Avenue"], "Commercial Avenue");
      case "schools": return firstFree(["Schools"], "Schools");
      case "park": return firstFree([req.state.landmark.name], "Park");
      default: return k;
    }
  };
  const zones: Zone[] = plan.flatMap((row, r) => row.map((kind, c) => ({ kind, col: c, row: r, name: nameOf(kind) })));
  // The state's airport: a wide block across the top of the town that hosts it.
  const airport = airportLga(req.state.code) === req.lgaName ? AIRPORT_NAMES[req.state.code] : undefined;
  if (airport) {
    zones.forEach((z) => (z.row += 1));
    zones.push({ kind: "airport", col: 0, row: 0, cols: colSizes.length, name: airport });
    rowSizes.unshift(11);
  }

  // The town entrance comes in along the main road above the commercial row.
  const commercialRow = zones.find((z) => z.kind === "commercial")!.row;
  const capital = CAPITALS[req.state.code]?.name;
  const outskirts: Outskirts[] = [
    { name: capital ? `${capital} Road` : "Expressway", side: "start", at: commercialRow, length: 12, highway: true },
  ];
  // Aso Rock and the Presidential Villa get a road of their own out the far side of town, with open
  // ground all round, clear of the terminal and the station on the road in.
  const villaRoad = lgaPlaces({ ...req.ctx, state: req.state, lgaName: req.lgaName }).some((p) => p.kind === "lm-villa") ? outskirts.length : -1;
  if (villaRoad >= 0) outskirts.push({ name: "Aso Drive", side: "end", at: Math.min(1, rowSizes.length - 1), length: 16 });

  const cls = req.ctx.cls;
  const personalSeed = hash(`${req.lgaCode}/${req.citizenSeed ?? ""}`);
  const mine = lcg(personalSeed);
  const zoneIndex = (kinds: ZoneKind[], personal: boolean) => {
    for (const k of kinds) {
      const of = zones.map((z, i) => ({ z, i })).filter((x) => x.z.kind === k);
      if (!of.length) continue;
      // The motor park goes in the commercial block by the entrance.
      if (k === "commercial") return of.sort((a, b) => a.z.col - b.z.col)[0].i;
      return of[Math.floor((personal ? mine() : R()) * of.length)].i;
    }
    return zones.findIndex((z) => z.kind === "mixed" || z.kind === "commercial");
  };

  const places: TownPlace[] = lgaPlaces({ ...req.ctx, state: req.state, lgaName: req.lgaName }).map((p) => {
    const kind: PlaceKind = isPlaceKind(p.kind) ? p.kind : "house";
    const personal = p.id === "home" || p.id === "work" || p.id === "shelter";
    // The bus terminal and the train station are too big for a town plot: they stand on the road in.
    // So do Aso Rock and the Presidential Villa, on Aso Drive.
    const outOfTown = p.id === "terminal" ? 0.25 : p.id === "station" ? 0.75 : p.kind === "lm-villa" ? 0.6 : null;
    const road = p.kind === "lm-villa" && villaRoad >= 0 ? villaRoad : 0;
    const zone = outOfTown !== null ? ("out" as const) : zoneIndex(kindsFor(p, cls), personal);
    const prefer =
      p.id === "park" ? { a: 0, c: 0 } // by the entrance, where buses come in
      : p.id === "market" ? { a: 0.5, c: 0.5 }
      : p.id === "pu" ? { a: 0.2, c: 0.2 }
      : undefined;
    return {
      id: p.id,
      name: p.name,
      area: zone === "out" ? outskirts[road].name : (zones[zone]?.name ?? req.lgaName),
      kind,
      blurb: p.blurb,
      open: p.open,
      gen: p.gen,
      ...(p.id === "home" && p.kind === "house" ? { variant: cls } : {}),
      zone,
      ...(outOfTown !== null ? { road, along: outOfTown } : {}),
      ...(prefer ? { prefer } : {}),
      ...(personal ? { personal: true } : {}),
    };
  });

  const coast = COAST[req.lgaCode];
  const riverOn = !coast && (base === "delta" || req.state.landmark.kind === "water" || req.state.landmark.kind === "bridge");
  return {
    id: req.lgaCode,
    name: req.lgaName,
    biome,
    state: req.state.code,
    seed,
    personalSeed,
    colSizes,
    rowSizes,
    zones,
    ...(coast ? { coast } : {}),
    ...(riverOn ? { riverAfterCol: Math.max(0, Math.floor(colSizes.length / 2) - 1) } : {}),
    hills: base === "hills" || BIOMES[biome].extra === "hills",
    farmland: FARMING_STATES.has(req.state.code),
    outskirts,
    places,
    meanTrip: PROTOTYPE_MEAN_TRIP,
    streetNames: ROAD_NAMES,
    placeGap: 1,
  };
}
