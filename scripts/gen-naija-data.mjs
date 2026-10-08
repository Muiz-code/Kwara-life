// Usage: node scripts/gen-naija-data.mjs <extracted.json> src/data  (see scripts/extract-naija.mjs)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const D = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out = process.argv[3];
const J = (v) => JSON.stringify(v);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const HEAD = "// Generated from reference/naija-votes-2027.html by scripts/gen-naija-data.mjs. Edit the data here from now on.\n";

// states.ts
let s = HEAD + `import type { Lang } from "./i18n";
import type { ZoneCode } from "./zones";
import { lookup } from "./lookup";

export type LandmarkKind = ${[...new Set(Object.values(D.LMK).map((l) => l[1]))].sort().map(J).join(" | ")};

export interface State {
  /** Stable id, e.g. "kwara", "akwa-ibom", "fct". */
  code: string;
  name: string;
  zone: ZoneCode;
  /** Slogan or what the state is known for. */
  slogan: string;
  /** Default UI language for citizens of this state. */
  lang: Lang;
  /** Five real LGAs (the prototype's set). */
  lgas: string[];
  /** Position on the results tile map. */
  grid: [col: number, row: number];
  landmark: { name: string; kind: LandmarkKind };
}

export const STATES: State[] = [
${D.STATES.map((r) => `  { code: ${J(slug(r[0]))}, name: ${J(r[0])}, zone: ${J(r[1])}, slogan: ${J(r[2])}, lang: ${J(r[3])}, lgas: ${J(r[4])}, grid: [${r[5]}, ${r[6]}], landmark: { name: ${J((D.LMK[r[0]] || ["Town landmark"])[0])}, kind: ${J((D.LMK[r[0]] || [0, "rock"])[1])} } },`).join("\n")}
];

export const STATE = lookup(STATES, (s) => s.code);
`;
writeFileSync(`${out}/states.ts`, s);

// parties.ts
writeFileSync(`${out}/parties.ts`, HEAD + `// INEC-registered parties (21 after DLA and NDC joined on 5 Feb 2026). Re-check INEC's list before launch.
// Rules: the ballot lists them alphabetically by code, every box the same size, no logos. Colours are only for
// result charts. Never hard-code a party anywhere in the UI; always read this list.
import { lookup } from "./lookup";

export interface Party {
  code: string;
  name: string;
  colour: string;
}

export const PARTIES: Party[] = [
${D.PARTIES.map((p, i) => `  { code: ${J(p[0])}, name: ${J(p[1])}, colour: ${J(D.PCOL[i])} },`).join("\n")}
];

export const PARTY = lookup(PARTIES, (p) => p.code);
`);

// zones.ts
writeFileSync(`${out}/zones.ts`, HEAD + `export type ZoneCode = ${Object.keys(D.ZONES).map(J).join(" | ")};

export const ZONES: Record<ZoneCode, string> = ${J(D.ZONES)};

export const ZONE_CODES = Object.keys(ZONES) as ZoneCode[];
`);

// jobs.ts
writeFileSync(`${out}/jobs.ts`, HEAD + `export type ClassId = "poor" | "middle" | "rich";

export const CLASS_LABEL: Record<ClassId, string> = { poor: "Poor", middle: "Middle class", rich: "Rich" };

export const JOBS: Record<ClassId, string[]> = ${J(D.JOBS)};

/** Pay per shift as [min, max] naira, and shift length in game minutes. */
export const PAY: Record<ClassId, { min: number; max: number; shiftMinutes: number }> = {
${Object.entries(D.PAYD).map(([k, v]) => `  ${k}: { min: ${v[0]}, max: ${v[1]}, shiftMinutes: ${v[2]} },`).join("\n")}
};

/** Starting money as [min, max] naira. */
export const START_MONEY: Record<ClassId, [number, number]> = ${J(D.START)};

export const HOMES: Record<ClassId, string[]> = ${J(D.HOMES)};

export const WORK_STEPS: Record<ClassId, string[]> = ${J(D.WORK_STEPS)};

/** Where you work, by class. */
export const WORKPLACE: Record<ClassId, { name: string; kind: string }> = {
  poor: { name: "Workshop", kind: "workshop" },
  middle: { name: "Office", kind: "office" },
  rich: { name: "Company HQ", kind: "tower" },
};
`);

