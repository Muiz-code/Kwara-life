// Generated from reference/naija-votes-2027.html by scripts/gen-naija-data.mjs. Edit the data here from now on.
import type { ZoneCode } from "./zones";

/** The five zone looks, then a look of its own for each region with its own way of building. */
export type BaseBiome = "sahel" | "savanna" | "forest" | "hills" | "delta";
export type BiomeId = BaseBiome | "hausa" | "kanuri" | "yoruba" | "lagos" | "igbo" | "calabar" | "creek" | "benin" | "fct" | "plateau" | "tiv";

/**
 * How a region builds its homes:
 * hausa: mud walls, flat roofs with horned corners (zanko) and relief patterns round the door.
 * yoruba: long bungalows under rusty gable roofs, wide verandas.
 * lagos: tall, tight, brightly painted, a shop on the ground floor.
 * igbo: storey villas with balustrades and bold roofs.
 * colonial: Calabar's wooden verandas, louvred shutters and steep red roofs.
 * stilt: creek houses raised on stilts above the wet ground.
 * benin: red-earth walls with the horizontal grooves of old Benin.
 * modern: Abuja's white and glass, flat-roofed, with lawns.
 * stone: Jos stone walls under zinc.
 * hut: round mud huts with thatched cones beside the houses.
 */
export type Arch = "plain" | "hausa" | "yoruba" | "lagos" | "igbo" | "colonial" | "stilt" | "benin" | "modern" | "stone" | "hut";

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
  /** The zone look it is drawn from, for art that only comes in the five zone looks. */
  base?: BaseBiome;
  arch?: Arch;
  /** Colour of the town's taxis and kekes. */
  taxi?: string;
  /** The old town wall with its gates (Kano, Katsina, Zaria, Sokoto, Maiduguri). */
  walled?: boolean;
}

/** Default biome per zone. Individual areas can override it (for example green farmland in Kaduna). */
export const ZONE_BIOME: Record<ZoneCode, BiomeId> = {"NW":"sahel","NE":"sahel","NC":"savanna","SW":"forest","SE":"hills","SS":"delta"};

const ZONE_LOOKS: Record<BaseBiome, Biome> = {"sahel":{"name":"Sahel savanna","ground":"#E3C890","patch":"#D2B26E","wall":["#D9A066","#C98E5A","#E3B47E"],"roof":["#B9834B","#A9733F"],"flat":true,"trees":["neem","baobab","neem"],"road":"#8C6A4A","extra":"cattle"},"savanna":{"name":"Guinea savanna","ground":"#CDB878","patch":"#B9A35F","wall":["#EAD7B5","#D9A066","#E6C9A0"],"roof":["#9AA3AD","#8B5A3A"],"trees":["neem","","baobab"],"road":"#66615B","extra":"rocks"},"forest":{"name":"Rainforest belt","ground":"#A6BE70","patch":"#8DAB5A","wall":["#EAD7B5","#F0E2C4","#E6D3AE"],"roof":["#9AA3AD","#8B5A3A","#7E8792"],"trees":["palm","","palm"],"road":"#5E5A55","extra":"red"},"hills":{"name":"Eastern hills","ground":"#99B666","patch":"#7FA350","wall":["#F0E2C4","#E6EEF2","#F4E7D0"],"roof":["#B3261E","#2B4C7E","#9AA3AD"],"trees":["palm","",""],"road":"#5E5A55","extra":"hills"},"delta":{"name":"Niger Delta creeks","ground":"#8FB062","patch":"#6E9A4E","wall":["#EAD7B5","#D9C3A0","#E6EEF2"],"roof":["#9AA3AD","#7E8792"],"trees":["palm","mangrove","palm"],"road":"#5E5A55","extra":"water"}};

