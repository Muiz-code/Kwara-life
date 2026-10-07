// Campaigning without chat: one support card a day, and paid flyers and sponsored news (docs/DESIGN.md).
// Promotion is paid with in-game money only, has the same prices for every party, a daily cap, and stops
// 24 hours before polls open. It never changes how simulated voters vote.
import { PRESIDENTIAL_2027, campaigningAllowed } from "../data/calendar";
import { BLOCKED_WORDS, DAILY_PROMO_CAP, ISSUES, MAX_ISSUES, NOTE_MAX, PROMO, SIM_NAMES } from "../data/campaign";
import { PARTIES, PARTY } from "../data/parties";
import { STATES } from "../data/states";
import type { CivicContext } from "./civic";
import { watDate } from "./civic";
import { seeded } from "./rng";
import { clone, log, naira, type GameState, type Promo, type SupportCard } from "./state";

/** A note is fine if it has no blocked words and no links. */
export function cleanNote(text: string): boolean {
  const l = text.toLowerCase();
  if (/https?:|www\.|\.com\b|\.ng\b/.test(l)) return false;
  return !BLOCKED_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(l));
}

export const CIVIC_PROMO = "civic";

export function promoLabel(p: Pick<Promo, "kind" | "party">): string {
  const what = p.party === CIVIC_PROMO ? "Go out and vote on election day" : `Vote ${p.party}, ${PARTY[p.party].name}`;
  return `${p.kind === "flyer" ? "Flyer" : "Sponsored"}: ${what}`;
}

export const spentToday = (s: GameState, now: number) =>
  s.promos.filter((p) => p.day === watDate(now)).reduce((sum, p) => sum + p.price, 0);

export interface CardInput {
  party: string;
  issues: string[];
  note: string;
}

/** Post today's support card. Public: your support is public, your vote is secret. */
export function postSupportCard(state: GameState, input: CardInput, ctx: CivicContext): GameState | { blocked: string } {
  const cal = ctx.cal ?? PRESIDENTIAL_2027;
  if (!state.citizen) return { blocked: "Create your citizen first" };
  if (!campaigningAllowed(cal, ctx.now)) return { blocked: "Campaigning has ended. All campaigns stop 24 hours before election day" };
  if (!PARTY[input.party]) return { blocked: "Pick a party" };
  const issues = [...new Set(input.issues)];
  if (issues.length > MAX_ISSUES) return { blocked: `Pick up to ${MAX_ISSUES} issues` };
  if (issues.some((i) => !(ISSUES as readonly string[]).includes(i))) return { blocked: "Pick issues from the list" };
  const note = input.note.trim();
  if (note.length > NOTE_MAX) return { blocked: `Keep the note to ${NOTE_MAX} characters` };
  if (note && !cleanNote(note)) return { blocked: "That note can't be posted. Keep it positive, no links" };
  const day = watDate(ctx.now);
  if (state.supportCards.some((c) => c.day === day)) return { blocked: "You have posted today. Come back tomorrow" };
  const s = clone(state);
  const card: SupportCard = { party: input.party, issues, note, day };
  s.supportCards.push(card);
  log(s, `You posted a support card for ${input.party}.`);
  return s;
}

export interface PromoInput {
  kind: "flyer" | "news";
  option: number;
  /** Party code or "civic". */
  party: string;
}

/** Pay for flyers or a sponsored news message. Flyers are posted at the notice board in your LGA. */
export function buyPromo(state: GameState, input: PromoInput, ctx: CivicContext): { state: GameState; promo: Promo } | { blocked: string } {
  const cal = ctx.cal ?? PRESIDENTIAL_2027;
  const c = state.citizen;
  if (!c) return { blocked: "Create your citizen first" };
  if (!campaigningAllowed(cal, ctx.now)) return { blocked: "No promotion during the blackout" };
  const opt = PROMO[input.kind][input.option];
  if (!opt) return { blocked: "Pick an option" };
  if (input.party !== CIVIC_PROMO && !PARTY[input.party]) return { blocked: "Pick a party" };
  if (opt.price > state.money) return { blocked: "Not enough money" };
  if (spentToday(state, ctx.now) + opt.price > DAILY_PROMO_CAP) return { blocked: `Daily promotion cap is ${naira(DAILY_PROMO_CAP)}` };
  const s = clone(state);
  const promo: Promo = { kind: input.kind, option: input.option, party: input.party, price: opt.price, day: watDate(ctx.now), lgaCode: c.lgaCode };
  s.money -= opt.price;
  s.promos.push(promo);
  log(s, `You paid ${naira(opt.price)} for ${input.kind === "flyer" ? "flyers" : "a sponsored news message"}.`);
  s.toasts.push(input.kind === "flyer" ? "Flyers posted" : "Live on NVT News today");
  return { state: s, promo };
}

/** Sponsored news line as players see it: who paid is always shown. */
export const sponsoredLine = (p: Promo, by: string) => `${promoLabel(p)} (paid for by ${by})`;

/** Simulated supporters for the feed when the server feed is empty or offline. Parties picked with equal odds. */
export function simulatedCards(seed: number, n = 10): (SupportCard & { by: string; place: string; simulated: true })[] {
  const R = seeded(seed);
  return Array.from({ length: n }, () => ({
    by: SIM_NAMES[Math.floor(R() * SIM_NAMES.length)],
    party: PARTIES[Math.floor(R() * PARTIES.length)].code,
    issues: [ISSUES[Math.floor(R() * ISSUES.length)]],
    note: "",
    day: "",
    place: STATES[Math.floor(R() * STATES.length)].name,
    simulated: true as const,
  }));
}
