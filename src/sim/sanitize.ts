// Checks a saved game before it is loaded. Anything that came from outside the game (localStorage
// today, a client request to an edge function later) is untrusted: wrong types, impossible numbers
// or a job that was never on a board mean the save is rejected. Values that can drift by rounding
// are clamped instead.
import { CAREERS, EDUCATION_RANK } from "../data/careers";
import { FURNITURE_IDS } from "../data/furniture";
import { isHomeStyle } from "../data/homestyle";
import { PHONE } from "../data/phones";
import { LGA } from "../data/geography";
import { PARTY } from "../data/parties";
import { CAR, HOUSE, OUTFIT } from "../data/shops";
import { maxMonthly, openingById } from "./jobs";
import { MAX_LEVEL } from "./promotion";
import { clamp } from "./needs";
import { cleanBank } from "./bank";
import { STATE } from "../data/states";
import { freshState, type GameState } from "./state";

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** ₦10bn: far beyond what the richest roll plus a season of founder hits can reach. */
export const MONEY_CEILING = 10_000_000_000;

/** A safe copy of a saved game, or null if it can't be trusted. */
export function sanitizeGame(raw: unknown): GameState | null {
  if (!obj(raw)) return null;
  const g = { ...freshState(), ...(raw as Partial<GameState>), toasts: [] } as GameState;

  for (const k of ["t", "money", "groceries", "skill", "horseDay", "informed", "civic", "heat", "payOwed"] as const)
    if (!num(g[k])) return null;
  if (g.t < 0 || g.money > MONEY_CEILING || g.money < -MONEY_CEILING || g.payOwed < 0 || g.payOwed > MONEY_CEILING) return null;
  if (typeof g.loc !== "string" || typeof g.homeId !== "string" || typeof g.inside !== "boolean" || typeof g.light !== "boolean") return null;

  if (!obj(g.needs)) return null;
  const needs = freshState().needs;
  for (const k of Object.keys(needs) as (keyof typeof needs)[]) {
    if (!num(g.needs[k])) return null;
    needs[k] = clamp(g.needs[k]);
  }
  g.needs = needs;
  g.heat = clamp(g.heat);
  g.informed = Math.max(0, g.informed);
  g.civic = Math.max(0, g.civic);
  g.groceries = Math.max(0, Math.round(g.groceries));

  if (!obj(g.friends) || !Object.values(g.friends).every(num)) return null;
  if (!obj(g.bribeEffects) || !Object.entries(g.bribeEffects).every(([p, n]) => PARTY[p] && num(n) && n >= 0)) return null;
  if (!strings(g.voted) || !strings(g.localNews) || !Array.isArray(g.log) || !Array.isArray(g.notes)) return null;
  if (!strings(g.furniture) || !g.furniture.every((f) => FURNITURE_IDS.has(f))) return null;
  g.furniture = [...new Set(g.furniture)];
  if (g.homeStyle !== null && !isHomeStyle(g.homeStyle)) return null;
  const bank = cleanBank((raw as Partial<GameState>).bank, MONEY_CEILING);
  if (!bank) return null;
  g.bank = bank;
  if (g.phone !== null && !(typeof g.phone === "string" && PHONE[g.phone])) return null;
  if (g.interview !== null) {
    const iv = g.interview;
    const o = obj(iv) && typeof iv.id === "string" ? openingById(iv.id) : undefined;
    if (!o || iv.monthly !== o.monthly || iv.career !== o.career || !num(iv.until) || typeof iv.accepted !== "boolean") return null;
  }
  if (!Array.isArray(g.supportCards) || !Array.isArray(g.promos) || !Array.isArray(g.applications)) return null;
  if (!obj(g.flags) || !obj(g.events) || !obj(g.seen) || !obj(g.goals) || !obj(g.friendDay)) return null;
  if (g.at !== null && !LGA[g.at as string]) return null;
  if (!strings(g.visited) || !g.visited.every((c) => Object.hasOwn(STATE, c))) return null;
  g.visited = [...new Set(g.visited)];
  // Saves from before the Explorer mission: your own state counts.
  const homeState = (g.citizen as { stateCode?: string } | null)?.stateCode;
  if (homeState && Object.hasOwn(STATE, homeState) && !g.visited.includes(homeState)) g.visited = [homeState, ...g.visited];
  if (!num(g.connections)) return null;
  g.connections = Math.max(0, Math.min(100, Math.round(g.connections)));
  const st = g.standing as unknown;
  const okStanding = obj(st) && (st.toward === null || ["poor", "middle", "rich"].includes(st.toward as string)) && num(st.days) && num(st.connDay) && num(st.connToday);
  g.standing = okStanding ? g.standing : { toward: null, days: 0, connDay: -1, connToday: 0 };
  // Things you own must be things the shops sell.
  if (g.car !== null && !(typeof g.car === "string" && Object.hasOwn(CAR, g.car))) return null;
  if (g.house !== null && !(typeof g.house === "string" && Object.hasOwn(HOUSE, g.house))) return null;
  if (g.outfit !== null && !(typeof g.outfit === "string" && Object.hasOwn(OUTFIT, g.outfit))) return null;

  // Every pending application must match an opening that was really on a board.
  for (const a of g.applications) {
    const o = obj(a) && typeof a.id === "string" ? openingById(a.id) : undefined;
    if (!o || a.monthly !== o.monthly || a.career !== o.career || a.minEducation !== o.minEducation || a.applicants !== o.applicants) return null;
    if (!num(a.decideDay)) return null;
  }

  const c = g.citizen;
  if (c !== null) {
    if (!obj(c) || !LGA[c.lgaCode] || LGA[c.lgaCode].stateCode !== c.stateCode) return null;
    if (!Object.hasOwn(CAREERS, c.career) || !Object.hasOwn(EDUCATION_RANK, c.education)) return null;
    if (!["poor", "middle", "rich"].includes(c.cls) || !["none", "registered", "have", "seized"].includes(c.pvc)) return null;
    if (typeof c.name !== "string" || !c.name.trim() || c.name.length > 16) return null;
    // Promotions raise pay up to four times, 20% at most each: allow a little over double the career's top pay.
    if (!num(c.monthlyPay) || c.monthlyPay < 0 || c.monthlyPay > maxMonthly(c.career) * 2.1) return null;
    if (c.promo !== undefined) {
      const p = c.promo;
      if (!obj(p) || typeof p.job !== "string" || typeof p.base !== "string" || ![p.level, p.days, p.tasks, p.since].every(num)) return null;
      if (p.level < 0 || p.level > MAX_LEVEL || p.days < 0 || p.tasks < 0) return null;
    }
    if (!num(c.createdAt) || typeof c.puCode !== "string" || !c.puCode.startsWith(`${c.lgaCode}/`)) return null;
  }
  return g;
}
