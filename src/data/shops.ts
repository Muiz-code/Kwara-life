// Big buys: cars, houses and clothes, and the supermarket. No brand names: the cars are described by
// what Nigerians call them, as the phones use the game's own makes.
import type { Action } from "./action";
import type { Attire, Body, Pattern } from "./attire";
import type { Gender } from "./character";

export interface CarModel {
  id: string;
  name: string;
  price: number;
  blurb: string;
}

/** Owning any of these lets you drive yourself round town and on interstate journeys. */
export const CARS: CarModel[] = [
  { id: "tokunbo-saloon", name: "Tokunbo saloon (2010)", price: 7_500_000, blurb: "Foreign used, AC working, one small dent. It will take you anywhere." },
  { id: "tokunbo-suv", name: "Tokunbo SUV (2015)", price: 22_000_000, blurb: "High enough for the potholes, big enough for the whole family." },
  { id: "new-saloon", name: "Brand-new saloon", price: 45_000_000, blurb: "Zero kilometres, new car smell, plate number fresh from the licensing office." },
  { id: "new-jeep", name: "Brand-new jeep", price: 150_000_000, blurb: "The kind of jeep that makes the gateman run to open the gate." },
];

export interface HouseModel {
  id: string;
  /** What your home is called from now on. */
  name: string;
  price: number;
  /** Comes with a generator: light at home when NEPA takes it. */
  generator: boolean;
  /** How grand the home looks, 1 to 4, for the map and the room. */
  tier: 1 | 2 | 3 | 4;
  /** Rented by the year, not bought: price is a year's rent. */
  rent?: boolean;
  blurb: string;
}

/** Bought outright, so the house is yours: no landlord, no rent. */
export const HOUSES: HouseModel[] = [
  // To rent: a year's rent up front, Naija style.
  { id: "selfcon", name: "Self-contain room in a compound", price: 350_000, generator: false, tier: 1, rent: true, blurb: "One room, your own toilet and a kitchen corner. Caution fee paid." },
  { id: "miniflat", name: "Mini flat (room and parlour)", price: 700_000, generator: false, tier: 1, rent: true, blurb: "A bedroom, a parlour for visitors and your own kitchen." },
  { id: "twobed", name: "Two-bedroom flat with a generator", price: 1_800_000, generator: true, tier: 2, rent: true, blurb: "Tiled floors and a shared generator for when NEPA takes light." },
  { id: "terrace", name: "Three-bedroom terrace in a gated estate", price: 5_000_000, generator: true, tier: 3, rent: true, blurb: "Estate gate, security man and a big generator." },
  // To buy.
  { id: "bungalow", name: "Two-bedroom bungalow in a new layout", price: 12_000_000, generator: false, tier: 1, blurb: "Your own roof, your own gate. The road is not tarred yet." },
  { id: "flat", name: "Three-bedroom flat with a generator", price: 35_000_000, generator: true, tier: 2, blurb: "Tiled floors, a borehole and a generator for when NEPA takes light." },
  { id: "duplex", name: "Four-bedroom duplex in a gated estate", price: 120_000_000, generator: true, tier: 3, blurb: "Estate security, a big generator and a compound for the cars." },
  { id: "mansion", name: "Mansion with a swimming pool", price: 450_000_000, generator: true, tier: 4, blurb: "Boys quarters, a pool, solar and generator. The whole street knows you." },
];

export interface Outfit {
  id: string;
  label: string;
  price: number;
  /** Who it is cut for. Women in hijab keep their hijab with any outfit cut for women. */
  for: "m" | "f";
  body: Body;
  head: Attire["head"];
  pattern: Pattern;
  beads?: boolean;
}

