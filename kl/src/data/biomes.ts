// Generated from reference/naija-votes-2027.html by scripts/gen-naija-data.mjs. Edit the data here from now on.
import type { ZoneCode } from "./zones";

export type BiomeId = "sahel" | "savanna" | "forest" | "hills" | "delta";

export interface Biome {
  name: string;
  ground: string;
  patch: string;
  wall: string[];
  roof: string[];
  flat?: boolean;
  trees: string[];
  road: string;
  /** Extra scenery: cattle, rocks, red earth, hills, water. */
  extra: string;
}

/** Default biome per zone. Individual areas can override it (for example green farmland in Kaduna). */
export const ZONE_BIOME: Record<ZoneCode, BiomeId> = {"NW":"sahel","NE":"sahel","NC":"savanna","SW":"forest","SE":"hills","SS":"delta"};

export const BIOMES: Record<BiomeId, Biome> = {"sahel":{"name":"Sahel savanna","ground":"#E3C890","patch":"#D2B26E","wall":["#D9A066","#C98E5A","#E3B47E"],"roof":["#B9834B","#A9733F"],"flat":true,"trees":["neem","baobab","neem"],"road":"#8C6A4A","extra":"cattle"},"savanna":{"name":"Guinea savanna","ground":"#CDB878","patch":"#B9A35F","wall":["#EAD7B5","#D9A066","#E6C9A0"],"roof":["#9AA3AD","#8B5A3A"],"trees":["neem","","baobab"],"road":"#66615B","extra":"rocks"},"forest":{"name":"Rainforest belt","ground":"#A6BE70","patch":"#8DAB5A","wall":["#EAD7B5","#F0E2C4","#E6D3AE"],"roof":["#9AA3AD","#8B5A3A","#7E8792"],"trees":["palm","","palm"],"road":"#5E5A55","extra":"red"},"hills":{"name":"Eastern hills","ground":"#99B666","patch":"#7FA350","wall":["#F0E2C4","#E6EEF2","#F4E7D0"],"roof":["#B3261E","#2B4C7E","#9AA3AD"],"trees":["palm","",""],"road":"#5E5A55","extra":"hills"},"delta":{"name":"Niger Delta creeks","ground":"#8FB062","patch":"#6E9A4E","wall":["#EAD7B5","#D9C3A0","#E6EEF2"],"roof":["#9AA3AD","#7E8792"],"trees":["palm","mangrove","palm"],"road":"#5E5A55","extra":"water"}};

/** The local food spot per zone: [place name, dish, price]. */
export const LOCAL_FOOD: Record<ZoneCode, { place: string; dish: string; price: number }> = {
  SW: { place: "Amala spot", dish: "Amala, ewedu and gbegiri", price: 2000 },
  NW: { place: "Tuwo joint", dish: "Tuwo shinkafa and miyan kuka", price: 1500 },
  NE: { place: "Tuwo joint", dish: "Tuwo masara and miyan taushe", price: 1500 },
  SE: { place: "Abacha spot", dish: "Abacha and ugba with fish", price: 1800 },
  SS: { place: "Banga kitchen", dish: "Starch and banga soup", price: 2200 },
  NC: { place: "Mama put", dish: "Pounded yam and egusi", price: 2000 },
};

/** Local name for the market, given the LGA's first word. */
export const MARKET_NAME: Record<ZoneCode, (town: string) => string> = {
  SW: (t) => `Ọjà ${t}`,
  NW: (t) => `Kasuwar ${t}`,
  NE: (t) => `Kasuwar ${t}`,
  SE: (t) => `Ahịa ${t}`,
  SS: (t) => `${t} Market`,
  NC: (t) => `${t} Market`,
};

/** Fallback road names when OpenStreetMap has no name for a road. */
export const ROAD_NAMES: string[] = ["Murtala Mohammed Way","Ahmadu Bello Way","Awolowo Road","Tafawa Balewa Way","Market Road","Station Road","School Road","Hospital Road","Unity Road","Zik Avenue","Stadium Road","New Layout Road","Old Garage Road","Palace Road"];
