// Booking a billboard ad: what may be shown, what it costs, and the payment. Billboards are for
// businesses. Real-money political promotion is not allowed (kl/CLAUDE.md): campaigning uses the in-game
// flyers and sponsored news instead, paid with in-game money.
// The payment here is a simulation until Paystack is connected (docs/HANDOVER.md, Phase E): no card
// details are taken and no money moves.
import { adPrice, DAY_MS, MAX_AD_DAYS, PRICE_PER_DAY } from "../data/ads";
import { BOARDS, type BoardFace, type BoardType } from "../data/boards";
import { bookingEnds } from "./carousel";
import { BLOCKED_WORDS } from "../data/campaign";
import { PARTIES } from "../data/parties";

export interface AdBooking {
  /** Payment reference. */
  ref: string;
  /** Which board, on which town's map. */
  mapId: string;
  boardId: string;
  /** The business advertising. */
  title: string;
  /** The ad picture, cropped to the board (a JPEG data URL). */
  image: string;
  /** Old bookings were by showings; new ones are by days (showings is 0). */
  showings: number;
  /** Days booked, 1 to 30. */
  days?: number;
  price: number;
  /** Real time it was paid for. */
  paidAt: number;
  /** Which face it runs on. Bookings made before faces existed run on both. */
  face?: BoardFace | "both";
  /** The kind of board, for its carousel timing. */
  type?: BoardType;
  /** A video ad on a smart screen: its id in this browser's video store. The image is its poster frame. */
  video?: string;
  /** Real time it stops showing. */
  until?: number;
  /** The business's website: players who tap the board can visit it (https only, checked by cleanAdLink). */
  link?: string;
}

/** The kind of board an id names. Edge boards carry their kind in the id; in-town boards are classic. */
export function boardTypeOf(boardId: string): BoardType {
  if (boardId.startsWith("smart-")) return "smart";
  if (boardId.startsWith("square-")) return "square";
  if (boardId.startsWith("tall-")) return "tall";
  if (boardId.startsWith("attention-")) return "prime";
  return "classic";
}

/** Days you can book: whole days, 1 to 30. */
export const clampDays = (n: number) => Math.max(1, Math.min(MAX_AD_DAYS, Math.floor(Number.isFinite(n) ? n : 1)));

/** Price for some days on a kind of board, on one face or both. */
export function boardDayPrice(days: number, type: BoardType, face: BoardFace | "both"): number {
  return Math.round(clampDays(days) * PRICE_PER_DAY * BOARDS[type].priceFactor) * (face === "both" ? 2 : 1);
}

/** When a booking of some days, paid at paidAt, stops showing. */
export const daysUntil = (paidAt: number, days: number) => paidAt + clampDays(days) * DAY_MS;

/** Quick picks for days. */
export const DAY_OPTIONS = [1, 7, 14, 30];

/** Price for a number of showings on a kind of board, on one face or both. */
export function boardPrice(showings: number, type: BoardType, face: BoardFace | "both"): number {
  return Math.round(adPrice(showings) * BOARDS[type].priceFactor) * (face === "both" ? 2 : 1);
}

/** When a booking stops showing (old bookings without an end run for their showings on a full classic face). */
export function bookingUntil(b: Pick<AdBooking, "paidAt" | "showings" | "until" | "type">): number {
  const spec = BOARDS[b.type ?? "classic"];
  return b.until ?? bookingEnds(b.paidAt, b.showings, spec.slotMs, spec.queue);
}

/** Whether a booking runs on this face. */
export const onFace = (b: Pick<AdBooking, "face">, face: BoardFace) => (b.face ?? "both") === "both" || b.face === face;

/** Words that make an ad political: no paying to campaign on a billboard. */
const POLITICAL = [
  "vote", "votes", "voting", "elect", "election", "campaign", "candidate", "governor", "president",
  "presidential", "senator", "senate", "chairman", "councillor", "lawmaker", "inec", "manifesto", "aspirant",
];

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Why this ad text can't be booked, or null if it can. */
export function adTextProblem(title: string, details = ""): string | null {
  const t = title.trim();
  if (t.length < 2) return "Give your business name";
  if (t.length > 40) return "Keep the name to 40 characters";
  const all = `${t} ${details}`;
  const w = words(all);
  // Party codes as words, except one-letter codes ("A"), which would catch every "a". Names catch those.
  const codes = new Set(PARTIES.map((p) => p.code.toLowerCase()).filter((c) => c.length > 1));
  const lower = all.toLowerCase();
  if (w.some((x) => POLITICAL.includes(x) || codes.has(x)) || PARTIES.some((p) => lower.includes(p.name.toLowerCase())))
    return "Billboards are for businesses. Political promotion is not allowed here: use flyers and sponsored news in the Campaign tab";
  if (w.some((x) => BLOCKED_WORDS.includes(x))) return "Keep the ad positive";
  if (/https?:|www\./.test(lower)) return "No links on the board";
  return null;
}

/** Link shorteners hide where a link goes, so they are refused: the player should see the real site. */
const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rb.gy", "shorturl.at", "tiny.cc", "lnkd.in", "s.id"]);

/**
 * A business's website link, checked: https only, a real domain, no login details in it, no shorteners,
 * and no campaign site (the same political words as the board text, in the address).
 */
export function cleanAdLink(raw: string): { url: string } | { error: string } {
  const t = raw.trim();
  if (!t) return { error: "Enter the link" };
  if (t.length > 200) return { error: "That link is too long" };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return { error: "That doesn't look like a website address" };
  }
  if (u.protocol !== "https:") return { error: "Only secure links (https) are allowed" };
  if (u.username || u.password) return { error: "Links can't carry login details" };
  const host = u.hostname.toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) || host.startsWith(".") || host.includes("..")) return { error: "Use a website address like mamaronke.com" };
  if (SHORTENERS.has(host.replace(/^www\./, ""))) return { error: "Use your real website address, not a short link" };
  // The path and the query (?vote=...) are both checked, decoded where they can be.
  let path = `${u.pathname} ${u.search}`;
  try {
    path = decodeURIComponent(path.replace(/\+/g, " "));
  } catch {
    // A broken %-escape: check the address as written.
  }
  const addr = words(`${host} ${path}`);
  const codes = new Set(PARTIES.map((p) => p.code.toLowerCase()).filter((c) => c.length > 1));
  if (addr.some((x) => POLITICAL.includes(x) || codes.has(x))) return { error: "Billboards are for businesses. Campaign websites are not allowed" };
  if (addr.some((x) => BLOCKED_WORDS.includes(x))) return { error: "Keep the link positive" };
  u.hash = "";
  return { url: u.toString() };
}

/** The site a link goes to, for the "you're leaving" check: the hostname without www. */
export const linkHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Showings you can buy at once, and their price. */
export const SHOWING_OPTIONS = [100, 500, 1000, 5000];
export const bookingPrice = adPrice;

/**
 * Simulated payment: always succeeds after a short wait, with a reference marked as a test. The real
 * flow will open Paystack's checkout and confirm the payment on the server.
 */
export async function simulatePayment(amount: number, wait = 1500): Promise<{ ok: true; ref: string; paidAt: number } | { ok: false; reason: string }> {
  if (!(amount > 0)) return { ok: false, reason: "Nothing to pay" };
  await new Promise((done) => setTimeout(done, wait));
  const paidAt = Date.now();
  return { ok: true, ref: `NV-TEST-${paidAt.toString(36).toUpperCase()}`, paidAt };
}