export const OUTFITS: Outfit[] = [
  { id: "agbada", label: "Aso-oke agbada and fila", price: 120_000, for: "m", body: "agbada", head: "fila", pattern: "asooke" },
  { id: "babbanriga", label: "Embroidered babban riga and hula", price: 90_000, for: "m", body: "babbanriga", head: "hula", pattern: "embroidery" },
  { id: "isiagu", label: "Isiagu and red cap", price: 45_000, for: "m", body: "isiagu", head: "okpu", pattern: "lion" },
  { id: "etibo", label: "Etibo, wrapper and coral beads", price: 60_000, for: "m", body: "etibo", head: "bowler", pattern: "george", beads: true },
  { id: "kaftan", label: "Plain kaftan and cap", price: 25_000, for: "m", body: "kaftan", head: "hula", pattern: "plain" },
  { id: "iro", label: "Aso-oke iro, buba and gele", price: 85_000, for: "f", body: "iro", head: "gele", pattern: "asooke" },
  { id: "george", label: "George wrapper and head tie", price: 70_000, for: "f", body: "wrapper", head: "ichafu", pattern: "george", beads: true },
  { id: "ankara", label: "Ankara wrapper and head tie", price: 20_000, for: "f", body: "wrapper", head: "ichafu", pattern: "atamfa" },
  { id: "abaya", label: "Flowing abaya", price: 18_000, for: "f", body: "abaya", head: "mayafi", pattern: "plain" },
];

export const CAR: Record<string, CarModel> = Object.fromEntries(CARS.map((c) => [c.id, c]));
export const HOUSE: Record<string, HouseModel> = Object.fromEntries(HOUSES.map((h) => [h.id, h]));
export const OUTFIT: Record<string, Outfit> = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));

/** A bought outfit as the avatar wears it, or null to wear the state's everyday dress. */
export function outfitAttire(id: string | null | undefined, g: Gender): Attire | null {
  const o = id && Object.hasOwn(OUTFIT, id) ? OUTFIT[id] : null;
  if (!o) return null;
  return { label: o.label, body: o.body, head: g === "h" ? "hijab" : o.head, pattern: o.pattern, beads: o.beads };
}

/** Whether an outfit fits this character. */
export const outfitFits = (o: Outfit, g: Gender) => (o.for === "m" ? g === "m" : g !== "m");

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export const CAR_ACTIONS: Action[] = CARS.map((c) => ({
  id: `car-${c.id}`, label: `Buy a ${c.name.toLowerCase()} (${naira(c.price)})`, dur: 90, cost: c.price, car: c.id,
  fx: { fun: 25 }, bubble: "Test drive", done: `You drove home in your ${c.name.toLowerCase()}. ${c.blurb}`,
}));

export const HOUSE_ACTIONS: Action[] = HOUSES.map((h) => ({
  id: `house-${h.id}`,
  label: h.rent ? `Rent a ${h.name.toLowerCase()} (${naira(h.price)} a year)` : `Buy a ${h.name.toLowerCase()} (${naira(h.price)})`,
  dur: h.rent ? 90 : 180, cost: h.price, house: h.id,
  fx: { fun: h.rent ? 18 : 30 }, bubble: "Signing papers", done: `The agent handed you the keys. ${h.blurb}`,
}));

export const OUTFIT_ACTIONS: Action[] = OUTFITS.map((o) => ({
  id: `cloth-${o.id}`, label: `Buy ${o.label.toLowerCase()}`, dur: 40, cost: o.price, outfit: o.id,
  fx: { fun: 10 }, bubble: "Fitting", done: `You changed into your new ${o.label.toLowerCase()}. You look sharp.`,
}));

/** The supermarket: foodstuff in bulk, snacks and drinks. */
export const SUPERMARKET_ACTIONS: Action[] = [
  { id: "groc", label: "Buy groceries for the week", dur: 50, cost: 9000, groc: 14, fx: {}, bubble: "Shopping", done: "Rice, beans, garri, oil and tomatoes: a week of meals." },
  { id: "foodstuff", label: "Buy foodstuff for 3 meals", dur: 25, cost: 2500, groc: 3, fx: {}, bubble: "Shopping", done: "Foodstuff for 3 meals." },
  { id: "snacks", label: "Buy snacks and a cold drink", dur: 15, cost: 1500, fx: { food: 15, fun: 6 }, bubble: "Snacking", done: "Meat pie and a cold malt. Small chops for the soul." },
];
