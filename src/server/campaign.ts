// Campaigning on the server (Phase E3). A save can add support cards, flyers and sponsored news, and votes bought;
// the server checks each new one with the game's own rules before it counts. Anything that breaks a rule is left
// out, and the save is corrected to match. Pure, so the rules are tested without a database.
import { PRESIDENTIAL_2027, campaigningAllowed, type ElectionCalendar } from "../data/calendar";
import { DAILY_PROMO_CAP, ISSUES, MAX_ISSUES, NOTE_MAX, PROMO } from "../data/campaign";
import { PARTY } from "../data/parties";
import { CIVIC_PROMO, cleanNote } from "../sim/campaign";
import { watDate } from "../sim/civic";
import type { GameState, Promo, SupportCard } from "../sim/state";
import { GROUPS } from "../sim/vote-buying";

/** A save uploads every few minutes: something done just before a deadline still counts this long after. */
export const CAMPAIGN_GRACE_MS = 15 * 60_000;
/** Votes one citizen can buy in a day: two of the biggest groups, all of them voting as paid. */
export const BRIBE_DAY_CAP = 2 * Math.max(...GROUPS);

export interface CampaignAdds {
  cards: SupportCard[];
  promos: Promo[];
  /** Votes bought since the last save, by party. */
  bribes: Record<string, number>;
  /** The save had to be corrected (something left out). */
  changed: boolean;
}

/** Days a save may still date something to: today, or yesterday within the grace. */
const days = (now: number) => new Set([watDate(now), watDate(now - CAMPAIGN_GRACE_MS)]);
const open = (cal: ElectionCalendar, now: number) => campaigningAllowed(cal, now) || campaigningAllowed(cal, now - CAMPAIGN_GRACE_MS);

function cardOk(c: SupportCard, ok: Set<string>): boolean {
  if (!c || typeof c !== "object" || typeof c.party !== "string" || !Object.hasOwn(PARTY, c.party)) return false;
  if (!Array.isArray(c.issues) || c.issues.length > MAX_ISSUES || new Set(c.issues).size !== c.issues.length) return false;
  if (!c.issues.every((i) => (ISSUES as readonly string[]).includes(i))) return false;
  if (typeof c.note !== "string" || c.note.length > NOTE_MAX || (c.note.trim() && !cleanNote(c.note))) return false;
  return ok.has(c.day);
}

function promoOk(p: Promo, ok: Set<string>, lga: string): boolean {
  if (!p || typeof p !== "object" || !Object.hasOwn(PROMO, p.kind)) return false;
  const opt = Number.isInteger(p.option) ? PROMO[p.kind][p.option] : undefined;
  if (!opt || p.price !== opt.price) return false;
  if (p.party !== CIVIC_PROMO && !Object.hasOwn(PARTY, p.party)) return false;
  return ok.has(p.day) && p.lgaCode === lga;
}

const key = (p: Promo) => `${p.kind}|${p.option}|${p.party}|${p.day}|${p.price}`;

/**
 * What a save adds over the one before, checked. Mutates `game` to leave out anything that doesn't count.
 * bribedToday: votes this citizen already bought today, from the server.
 */
export function reconcileCampaign(before: GameState | null, game: GameState, now: number, bribedToday: number, cal: ElectionCalendar = PRESIDENTIAL_2027): CampaignAdds {
  const out: CampaignAdds = { cards: [], promos: [], bribes: {}, changed: false };
  const c = game.citizen;
  if (!c) return out;
  const ok = days(now);
  const canCampaign = open(cal, now);

  // Support cards: one a day, from the lists, a clean note, while campaigning is open.
  const had = new Set((before?.supportCards ?? []).map((x) => x.day));
  const cards: SupportCard[] = [];
  for (const card of game.supportCards) {
    if (had.has(card.day)) {
      cards.push(card);
      continue;
    }
    if (canCampaign && cardOk(card, ok)) {
      had.add(card.day);
      cards.push(card);
      out.cards.push(card);
    } else out.changed = true;
  }
  game.supportCards = cards;

  // Flyers and sponsored news: the listed options at their price, in your LGA, under the daily cap.
  const left = new Map<string, number>();
  for (const p of before?.promos ?? []) left.set(key(p), (left.get(key(p)) ?? 0) + 1);
  const spent = new Map<string, number>();
  for (const p of before?.promos ?? []) spent.set(p.day, (spent.get(p.day) ?? 0) + (Number(p.price) || 0));
  const promos: Promo[] = [];
  for (const p of game.promos) {
    const n = left.get(key(p)) ?? 0;
    if (n > 0) {
      left.set(key(p), n - 1);
      promos.push(p);
      continue;
    }
    const total = (spent.get(p.day) ?? 0) + p.price;
    if (canCampaign && promoOk(p, ok, c.lgaCode) && total <= DAILY_PROMO_CAP) {
      spent.set(p.day, total);
      promos.push(p);
      out.promos.push(p);
    } else out.changed = true;
  }
  game.promos = promos;

  // Votes bought: never fewer than before, never more than the day's limit, only until polls close.
  let room = now < Date.parse(cal.pollsClose) ? Math.max(0, BRIBE_DAY_CAP - bribedToday) : 0;
  const effects: Record<string, number> = { ...(before?.bribeEffects ?? {}) };
  for (const [party, n] of Object.entries(game.bribeEffects)) {
    if (!Object.hasOwn(PARTY, party)) {
      out.changed = true;
      continue;
    }
    const was = effects[party] ?? 0;
    const want = Math.max(0, Math.floor(n) - was);
    const take = Math.min(want, room);
    room -= take;
    if (take) out.bribes[party] = take;
    effects[party] = was + take;
    if (take !== Math.floor(n) - was) out.changed = true;
  }
  game.bribeEffects = effects;
  return out;
}
