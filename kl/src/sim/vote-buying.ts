// Vote buying: a crime, risky, unverifiable, and limited to the buyer's own LGA (docs/DESIGN.md).
// Arrest news never names a party. The buyer never learns how anyone voted.
import { PRESIDENTIAL_2027, civicPhase, pollsAreOpen } from "../data/calendar";
import { LGA } from "../data/geography";
import { PARTY } from "../data/parties";
import { civicBlockReason, type CivicContext } from "./civic";
import { advance } from "./needs";
import type { Rng } from "./rng";
import { clone, log, naira, note, type ChoiceId, type GameState } from "./state";

export const AMOUNTS = [1000, 5000, 10000];
export const GROUPS = [5, 20, 50];
/** Of the people offered money, this share take it, and this share of those vote as paid. */
export const TAKE_CHANCE = 0.6;
export const COMPLY_CHANCE = 0.5;
export const CUSTODY_MINUTES = 720;
export const FINE_SHARE = 0.5;

/** Chance of being caught, in percent: grows with the crowd and the money (prototype formula). */
export const catchRisk = (perPerson: number, people: number) => Math.min(85, Math.round((0.12 + people * 0.006 + perPerson / 200000) * 100));

export interface BribeInput {
  party: string;
  perPerson: number;
  people: number;
}

export type BribeOutcome =
  | { caught: true; lost: number; fine: number; news: string }
  | { caught: false; took: number; refused: number };

/** Try to buy votes at the market, buka or motor park. */
export function buyVotes(state: GameState, input: BribeInput, ctx: CivicContext, rng: Rng): { state: GameState; outcome: BribeOutcome } | { blocked: string } {
  const why = civicBlockReason(state, { id: "bribe", label: "", dur: 60, fx: {}, done: "", bribe: true }, ctx);
  if (why) return { blocked: why };
  if (!PARTY[input.party]) return { blocked: "Pick a party" };
  if (!AMOUNTS.includes(input.perPerson) || !GROUPS.includes(input.people)) return { blocked: "Pick an amount and a group" };
  const total = input.perPerson * input.people;
  if (total > state.money) return { blocked: "Not enough money" };

  // Roll the outcome first, then let the hour of sharing money pass.
  const caught = rng() * 100 < catchRisk(input.perPerson, input.people);
  let took = 0;
  let complied = 0;
  if (!caught) {
    for (let i = 0; i < input.people; i++) {
      if (rng() < TAKE_CHANCE) {
        took++;
        if (rng() < COMPLY_CHANCE) complied++;
      }
    }
  }
  const s = clone(state);
  const c = s.citizen!;
  advance(s, 60, rng);
  s.money -= total;
  const lgaName = LGA[c.lgaCode]?.name ?? "your LGA";

  if (caught) {
    const fine = Math.min(s.money, Math.round(s.money * FINE_SHARE));
    s.money -= fine;
    if (c.pvc !== "none") c.pvc = "seized";
    s.civic = Math.max(0, s.civic - 5);
    s.onBail = true;
    advance(s, CUSTODY_MINUTES, rng);
    const news = `Vote buyer arrested in ${lgaName}. EFCC says investigations continue`;
    log(s, `You were arrested for vote buying. You lost ${naira(total)}, paid a ${naira(fine)} fine and spent the night in custody.`);
    note(s, "Arrested", "Someone you tried to pay reported you. Police arrested you in the act. Your money is gone, you paid a fine, your PVC was seized and you spent the night in a cell. You are out on bail for the rest of the season.");
    return { state: s, outcome: { caught: true, lost: total, fine, news } };
  }

  s.bribeEffects[input.party] = (s.bribeEffects[input.party] ?? 0) + complied;
  log(s, `${took} of ${input.people} people took your ${naira(input.perPerson)}. The ballot is secret, so you will never know how they voted.`);
  s.toasts.push(`${took} took the money. ${input.people - took} refused.`);
  return { state: s, outcome: { caught: false, took, refused: input.people - took } };
}

// ---- Offers to sell your vote ----

export type OfferKind = "door" | "pu";

export const OFFERS: Record<OfferKind, { amount: number; catchChance: number; title: string; body: string }> = {
  door: {
    amount: 10000,
    catchChance: 0.6,
    title: "A stranger at your door",
    body: "A man you don't know offers you ₦10,000 to vote his way.",
  },
  pu: {
    amount: 5000,
    catchChance: 0.5,
    title: "Someone near the polling unit",
    body: "A woman by the queue whispers that she will give you ₦5,000 if you vote her way.",
  },
};

/** Which offer, if any, should appear now. Each comes once a season. */
export function offerDue(s: GameState, now: number, cal = PRESIDENTIAL_2027): OfferKind | null {
  const c = s.citizen;
  if (!c || c.pvc === "none" || c.pvc === "seized" || s.voted.includes(cal.id)) return null;
  const hour = Math.floor((s.t % 1440) / 60);
  if (!s.seen["offer-door"] && civicPhase(cal, now) === "pvc-collection" && s.loc === "home" && hour >= 19 && hour < 22) return "door";
  if (!s.seen["offer-pu"] && pollsAreOpen(cal, now) && s.loc === "pu") return "pu";
  return null;
}

/** Mutates s: show the offer as a note with three choices. */
export function showOffer(s: GameState, kind: OfferKind) {
  s.seen[`offer-${kind}`] = true;
  const o = OFFERS[kind];
  note(s, o.title, o.body, [
    { label: "Refuse and report to INEC", id: `${kind}-report` as ChoiceId },
    { label: "Just refuse", id: `${kind}-refuse` as ChoiceId },
    { label: "Take the money", id: `${kind}-take` as ChoiceId },
  ]);
}

/** Mutates s: the player's answer to an offer. Reporting earns civic points. */
export function resolveOffer(s: GameState, kind: OfferKind, answer: "report" | "refuse" | "take", rng: Rng) {
  const o = OFFERS[kind];
  if (answer === "report") {
    s.civic += 3;
    log(s, "You refused a vote-buying offer and reported it.");
    s.toasts.push("Civic badge earned");
    return;
  }
  if (answer === "refuse") {
    s.civic += 1;
    log(s, "You refused a vote-buying offer.");
    return;
  }
  s.money += o.amount;
  if (rng() < o.catchChance && s.citizen) {
    s.citizen.pvc = "seized";
    log(s, `You took ${naira(o.amount)} for your vote. Investigators traced the ring and seized your PVC.`);
    note(s, "PVC confiscated", "Investigators traced the vote-buying ring and everyone it paid. You cannot vote this election. Selling your vote is a crime.");
  } else {
    log(s, `You took ${naira(o.amount)} from a vote buyer. Nobody found out, this time.`);
  }
}
