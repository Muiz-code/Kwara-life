import type { Action } from "../data/action";
import { PLACE } from "../data/ilorin/places";
import { PAY } from "../data/jobs";
import type { GameState } from "./state";
import { clone, log, naira, note } from "./state";
import type { Rng } from "./rng";
import { DAY_PLURALS, dayNum, dayOfWeek, fmtHour, hourOf, isOpen, worldT } from "./time";
import { advance, applyFx, clamp } from "./needs";
import { befriend } from "./friends";
import { checkCritical } from "./critical";
import { civicBlockReason, watDate, type CivicContext } from "./civic";
import { currentHeadline, mediaInformed, mediaShow } from "./media";
import { CAREERS } from "../data/careers";
import { phoneOf } from "../data/phones";
import { CAR, HOUSE, OUTFIT, outfitFits } from "../data/shops";
import { addConnections, CONNECTION_GAIN, FRIEND_CONNECTIONS } from "./standing";

/** Pitching an idea to investors: how often they say yes, and how much they put in. */
export const PITCH_CHANCE = 0.06;
export const PITCH_INVESTMENT = 5_000_000;
import { doWork, workBlockReason } from "./work";
import { book, type TxnCat } from "./bank";
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
  const h = hourOf(worldT(s));
  const d = dayOfWeek(worldT(s));
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
  if (a.furnish && s.furniture.includes(a.furnish)) return "You already have one at home";
  // Any TV at home (Ilorin's Africa Magic included) needs a TV you own. The legacy Ilorin game has one.
  if (a.id === "tv" && s.citizen && !s.citizen.ownsTv && s.loc === s.homeId) return "You don't have a TV. Buy one at the market or watch at the viewing centre";
  if (a.phone && phoneOf(s.phone, s.citizen?.cls).id === a.phone) return "You already have this phone";
  if (a.car && s.car === a.car) return "You already own this car";
  if (a.house && s.house === a.house) return "You already own this house";
  if (a.house && s.house && HOUSE[s.house] && HOUSE[a.house] && HOUSE[a.house].tier < HOUSE[s.house].tier) return "Your house is already bigger than this";
  if (a.outfit && s.outfit === a.outfit) return "You are already wearing this";
  if (a.outfit && s.char && Object.hasOwn(OUTFIT, a.outfit) && !outfitFits(OUTFIT[a.outfit], s.char.g)) return OUTFIT[a.outfit].for === "m" ? "That one is cut for men" : "That one is cut for women";
  if (a.website && s.flags.website) return "Raavon already built your website";
  if (a.pitch && s.flags.pitched === dayNum(s.t)) return "You pitched today. Work on it and come back tomorrow";
  if (a.goal && s.goals[a.goal]) return "Already done";
  if (a.light && !s.light && !p.gen && !homeGenerator(s)) return "NEPA took light";
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

/** What a place's price was for, on your statement. */
function spendCat(a: Action): TxnCat {
  if (a.groc || a.fx.food) return "food";
  if (a.phone || a.car || a.outfit || a.buy) return "shopping";
  if (a.house || a.rent || a.furnish || a.sleep) return "home";
  if (a.flyer || a.bribe) return "campaign";
  if (a.fx.fun) return "fun";
  return "bills";
}

/** Apply an action's results once its time has passed. */
export function finishAction(state: GameState, plan: ActionPlan, rng: Rng, ctx: ActionContext = {}): GameState {
  const s = clone(state);
  const a = plan.action;
  book(s, -plan.cost, a.label, spendCat(a));
  if (a.earn) book(s, a.earn, a.label, a.shift ? "salary" : "hustle");
  if (a.tip) book(s, a.tip, `Tip: ${a.label}`, "gift");
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
  if (a.friend) {
    const hearts = s.friends[a.friend];
    msg += " " + befriend(s, a.friend, rng);
    if (s.friends[a.friend] > hearts) addConnections(s, FRIEND_CONNECTIONS);
  }
  if (Object.hasOwn(CONNECTION_GAIN, a.id)) addConnections(s, CONNECTION_GAIN[a.id]);
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
  if (a.phone) {
    s.phone = a.phone;
    toast = "New phone!";
  }
  if (a.website) {
    s.flags.website = true;
    toast = "Your website is live";
  }
  if (a.pitch) {
    s.flags.pitched = dayNum(s.t);
    // Most pitches end with "come back with traction"; now and then they invest.
    if (rng() < PITCH_CHANCE) {
      book(s, PITCH_INVESTMENT, "Raavon investment in your idea", "investor");
      msg = `Raavon invested ${naira(PITCH_INVESTMENT)} in your idea!`;
      toast = "Raavon invested!";
      note(s, "They said yes", `Raavon is investing ${naira(PITCH_INVESTMENT)} in your idea. Build well.`);
    } else {
      msg = "Raavon listened and said: come back when you have customers.";
      toast = "Not yet. Come back with traction";
    }
  }
  if (a.furnish && !s.furniture.includes(a.furnish)) {
    s.furniture.push(a.furnish);
    toast = "New for your home!";
  }
  if (a.car && Object.hasOwn(CAR, a.car)) {
    s.car = a.car;
    toast = "Your new car!";
  }
  if (a.outfit && Object.hasOwn(OUTFIT, a.outfit)) {
    s.outfit = a.outfit;
    toast = "New outfit!";
  }
  if (c && a.house && Object.hasOwn(HOUSE, a.house)) {
    const h = HOUSE[a.house];
    s.house = h.id;
    c.home = h.name;
    // Off the street for good: the house is yours, not a shelter bed.
    if (c.underFlyover) {
      c.underFlyover = false;
      c.wasUnder = true;
    }
    note(s, "Your own house", `The ${h.name.toLowerCase()} is yours. No landlord, no rent.${h.generator ? " It has a generator, so you have light at home when NEPA takes it." : ""}`);
    toast = "Keys to your new house!";
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
      msg = "VINEC said your PVC is not ready. Come back tomorrow.";
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

/** At home in a house you bought that has a generator: light whatever NEPA does. */
export function homeGenerator(s: GameState): boolean {
  return s.loc === s.homeId && !!s.house && Object.hasOwn(HOUSE, s.house) && HOUSE[s.house].generator;
}
