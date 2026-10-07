import type { Action } from "../data/action";
import { PLACE } from "../data/ilorin/places";
import { PAY } from "../data/jobs";
import type { GameState } from "./state";
import { clone, log, naira, note } from "./state";
import type { Rng } from "./rng";
import { DAY_PLURALS, dayNum, dayOfWeek, fmtHour, hourOf, isOpen } from "./time";
import { advance, applyFx, clamp } from "./needs";
import { befriend } from "./friends";
import { checkCritical } from "./critical";
import { civicBlockReason, watDate, type CivicContext } from "./civic";
import { currentHeadline, mediaInformed, mediaShow } from "./media";
import { CAREERS } from "../data/careers";
import { doWork, workBlockReason } from "./work";
import { POS_CHARGE, cashScarcity } from "./naija-life";

export const BASIRA_DISCOUNT_HEARTS = 3;
export const BASIRA_AMALA_PRICE = 1800;
export const DRY_TAP_CHANCE = 0.3;

export function actionCost(s: GameState, a: Action): number {
  if (a.id === "amala" && s.friends.basira >= BASIRA_DISCOUNT_HEARTS) return BASIRA_AMALA_PRICE;
  const base = a.cost ?? 0;
  // Cash scarcity: POS agents charge extra on anything you pay for.
  return base && s.citizen && cashScarcity(s) ? base + POS_CHARGE : base;
}

export const horseToday = (s: GameState) => s.horseDay === dayNum(s.t);

/** The place an action happens at: its name, opening hours and whether it has a generator. */
export interface PlaceInfo {
  name: string;
  open: [number, number];
  gen: boolean;
}

/**
 * Extra context for an action. Ilorin actions need none. Generated LGA maps pass their place,
 * and civic actions (PVC, vote, vote buying, flyers, media) need the real time.
 */
export interface ActionContext extends Partial<CivicContext> {
  place?: PlaceInfo;
  /** Today's sponsored news lines, already labelled with who paid. */
  sponsored?: string[];
  /** Live headlines; falls back to the built-in civic news. */
  headlines?: string[];
}

export const SHELTER_BED_CHANCE = 0.35;
export const PVC_NOT_READY_CHANCE = 0.3;

/** Game minutes an action takes (work shifts last as long as the class's shift). */
export const actionMinutes = (s: GameState, a: Action) =>
  a.shift && s.citizen ? (CAREERS[s.citizen.career]?.shiftMinutes ?? PAY[s.citizen.cls].shiftMinutes) : a.dur;

/** Why the action can't be done right now, or null if it can. */
export function blockReason(s: GameState, a: Action, ctx: ActionContext = {}): string | null {
  const p = ctx.place ?? PLACE[s.loc];
  const h = hourOf(s.t);
  const d = dayOfWeek(s.t);
  if (a.home && s.homeId !== s.loc) return s.loc === "home" ? "You moved out of this place" : "You don't live here yet";
  if (a.rent && s.homeId === s.loc) return "You already live here";
  if (!isOpen(p, h)) return `${p.name} is closed now`;
  if (a.hours && !(h >= a.hours[0] && h < a.hours[1])) return `Only from ${fmtHour(a.hours[0])} to ${fmtHour(a.hours[1])}`;
  if (a.day !== undefined && d !== a.day) return `Only on ${DAY_PLURALS[a.day]}`;
  if (a.days && !a.days.includes(d)) return "Only on weekends";
  if (a.weekdays && d > 4) return "Offices are closed on weekends";
  if (a.noDay !== undefined && d === a.noDay) return "Closed on Sundays";
  if (a.once && s.flags[a.once] !== undefined) return "Already done. Wait for their call";
  if (a.job && !s.flags.job) return s.flags.applied !== undefined ? "Wait for the Ministry to call you" : "Submit your CV first";
  if (a.job && s.flags.worked === dayNum(s.t)) return "You already worked today";
  if (a.horse && horseToday(s)) return "You already have a horse today";
  if (a.goal && s.goals[a.goal]) return "Already done";
  if (a.light && !s.light && !p.gen) return "NEPA took light";
  if (a.usesFood && s.groceries <= 0) {
    return s.citizen && !PLACE[s.loc] ? "No foodstuff at home. Buy some at the market" : "No foodstuff at home. Buy some at Oja Oba, Oke-Odo or Palms Mall";
  }
  const civic = civicBlockReason(s, a, { now: ctx.now ?? 0, cal: ctx.cal });
  if (civic) return civic;
  if (a.shift) {
    const w = workBlockReason(s, p);
    if (w) return w;
  }
  if (a.minSkill && s.skill < a.minSkill) return `Needs skill ${a.minSkill}. Learn at the Innovation Hub or KWASU library`;
  if (actionCost(s, a) > s.money) return "Not enough money";
  return null;
}

/** What starting an action decided, carried through to finishAction. */
export interface ActionPlan {
  action: Action;
  /** Game minutes the clock runs for. */
  dur: number;
  cost: number;
  sleep: boolean;
  /** Text added before the done message. */
  pre: string;
}

/** Actions that open their own screen instead of running the clock. */
export type ActionFlow = "vote" | "bribe" | "flyer";

