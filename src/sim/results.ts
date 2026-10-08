// Results: simulated voters, real ballots and vote-buying effects collated by polling unit, LGA, state and
// nation. Simulated voters vote with equal odds for every party, from a seed committed before polls open,
// so anyone can check the draw after it is revealed.
import { LGAS, POLLING_UNITS, POLLING_UNITS_PER_LGA, type PollingUnit } from "../data/geography";
import { PARTIES } from "../data/parties";
import { STATES } from "../data/states";
import { seeded } from "./rng";

/** Votes per party, in PARTIES order. */
export type Tally = number[];

export const emptyTally = (): Tally => PARTIES.map(() => 0);
export const PARTY_INDEX: Record<string, number> = Object.fromEntries(PARTIES.map((p, i) => [p.code, i]));

/** A real-player breakdown is shown only from this many real voters at a polling unit (docs/DECISIONS.md). */
export const PRIVACY_MIN_REAL = 10;

/**
 * Simulated voters at every polling unit. Each party gets a weight drawn from the same distribution, so no
 * party is favoured; turnout varies by unit. Deterministic for a given seed.
 */
export function simulateVoters(seed: number): Record<string, Tally> {
  const R = seeded(seed);
  const out: Record<string, Tally> = {};
  for (const pu of POLLING_UNITS) {
    const turnout = Math.round((150 + R() * 550) * (0.3 + R() * 0.25));
    const w = PARTIES.map(() => Math.pow(R(), 3));
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    out[pu.code] = w.map((x) => Math.floor((turnout * x) / sum));
  }
  return out;
}

/** Spread an LGA's vote-buying effect over its polling units: an equal share each, the rest at the first. */
export function spreadBribes(lgaCode: string, byParty: Record<string, number>): Record<string, Tally> {
  const out: Record<string, Tally> = {};
  for (let i = 1; i <= POLLING_UNITS_PER_LGA; i++) out[`${lgaCode}/${i}`] = emptyTally();
  for (const [party, votes] of Object.entries(byParty)) {
    const k = PARTY_INDEX[party];
    if (k === undefined) continue;
    const share = Math.floor(votes / POLLING_UNITS_PER_LGA);
    for (let i = 1; i <= POLLING_UNITS_PER_LGA; i++) out[`${lgaCode}/${i}`][k] += share + (i === 1 ? votes % POLLING_UNITS_PER_LGA : 0);
  }
  return out;
}

export interface PuInputs {
  simulated: Record<string, Tally>;
  /** Real ballots per polling unit. */
  real: Record<string, Tally>;
  /** Vote-buying effects per LGA, by party. */
  bribes: Record<string, Record<string, number>>;
}

export interface PuSheet {
  code: string;
  /** Combined votes per party: real + simulated + vote-buying effects. */
  votes: Tally;
  /** Real-player votes per party, only when at least PRIVACY_MIN_REAL real players voted here. */
  real?: Tally;
  realVoters: number;
}

const add = (a: Tally, b?: Tally) => (b ? a.map((v, i) => v + (b[i] ?? 0)) : a);
const sum = (t: Tally) => t.reduce((a, b) => a + b, 0);

/** Every polling unit's result sheet, with the privacy rule applied. */
export function puSheets(inputs: PuInputs): PuSheet[] {
  const bribeByPu: Record<string, Tally> = {};
  for (const [lga, byParty] of Object.entries(inputs.bribes)) Object.assign(bribeByPu, spreadBribes(lga, byParty));
  return POLLING_UNITS.map((pu: PollingUnit) => {
    const real = inputs.real[pu.code] ?? emptyTally();
    const votes = add(add(add(emptyTally(), inputs.simulated[pu.code]), real), bribeByPu[pu.code]);
    const realVoters = sum(real);
    return realVoters >= PRIVACY_MIN_REAL ? { code: pu.code, votes, real, realVoters } : { code: pu.code, votes, realVoters };
  });
}

export interface Snapshot {
  version: number;
  at: string;
  pusUploaded: number;
  pusTotal: number;
  nation: Tally;
  states: Record<string, Tally>;
  lgas: Record<string, Tally>;
}

/** Totals from the polling units uploaded so far. Only totals are published (no individual ballots). */
export function collate(sheets: PuSheet[], uploaded: Set<string>, version: number, at: string): Snapshot {
  const lgas: Record<string, Tally> = Object.fromEntries(LGAS.map((l) => [l.code, emptyTally()]));
  const states: Record<string, Tally> = Object.fromEntries(STATES.map((s) => [s.code, emptyTally()]));
  let nation = emptyTally();
  for (const sh of sheets) {
    if (!uploaded.has(sh.code)) continue;
    const lga = sh.code.slice(0, sh.code.lastIndexOf("/"));
    const state = lga.slice(0, lga.indexOf("/"));
    lgas[lga] = add(lgas[lga], sh.votes);
    states[state] = add(states[state], sh.votes);
    nation = add(nation, sh.votes);
  }
  return { version, at, pusUploaded: uploaded.size, pusTotal: sheets.length, nation, states, lgas };
}

/** The order polling units upload in during live collation (shuffled, deterministic per seed). */
export function uploadOrder(seed: number): string[] {
  const R = seeded(seed ^ 0x5bd1e995);
  const codes = POLLING_UNITS.map((p) => p.code);
  for (let i = codes.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [codes[i], codes[j]] = [codes[j], codes[i]];
  }
  return codes;
}

/** Leading party index for a tally, or -1 if no votes. */
export const leader = (t: Tally) => (sum(t) ? t.indexOf(Math.max(...t)) : -1);
