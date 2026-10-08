// Generated from reference/naija-votes-2027.html by scripts/gen-naija-data.mjs. Edit the data here from now on.
export const ISSUES = ["Jobs","Security","Electricity","Education","Healthcare","Roads","Cost of living","Corruption"] as const;
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
  flyer: [{"label":"Street (about 200 people)","price":5000},{"label":"Whole LGA (about 5,000 people)","price":50000},{"label":"Whole state (about 100,000 people)","price":500000}],
  news: [{"label":"One ticker line on NVT News for a day","price":25000},{"label":"Sponsored segment in the evening news","price":250000}],
};

export const DAILY_PROMO_CAP = 1000000;

/** Notes containing these words, or any link, are not posted. */
export const BLOCKED_WORDS = ["kill","die","thug","idiot","fool","stupid","rig","burn","attack","hate"];

/** Names for simulated supporters in the feed. */
export const SIM_NAMES = ["Bisi","Chinedu","Aminu","Ngozi","Tunde","Zainab","Efe","Ibrahim","Kemi","Emeka","Hauwa","Segun","Ifeoma","Musa","Tari","Funmi"];
