// Commercial ad slots and default prices. Real prices live on the server (editable without a release);
// these are the defaults it is seeded with.

export type AdSlotKind = "tv" | "billboard" | "ticker" | "radio" | "journey";

export const AD_SLOT_KINDS: { kind: AdSlotKind; label: string; video: boolean; size: [number, number] | null }[] = [
  { kind: "tv", label: "TV ad break (home TV and viewing centre)", video: true, size: [640, 360] },
  { kind: "billboard", label: "Billboard", video: true, size: [512, 256] },
  { kind: "journey", label: "Long-journey screen", video: true, size: [640, 360] },
  { kind: "ticker", label: "News ticker", video: false, size: null },
  { kind: "radio", label: "Radio spot", video: false, size: null },
];

/** Boards are booked by the day: the season runs 30 days, so 30 is the most. Naira per day, per face. */
export const PRICE_PER_DAY = 10_000;
export const MAX_AD_DAYS = 30;
export const DAY_MS = 86_400_000;
/** Wall artwork inside a landmark building: premium, by the day. */
export const WALL_ART_PER_DAY = 25_000;

/** Naira per single showing. */
export const PRICE_PER_SHOWING = 5000;
/** Naira per 1,000 showings (bulk). */
export const PRICE_PER_THOUSAND = 4_500_000;
/** Longest video an advertiser can upload, in seconds. Videos are scaled and compressed to the slot. */
export const MAX_VIDEO_SECONDS = 15;

/** Price for a number of showings: whole thousands at the bulk rate, the rest at the single rate. */
export function adPrice(showings: number): number {
  const n = Math.max(0, Math.floor(showings));
  return Math.floor(n / 1000) * PRICE_PER_THOUSAND + (n % 1000) * PRICE_PER_SHOWING;
}