/**
 * Start an action. Returns the new state and the plan, a reason it is blocked, or the screen to open
 * (ballot, vote-buying offer, flyer promotion). The caller runs the clock for plan.dur minutes (advance),
 * then calls finishAction.
 */
export function startAction(
  state: GameState,
  a: Action,
  rng: Rng,
  ctx: ActionContext = {},
): { state: GameState; plan: ActionPlan } | { blocked: string } | { flow: ActionFlow } {
  const why = blockReason(state, a, ctx);
  if (why) return { blocked: why };
  if (a.vote) return { flow: "vote" };
  if (a.bribe) return { flow: "bribe" };
  if (a.flyer) return { flow: "flyer" };
  const s = clone(state);
  let dur = actionMinutes(s, a);
  let pre = "";
  if (a.water && rng() < DRY_TAP_CHANCE) {
    dur += 30;
    s.needs.energy = clamp(s.needs.energy - 6);
    pre = "Tap no run, so you fetched water from the well first. ";
  }
  return { state: s, plan: { action: a, dur, cost: actionCost(s, a), sleep: !!a.sleep, pre } };
}

/** Apply an action's results once its time has passed. */
export function finishAction(state: GameState, plan: ActionPlan, rng: Rng, ctx: ActionContext = {}): GameState {
  const s = clone(state);
  const a = plan.action;
  s.money -= plan.cost;
  if (a.earn) s.money += a.earn;
  if (a.tip) s.money += a.tip;
  applyFx(s, a.fx);
  if (a.groc) s.groceries += a.groc;
  if (a.usesFood) s.groceries--;
  if (a.skill) s.skill = Math.round((s.skill + a.skill) * 10) / 10;
  if (a.once) s.flags[a.once] = s.t;
  if (a.job) s.flags.worked = dayNum(s.t);
  if (a.horse) s.horseDay = dayNum(s.t);
  if (a.rent) {
    s.homeId = s.loc;
    note(s, "New home", `Welcome to ${(ctx.place ?? PLACE[s.loc]).name}. This is now where you sleep, bath and cook.`);
  }
  if (a.goal && !s.goals[a.goal]) {
    s.goals[a.goal] = true;
    note(s, "Goal reached", a.done);
  }
  let msg = plan.pre + a.done;
  let toast = a.earn ? "+" + naira(a.earn) : a.done;
  if (a.friend) msg += " " + befriend(s, a.friend, rng);
  if (a.earn) msg += ` You earned ${naira(a.earn)}.`;

  // ---- Naija Votes ----
  const c = s.citizen;
  if (a.informed) s.informed += a.informed;
  if (a.civic) s.civic += a.civic;
  if (c && a.shift) {
    const w = doWork(s, rng);
    msg = w.msg;
    toast = w.toast;
  }
  if (c && a.buy) {
    if (a.buy === "tv") c.ownsTv = true;
    else c.ownsRadio = true;
    toast = a.buy === "tv" ? "New TV!" : "New radio!";
  }
  if (a.media) {
    s.informed += mediaInformed(a.media);
    const show = mediaShow(a.media, s, rng, ctx.sponsored, ctx.headlines);
    note(s, show.title, show.lines.join("\n"));
    msg = `${a.done} ${currentHeadline(s.t, ctx.headlines)}`;
  }
  if (a.overhear) {
    s.informed++;
    msg += ` Someone said: "${currentHeadline(s.t, ctx.headlines)}"`;
  }
  if (c && a.pvcAct === "register") {
    c.pvc = "registered";
    c.registeredAt = ctx.now ?? null;
  }
  if (c && a.pvcAct === "collect") {
    if (rng() < PVC_NOT_READY_CHANCE) {
      s.flags.pvcTurnedAway = watDate(ctx.now ?? 0);
      msg = "INEC said your PVC is not ready. Come back tomorrow.";
    } else {
      c.pvc = "have";
      msg = "You collected your PVC.";
      note(s, "PVC collected", "Keep it safe and bring it to your polling unit on election day.");
    }
    toast = msg;
  }
  if (c && a.shelter) {
    if (rng() < SHELTER_BED_CHANCE) {
      c.underFlyover = false;
      c.wasUnder = true;
      c.home = "Bed at the shelter";
      msg = "The shelter had a bed. You sleep indoors now.";
      note(s, "A bed indoors", "From today your home is the shelter. You can sleep, bath and cook there.");
    } else {
      msg = "The shelter was full today.";
    }
    toast = msg;
  }

  log(s, msg);
  if (toast) s.toasts.push(toast);
  checkCritical(s, rng);
  return s;
}

/** Start, run the clock, and finish in one go. Actions with their own screen come back as { flow }. */
export function performAction(state: GameState, a: Action, rng: Rng, ctx: ActionContext = {}): GameState | { blocked: string } | { flow: ActionFlow } {
  const started = startAction(state, a, rng, ctx);
  if (!("plan" in started)) return started;
  const s = clone(started.state);
  advance(s, started.plan.dur, rng, { sleep: started.plan.sleep });
  return finishAction(s, started.plan, rng, ctx);
}
