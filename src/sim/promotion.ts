// Getting on at work (owner, 9 Oct 2026). One day in the game pays a month's salary, so a season is a whole
// career: every 5 days worked there is a review. A promotion gives a new title and a 10 to 20% raise on a salary,
// or, for traders, artisans and other people paid by the day or by the deal, more customers (15% more takings
// per level). Handling what comes up on shift helps; missing days hurts. A new job starts again at the bottom.
import type { CareerId } from "../data/careers";
import type { Rng } from "./rng";
import { log, naira, note, type GameState } from "./state";
import { dayNum } from "./time";

export const REVIEW_EVERY = 5;
export const MAX_LEVEL = 4;
/** Titles by level on a salary: "Senior Tailor", "Head Accountant". */
const PREFIX = ["", "Senior ", "Lead ", "Head ", "Chief "];
/** Students get an allowance and corps members a fixed allawee: nobody promotes them. */
const NO_PROMOTION: CareerId[] = ["student", "corper"];

export interface Promo {
  /** The job title this record is for; a different title means a new job. */
  job: string;
  /** The title without its level prefix. */
  base: string;
  level: number;
  /** Days worked since the last review, tasks handled since then, and the day that stretch began. */
  days: number;
  tasks: number;
  since: number;
}

/** The citizen's record at their current job, fresh if they have just started it. */
export function promoOf(s: GameState): Promo | null {
  const c = s.citizen;
  if (!c) return null;
  const p = c.promo;
  return p && p.job === c.job ? p : { job: c.job, base: c.job, level: 0, days: 0, tasks: 0, since: dayNum(s.t) };
}

/** How much more a day's takings are, for people paid by the day or the deal, at their level. */
export const takingsBoost = (s: GameState) => 1 + 0.15 * (promoOf(s)?.level ?? 0);

/** Mutates s: tasks handled on a shift count towards the next review. */
export function noteTasks(s: GameState, handled: number) {
  const p = promoOf(s);
  if (!p || !s.citizen || handled <= 0) return;
  s.citizen.promo = { ...p, tasks: p.tasks + handled };
}

/** Chance of a promotion at a review: better for tasks handled, worse for days missed in the stretch. */
export const promotionChance = (tasks: number, missed: number) => Math.min(95, Math.max(10, 50 + 5 * tasks - 10 * missed)) / 100;

/** Mutates s: a day worked. Every REVIEW_EVERY days there is a review. Returns a line for the toast if promoted. */
export function workedDay(s: GameState, salaried: boolean, rng: Rng): string | null {
  const c = s.citizen;
  const p = promoOf(s);
  if (!c || !p || NO_PROMOTION.includes(c.career)) return null;
  const today = dayNum(s.t);
  const days = p.days + 1;
  if (days < REVIEW_EVERY || p.level >= MAX_LEVEL) {
    c.promo = { ...p, days: Math.min(days, REVIEW_EVERY) };
    return null;
  }
  // The review: days that passed in the stretch without work count against you.
  const missed = Math.max(0, today - p.since + 1 - REVIEW_EVERY);
  const fresh = { ...p, days: 0, tasks: 0, since: today + 1 };
  if (rng() >= promotionChance(p.tasks, missed)) {
    c.promo = fresh;
    log(s, missed ? `Your review came and went. Missing ${missed} days didn't help.` : "Your review came and went. No promotion this time.");
    return null;
  }
  const level = p.level + 1;
  if (salaried) {
    const before = c.monthlyPay;
    c.monthlyPay = Math.round((before * (1.1 + rng() * 0.1)) / 1000) * 1000;
    c.job = PREFIX[level] + p.base;
    c.promo = { ...fresh, job: c.job, level };
    note(s, "You got promoted", `You are now ${c.job}. Your pay goes up from ${naira(before)} to ${naira(c.monthlyPay)}.`);
    log(s, `Promoted to ${c.job} on ${naira(c.monthlyPay)}.`);
    return `Promoted: ${c.job}`;
  }
  c.promo = { ...fresh, level };
  note(s, "Business is growing", `More customers know you now. Your takings are up ${level * 15}% on when you started.`);
  log(s, `Business grew: takings up ${level * 15}%.`);
  return "Business is growing";
}
