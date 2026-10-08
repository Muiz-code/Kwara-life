// The one-time citizen roll (docs/DESIGN.md "Citizen roll", docs/DECISIONS.md "Citizens").
// The player picks name, look, state and LGA; everything else is rolled once and kept for good.
import type { Look } from "../data/character";
import { CLASS_ODDS, MEDIA_ODDS, UNDER_FLYOVER, UNDER_FLYOVER_RADIO } from "../data/citizen";
import { LGA, POLLING_UNITS_PER_LGA } from "../data/geography";
import { HOMES, START_MONEY, type ClassId } from "../data/jobs";
import { STATE } from "../data/states";
import { CAREERS, CAREER_ODDS, EDUCATION_ODDS, careerFits, type CareerId, type Education } from "../data/careers";
import { pick, type Rng } from "./rng";

export type PvcStatus = "none" | "registered" | "have" | "seized";

export interface Citizen {
  name: string;
  look: Look;
  stateCode: string;
  lgaCode: string;
  puCode: string;
  cls: ClassId;
  /** Job title, e.g. "Tailor" or "Corps member". */
  job: string;
  career: CareerId;
  education: Education;
  /** Has a job or enrolment. Self-employed careers always do. */
  employed: boolean;
  /** Monthly pay for salaried careers (0 otherwise). */
  monthlyPay: number;
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

/** Careers you need someone to hire you for. Everyone else works for themselves. */
export const EMPLOYER_CAREERS: CareerId[] = ["worker", "developer", "executive", "politician"];
/** Share of citizens in employer careers who start out still looking for work. */
export const START_UNEMPLOYED = 0.2;

function rollFrom<T>(rng: Rng, odds: [T, number][]): T {
  let r = rng();
  for (const [v, p] of odds) {
    if (r < p) return v;
    r -= p;
  }
  return odds[odds.length - 1][0];
}

/** Roll a monthly salary inside the career's range, leaning towards the low end like real pay. */
export const rollSalary = (career: CareerId, rng: Rng) => {
  const c = CAREERS[career];
  if (c.pay !== "salary") return 0;
  return Math.round((c.min + Math.pow(rng(), 2) * (c.max - c.min)) / 1000) * 1000;
};

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
export function rollCitizen(input: RollInput, now: number, rng: Rng): Citizen {
  const state = STATE[input.stateCode];
  const lga = LGA[input.lgaCode];
  if (!state || !lga || lga.stateCode !== state.code) throw new Error("Pick a real state and one of its LGAs");
  const name = input.name.trim().slice(0, 16);
  if (!name) throw new Error("Enter your name");

  const cls = rollClass(rng);
  const underFlyover = cls === "poor" && rng() < UNDER_FLYOVER;
  // Nobody is handed a PVC: every citizen registers and collects it themselves (sim/civic.ts pvcReminders).
  const pvc: PvcStatus = "none";
  const media = MEDIA_ODDS[cls];

  const education = rollFrom(rng, EDUCATION_ODDS[cls]);
  let career = rollFrom(rng, CAREER_ODDS[cls]);
  if (!careerFits(career, education)) career = cls === "rich" ? "executive" : cls === "middle" ? "worker" : "artisan";
  if (!careerFits(career, education)) career = "trader";
  const employed = !EMPLOYER_CAREERS.includes(career) || rng() >= START_UNEMPLOYED;

  return {
    name,
    look: input.look,
    stateCode: state.code,
    lgaCode: lga.code,
    puCode: `${lga.code}/${1 + Math.floor(rng() * POLLING_UNITS_PER_LGA)}`,
    cls,
    job: pick(rng, CAREERS[career].titles),
    career,
    education,
    employed,
    monthlyPay: employed ? rollSalary(career, rng) : 0,
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