// Regional looks, on top of the zone ones above.
export const BIOMES: Record<BiomeId, Biome> = { ...ZONE_LOOKS, ...({
  hausa: { name: "Hausa savanna", base: "sahel", arch: "hausa", walled: true, ground: "#DDBA7E", patch: "#C9A15F", wall: ["#B86B3A", "#C47A45", "#A85F33", "#CF8A55", "#BE7444"], roof: ["#9C5A30"], flat: true, trees: ["neem", "baobab", "neem"], road: "#9A6B45", extra: "cattle", taxi: "#F2B705" },
  kanuri: { name: "Borno plains", base: "sahel", arch: "hausa", walled: true, ground: "#E8D3A2", patch: "#D8BE86", wall: ["#D8B48A", "#C9A27A", "#E2C49B"], roof: ["#A9845E"], flat: true, trees: ["neem", "baobab", "neem"], road: "#A2805C", extra: "cattle", taxi: "#2E7D4F" },
  yoruba: { name: "Yoruba forest towns", base: "forest", arch: "yoruba", ground: "#B9925F", patch: "#A97E4E", wall: ["#D8C3A0", "#C9A27A", "#E3CFAE", "#BFA27E", "#E9D9B8"], roof: ["#8B5A3A", "#9A6440", "#7D4B2E"], trees: ["palm", "neem", "palm"], road: "#5E5A55", extra: "red", taxi: "#F2B705" },
  lagos: { name: "Lagos", base: "forest", arch: "lagos", ground: "#9DB46C", patch: "#8AA35C", wall: ["#E8C547", "#7FB3D5", "#F0B27A", "#F5F5F5", "#A3D9A5", "#E59866", "#D7BDE2"], roof: ["#2B5C9A", "#B3261E", "#2E7D4F", "#9AA3AD"], trees: ["palm", "", "palm"], road: "#4A4744", extra: "red", taxi: "#F2B705" },
  igbo: { name: "Igbo heartland", base: "hills", arch: "igbo", ground: "#93B463", patch: "#7FA350", wall: ["#F4F1EA", "#F0E2C4", "#E6EEF2", "#F2D9C8", "#DCE6EA"], roof: ["#B3261E", "#2B4C7E", "#1F6B4A", "#7B2232"], trees: ["palm", "neem", "palm"], road: "#5E5A55", extra: "hills", taxi: "#2B5C9A" },
  calabar: { name: "Calabar and the Cross River", base: "delta", arch: "colonial", ground: "#7FAA58", patch: "#6A9548", wall: ["#BFDCE8", "#CFE6C8", "#F4F1EA", "#F6E3B4", "#E8D5E8"], roof: ["#A33A2A", "#B5532E", "#8C2F2A"], trees: ["palm", "mangrove", "palm"], road: "#55524E", extra: "water", taxi: "#1F7A8C" },
  creek: { name: "Niger Delta creeks", base: "delta", arch: "stilt", ground: "#7C9F55", patch: "#668C45", wall: ["#B08D57", "#9C7A4E", "#DCE6EA", "#CFE6C8", "#E9D9B8"], roof: ["#9AA3AD", "#7E8792", "#8B5A3A"], trees: ["palm", "mangrove", "mangrove"], road: "#55524E", extra: "water", taxi: "#C0392B" },
  benin: { name: "Benin kingdom", base: "forest", arch: "benin", ground: "#A9653C", patch: "#955732", wall: ["#A0522D", "#8B4726", "#B25F35", "#9A5030"], roof: ["#6B4A2E", "#7D4B2E", "#9AA3AD"], trees: ["palm", "neem", "palm"], road: "#5E5A55", extra: "red", taxi: "#2B5C9A" },
  fct: { name: "Abuja", base: "savanna", arch: "modern", ground: "#A9C47A", patch: "#96B468", wall: ["#F4F1EA", "#E6E2D8", "#FFFFFF", "#DCE6EA", "#EDE7DA"], roof: ["#5E6B73", "#9AA3AD", "#B5532E"], flat: true, trees: ["neem", "palm", "neem"], road: "#3E3C3A", extra: "rocks", taxi: "#2E7D4F" },
  plateau: { name: "Jos Plateau", base: "savanna", arch: "stone", ground: "#94AA6A", patch: "#7F9757", wall: ["#8E8B84", "#A19D94", "#7D7A73", "#B3AEA4"], roof: ["#9AA3AD", "#8E979F", "#B3261E"], trees: ["neem", "", "neem"], road: "#5A5753", extra: "rocks", taxi: "#E67E22" },
  tiv: { name: "Middle Belt farmland", base: "savanna", arch: "hut", ground: "#BFAE6E", patch: "#A99858", wall: ["#C9935F", "#B98454", "#D8A774", "#EAD7B5"], roof: ["#9AA3AD", "#8B5A3A"], trees: ["neem", "baobab", "palm"], road: "#7A6248", extra: "rocks", taxi: "#F2B705" },
} satisfies Record<Exclude<BiomeId, BaseBiome>, Biome>) };

/** Each state's look. States not listed keep their zone's. */
export const STATE_LOOK: Record<string, BiomeId> = {
  kano: "hausa", katsina: "hausa", jigawa: "hausa", sokoto: "hausa", kebbi: "hausa", zamfara: "hausa", kaduna: "hausa",
  borno: "kanuri", yobe: "kanuri",
  oyo: "yoruba", osun: "yoruba", ogun: "yoruba", ondo: "yoruba", ekiti: "yoruba", kwara: "yoruba",
  lagos: "lagos",
  anambra: "igbo", imo: "igbo", abia: "igbo", enugu: "igbo", ebonyi: "igbo",
  "cross-river": "calabar", "akwa-ibom": "calabar",
  rivers: "creek", bayelsa: "creek", delta: "creek",
  edo: "benin",
  fct: "fct",
  plateau: "plateau",
  benue: "tiv", nasarawa: "tiv", kogi: "tiv", taraba: "tiv",
};

/** The look a state's towns are drawn in. */
export const lookOf = (state: { code: string; zone: ZoneCode }): BiomeId => STATE_LOOK[state.code] ?? ZONE_BIOME[state.zone];
/** The zone look underneath, for art that only comes in five looks. */
export const baseOf = (b: BiomeId): BaseBiome => (BIOMES[b].base ?? b) as BaseBiome;

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
