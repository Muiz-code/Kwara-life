// Working for money, by career (src/data/careers.ts).
import { CAREERS, WORKDAYS_PER_MONTH } from "../data/careers";
import type { Rng } from "./rng";
import { naira, type GameState } from "./state";
import { dayNum } from "./time";

export const HEAT_MAX = 100;

/** Why the citizen cannot work right now (beyond opening hours), or null. */
export function workBlockReason(s: GameState, place: { gen: boolean }): string | null {
  const c = s.citizen;
  if (!c) return null;
  const career = CAREERS[c.career];
  if (!c.employed) return "You don't have a job yet. Apply at the notice board or town hall";
  if (c.career === "student" && (s.events.strikeUntil ?? 0) >= dayNum(s.t)) return "ASUU is on strike. No lectures";
  if (career.needsLight && !s.light && !place.gen) return "NEPA took light. No light, no work";
  if (s.flags.shiftDay === dayNum(s.t)) return "You already worked today";
  return null;
}

export interface WorkResult {
  earned: number;
  /** Pay held back because salary is owed. */
  owed: number;
  msg: string;
  toast: string;
}

/** Mutates s: a work session's pay and EFCC heat. */
export function doWork(s: GameState, rng: Rng): WorkResult {
  const c = s.citizen!;
  const career = CAREERS[c.career];
  const job = c.job.toLowerCase();
  s.flags.shiftDay = dayNum(s.t);
  if (career.heat) s.heat = Math.min(HEAT_MAX, s.heat + career.heat);

  let earned = 0;
  let msg: string;
  if (career.pay === "salary") {
    earned = Math.round(c.monthlyPay / WORKDAYS_PER_MONTH);
    msg = c.career === "student" ? "You sat through lectures. Your allowance from home came in." : `A full day as a ${job}.`;
  } else if (career.pay === "daily") {
    earned = Math.round((career.min + rng() * (career.max - career.min)) / 50) * 50;
    msg = earned < (career.min + career.max) / 3 ? `Slow day as a ${job}. Customers no dey.` : `Good day as a ${job}.`;
  } else if (rng() < (career.hitChance ?? 0)) {
    earned = Math.round((career.min + Math.pow(rng(), 2) * (career.max - career.min)) / 1000) * 1000;
    msg = c.career === "creator" ? "Your video went viral and a brand paid you." : c.career === "founder" ? "An investor wired money." : "It landed.";
  } else {
    msg = c.career === "creator" ? "You posted. Small views today." : c.career === "founder" ? "Long day building. No money yet." : "Nothing landed today.";
  }

  let owed = 0;
  if (career.pay === "salary" && c.career === "worker" && (s.events.owedUntil ?? 0) >= dayNum(s.t)) {
    owed = earned;
    s.payOwed += earned;
    earned = 0;
    msg += " Salary is owed again, so nothing entered your account.";
  }
  s.money += earned;
  if (earned) msg += ` You earned ${naira(earned)}.`;
  return { earned, owed, msg, toast: earned ? "+" + naira(earned) : owed ? "Salary owed" : "No money today" };
}
