import type { Action } from "../data/actions";
import { PLACE } from "../data/locations";
import type { GameState } from "./state";
import { clone, log, naira, note } from "./state";
import type { Rng } from "./rng";
import { DAY_PLURALS, dayNum, dayOfWeek, fmtHour, hourOf, isOpen } from "./time";
import { advance, applyFx, clamp } from "./needs";
import { befriend } from "./friends";
import { checkCritical } from "./critical";

export const BASIRA_DISCOUNT_HEARTS = 3;
export const BASIRA_AMALA_PRICE = 1800;
export const DRY_TAP_CHANCE = 0.3;

export function actionCost(s: GameState, a: Action): number {
  if (a.id === "amala" && s.friends.basira >= BASIRA_DISCOUNT_HEARTS) return BASIRA_AMALA_PRICE;
  return a.cost ?? 0;
}

export const horseToday = (s: GameState) => s.horseDay === dayNum(s.t);

/** Why the action can't be done right now, or null if it can. */
export function blockReason(s: GameState, a: Action): string | null {
  const p = PLACE[s.loc];
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
  if (a.usesFood && s.groceries <= 0) return "No foodstuff at home. Buy some at Oja Oba, Oke-Odo or Palms Mall";
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

/**
 * Start an action. Returns the new state and the plan, or a reason it is blocked.
 * The caller runs the clock for plan.dur minutes (advance), then calls finishAction.
 */
export function startAction(state: GameState, a: Action, rng: Rng): { state: GameState; plan: ActionPlan } | { blocked: string } {
  const why = blockReason(state, a);
  if (why) return { blocked: why };
  const s = clone(state);
  let dur = a.dur;
  let pre = "";
  if (a.water && rng() < DRY_TAP_CHANCE) {
    dur += 30;
    s.needs.energy = clamp(s.needs.energy - 6);
    pre = "Tap no run, so you fetched water from the well first. ";
  }
  return { state: s, plan: { action: a, dur, cost: actionCost(s, a), sleep: !!a.sleep, pre } };
}

/** Apply an action's results once its time has passed. */
export function finishAction(state: GameState, plan: ActionPlan, rng: Rng): GameState {
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
    note(s, "New home", `Welcome to ${PLACE[s.loc].name}. This is now where you sleep, bath and cook.`);
  }
  if (a.goal && !s.goals[a.goal]) {
    s.goals[a.goal] = true;
    note(s, "Goal reached", a.done);
  }
  let msg = plan.pre + a.done;
  if (a.friend) msg += " " + befriend(s, a.friend, rng);
  if (a.earn) msg += ` You earned ${naira(a.earn)}.`;
  log(s, msg);
  s.toasts.push(a.earn ? "+" + naira(a.earn) : a.done);
  checkCritical(s, rng);
  return s;
}

/** Start, run the clock, and finish in one go. */
export function performAction(state: GameState, a: Action, rng: Rng): GameState | { blocked: string } {
  const started = startAction(state, a, rng);
  if ("blocked" in started) return started;
  const s = clone(started.state);
  advance(s, started.plan.dur, rng, { sleep: started.plan.sleep });
  return finishAction(s, started.plan, rng);
}
