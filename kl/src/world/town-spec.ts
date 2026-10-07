// What goes into each LGA's town: its districts, its places, its roads out.
// Everything shared comes from a seed made from the LGA code, so every player in
// an LGA gets the same town, and every LGA gets a different one.
import { ROAD_NAMES, ZONE_BIOME, type BiomeId } from "../data/biomes";
import { CAPITALS } from "../data/capitals";
import { GENERIC_DISTRICTS, LGA_DISTRICTS } from "../data/districts";
import type { ClassId } from "../data/jobs";
import { lgaPlaces, type LgaContext, type LgaPlace } from "../data/lga";
import type { State } from "../data/states";
import { hash, lcg } from "./generate";
import type { Outskirts, TownPlace, TownSpec } from "./town";
import { isPlaceKind, type DistrictId, type PlaceKind } from "./types";

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

/** Which district a place belongs in, and where in it the town would put it. */
function slot(p: LgaPlace, cls: ClassId, toward: { rich: number; poor: number }): Pick<TownPlace, "district" | "prefer"> {
  switch (p.id) {
    case "hotel":
      return { district: "rich", prefer: { a: toward.rich === 0 ? 0.85 : 0.15, c: 0.4 } };
    case "park":
      // Buses come in at the town entrance, on the top edge of the centre.
      return { district: "mixed", prefer: { a: 0.5, c: 0 } };
    case "market":
      return { district: "mixed", prefer: { a: 0.5, c: 0.45 } };
    case "inec":
      return { district: "mixed", prefer: { a: 0.3, c: 0.25 } };
    case "hall":
      return { district: "mixed", prefer: { a: 0.35, c: 0.6 } };
    case "board":
      return { district: "mixed", prefer: { a: 0.45, c: 0.75 } };
    case "pu":
      return { district: "mixed", prefer: { a: 0.15, c: 0.85 } };
    case "mosque":
      return { district: "mixed", prefer: { a: 0.7, c: 0.25 } };
    case "church":
      return { district: "mixed", prefer: { a: 0.75, c: 0.75 } };
    case "viewing":
      return { district: "mixed", prefer: { a: 0.6, c: 0.6 } };
    case "kiosk":
      return { district: "mixed", prefer: { a: 0.55, c: 0.15 } };
    case "landmark":
      return { district: "mixed", prefer: { a: 0.9, c: 0.5 } };
    case "buka":
      return { district: "poor", prefer: { a: toward.poor === 0 ? 0.2 : 0.8, c: 0.4 } };
    case "shelter":
      return { district: "poor", prefer: { a: 0.5, c: 0.8 } };
    case "home":
      if (p.kind === "flyover") return { district: "poor", prefer: { a: 0.5, c: 0.5 } };
      if (cls === "rich") return { district: "rich", prefer: undefined };
      // Middle class lives on the edge of the centre nearest the rich side.
      if (cls === "middle") return { district: "mixed", prefer: { a: toward.rich === 0 ? 0.05 : 0.95, c: 0.5 } };
      return { district: "poor", prefer: undefined };
    case "work":
      if (p.kind === "tower") return { district: "rich", prefer: undefined };
      if (p.kind === "workshop") return { district: "poor", prefer: undefined };
      return { district: "mixed", prefer: undefined };
    default:
      return { district: "mixed", prefer: undefined };
  }
}

const pickName = (list: string[] | undefined, fallback: string[], r: () => number) =>
  list && list.length ? list[Math.floor(r() * list.length)] : fallback[Math.floor(r() * fallback.length)];

export function townSpecFor(req: TownRequest): TownSpec {
  const seed = hash(req.lgaCode);
  const R = lcg(seed);
  const zone = req.state.zone;
  const biome: BiomeId = ZONE_BIOME[zone];
  const richFirst = R() < 0.5;
  const order: TownSpec["order"] = richFirst ? ["rich", "mixed", "poor"] : ["poor", "mixed", "rich"];
  const width = 3 * (4 + Math.floor(R() * 2)) + 1;
  const lengths: Record<DistrictId, number> = {
    rich: 4 * (2 + Math.floor(R() * 2)),
    mixed: 3 * (4 + Math.floor(R() * 2)),
    poor: 3 * (3 + Math.floor(R() * 2)),
  };
  const real = LGA_DISTRICTS[req.lgaCode];
  const names: Record<DistrictId, string> = {
    rich: pickName(real?.rich, GENERIC_DISTRICTS.rich, R),
    mixed: pickName(real?.mixed, GENERIC_DISTRICTS.mixed, R),
    poor: pickName(real?.poor, GENERIC_DISTRICTS.poor, R),
  };
  const capital = CAPITALS[req.state.code]?.name;
  const outskirts: Outskirts[] = [
    { name: capital ? `${capital} Road` : "Expressway", from: "mixed", side: "top", length: 5, highway: true },
  ];

  // Within a district, a = 0 is the end nearest the start of town.
  const toward = { rich: richFirst ? 0 : 1, poor: richFirst ? 1 : 0 };
  const cls = req.ctx.cls;
  const personalSeed = hash(`${req.lgaCode}/${req.citizenSeed ?? ""}`);
  const mine = lcg(personalSeed);
  const places: TownPlace[] = lgaPlaces({ ...req.ctx, state: req.state, lgaName: req.lgaName }).map((p) => {
    const kind: PlaceKind = isPlaceKind(p.kind) ? p.kind : "house";
    const where = slot(p, cls, toward);
    const personal = p.id === "home" || p.id === "work" || p.id === "shelter";
    return {
      id: p.id,
      name: p.name,
      area: names[where.district as DistrictId] ?? req.lgaName,
      kind,
      blurb: p.blurb,
      open: p.open,
      gen: p.gen,
      ...(p.id === "home" && p.kind === "house" ? { variant: cls } : {}),
      ...where,
      // Which street the middle-class home is on depends on the citizen, not the LGA.
      ...(where.prefer && p.id === "home" && cls === "middle" ? { prefer: { ...where.prefer, c: mine() } } : {}),
      ...(personal ? { personal: true } : {}),
    };
  });

  return {
    id: req.lgaCode,
    name: req.lgaName,
    biome,
    state: req.state.code,
    seed,
    personalSeed,
    order,
    lengths,
    width,
    names,
    river: biome === "delta" || req.state.landmark.kind === "water" || req.state.landmark.kind === "bridge",
    hills: biome === "hills",
    farmland: FARMING_STATES.has(req.state.code),
    outskirts,
    places,
    meanTrip: PROTOTYPE_MEAN_TRIP,
    streetNames: ROAD_NAMES,
  };
}