// biomes.ts
writeFileSync(`${out}/biomes.ts`, HEAD + `import type { ZoneCode } from "./zones";

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
export const ZONE_BIOME: Record<ZoneCode, BiomeId> = ${J(D.BIOME)};

export const BIOMES: Record<BiomeId, Biome> = ${J(D.BIO)};

/** The local food spot per zone: [place name, dish, price]. */
export const LOCAL_FOOD: Record<ZoneCode, { place: string; dish: string; price: number }> = {
${Object.entries(D.FOOD).map(([z, f]) => `  ${z}: { place: ${J(f[0])}, dish: ${J(f[1])}, price: ${f[2]} },`).join("\n")}
};

/** Local name for the market, given the LGA's first word. */
export const MARKET_NAME: Record<ZoneCode, (town: string) => string> = {
${Object.entries(D.MKTS).map(([z, v]) => `  ${z}: (t) => ${"`" + v.replace("X", "${t}") + "`"},`).join("\n")}
};

/** Fallback road names when OpenStreetMap has no name for a road. */
export const ROAD_NAMES: string[] = ${J(D.ROADS)};
`);

// issues + promo + moderation
writeFileSync(`${out}/campaign.ts`, HEAD + `export const ISSUES = ${J(D.ISSUES)} as const;
export type Issue = (typeof ISSUES)[number];

/** Support cards: one a day, up to 3 issues, an optional short note. */
export const MAX_ISSUES = 3;
export const NOTE_MAX = 80;

export interface PromoOption {
  label: string;
  price: number;
}

/** Same prices for every party. Paid with in-game money only. */
export const PROMO: { flyer: PromoOption[]; news: PromoOption[] } = {
  flyer: ${J(D.PROMO.flyer.map(([label, price]) => ({ label, price })))},
  news: ${J(D.PROMO.news.map(([label, price]) => ({ label, price })))},
};

export const DAILY_PROMO_CAP = ${D.DAILY_CAP};

/** Notes containing these words, or any link, are not posted. */
export const BLOCKED_WORDS = ${J(D.BAD_WORDS)};

/** Names for simulated supporters in the feed. */
export const SIM_NAMES = ${J(D.SIMNAMES)};
`);

// media
writeFileSync(`${out}/media.ts`, HEAD + `/** Civic and election headlines used until the live RSS feed is wired up. */
export const NEWS = ${J(D.NEWS)};

/** Placeholder commercial ads (real ads come from the ads service). */
export const ADS = ${J(D.ADS)};

export const RADIO_STATIONS = ${J(D.RADIOS)};

export const NEWSPAPERS = ["The Daily Ballot", "Naija Times", "Morning Post", "The Voter", "Sahel Herald"];
`);

// i18n
mkdirSync(`${out}/i18n`, { recursive: true });
for (const [code] of D.LANGS) {
  writeFileSync(`${out}/i18n/${code}.ts`, HEAD + (code === "en" ? "" : "// Draft. Needs native-speaker review before release.\n") +
    (code === "en" ? "const strings = " : `import type { Strings } from ".";\n\nconst strings: Strings = `) + `${J(D.T[code]).replace(/","/g, '",\n  "').replace("{", "{\n  ").replace(/}$/, ",\n}")};\n\nexport default strings;\n`);
}
writeFileSync(`${out}/i18n/index.ts`, HEAD + `import en from "./en";
import pcm from "./pcm";
import yo from "./yo";
import ha from "./ha";
import ig from "./ig";

export type Lang = ${D.LANGS.map((l) => J(l[0])).join(" | ")};
export type Strings = Record<keyof typeof en, string>;

export const LANGS: { code: Lang; name: string }[] = ${J(D.LANGS.map(([code, name]) => ({ code, name })))};

const ALL: Record<Lang, Strings> = { en, pcm, yo, ha, ig };

/** Look up a UI string, falling back to English. */
export function t(lang: Lang, key: keyof Strings): string {
  return ALL[lang]?.[key] || en[key];
}
`);
console.log("ok");
