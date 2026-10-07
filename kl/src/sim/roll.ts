// The one-time citizen roll (docs/DESIGN.md "Citizen roll", docs/DECISIONS.md "Citizens").
// The player picks name, look, state and LGA; everything else is rolled once and kept for good.
import type { Look } from "../data/character";
import { CLASS_ODDS, MEDIA_ODDS, PVC_ODDS, UNDER_FLYOVER, UNDER_FLYOVER_RADIO } from "../data/citizen";
import { PRESIDENTIAL_2027, type ElectionCalendar } from "../data/calendar";
import { LGA, POLLING_UNITS_PER_LGA } from "../data/geography";
import { HOMES, JOBS, START_MONEY, type ClassId } from "../data/jobs";
import { STATE } from "../data/states";
import { pick, type Rng } from "./rng";

export type PvcStatus = "none" | "registered" | "have" | "seized";

export interface Citizen {
  name: string;
  look: Look;
  stateCode: string;
  lgaCode: string;
  puCode: string;
  cls: ClassId;
  job: string;
  home: string;
  underFlyover: boolean;
  /** Moved from under the flyover into the shelter. */
  wasUnder: boolean;
  ownsTv: boolean;
  ownsRadio: boolean;
  pvc: PvcStatus;
  /** Real time (ms) the citizen was created. Registration opens 2 minutes later. */
  createdAt: number;
  /** Real time (ms) they registered in game, if they did. */
  registeredAt: number | null;
}

export interface RollInput {
  name: string;
  look: Look;
  stateCode: string;
  lgaCode: string;
}

export const UNDER_FLYOVER_HOME = "Under a flyover near the motor park";

function rollClass(rng: Rng): ClassId {
  let r = rng();
  for (const [cls, p] of CLASS_ODDS) {
    if (r < p) return cls;
    r -= p;
  }
  return "poor";
}

/**
 * Roll a citizen. now is the real time of sign-up. After registration closes nobody can register any more,
 * so late joiners are rolled as either holding a PVC or registered with a PVC to collect (docs/DECISIONS.md).
 */
export function rollCitizen(input: RollInput, now: number, rng: Rng, cal: ElectionCalendar = PRESIDENTIAL_2027): Citizen {
  const state = STATE[input.stateCode];
  const lga = LGA[input.lgaCode];
  if (!state || !lga || lga.stateCode !== state.code) throw new Error("Pick a real state and one of its LGAs");
  const name = input.name.trim().slice(0, 16);
  if (!name) throw new Error("Enter your name");

  const cls = rollClass(rng);
  const underFlyover = cls === "poor" && rng() < UNDER_FLYOVER;
  const lateJoiner = now > Date.parse(cal.registrationClose);
  const p = rng() * (lateJoiner ? PVC_ODDS.have + PVC_ODDS.registered : 1);
  const pvc = p < PVC_ODDS.have ? "have" : p < PVC_ODDS.have + PVC_ODDS.registered ? "registered" : "none";
  const media = MEDIA_ODDS[cls];

  return {
    name,
    look: input.look,
    stateCode: state.code,
    lgaCode: lga.code,
    puCode: `${lga.code}/${1 + Math.floor(rng() * POLLING_UNITS_PER_LGA)}`,
    cls,
    job: pick(rng, JOBS[cls]),
    home: underFlyover ? UNDER_FLYOVER_HOME : pick(rng, HOMES[cls]),
    underFlyover,
    wasUnder: false,
    ownsTv: !underFlyover && rng() < media.tv,
    ownsRadio: rng() < (underFlyover ? UNDER_FLYOVER_RADIO : media.radio),
    pvc,
    createdAt: now,
    registeredAt: null,
  };
}

export function startingMoney(c: Citizen, rng: Rng): number {
  const [lo, hi] = START_MONEY[c.cls];
  return Math.round(lo + rng() * (hi - lo));
}
