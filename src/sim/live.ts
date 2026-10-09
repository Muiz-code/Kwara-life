// Live results through election day (docs/DECISIONS.md, "Live results from 8am"). Party standings update while
// polls are open. Until the server feed is connected, the day is simulated: every polling unit uploads its votes
// in small batches about every ten minutes, busier in the morning, so the totals climb all day and land exactly on
// the final simulated result when polls close. Pure and deterministic for a seed.
import { LGAS, POLLING_UNITS } from "../data/geography";
import { STATES } from "../data/states";
import { emptyTally, simulateVoters, type Tally } from "./results";
import { seeded } from "./rng";

/** Uploads per polling unit over the day: about one every ten minutes for eight hours. */
export const UPLOADS_PER_PU = 48;

export interface LiveSchedule {
  /** Each polling unit's final votes per party. */
  final: Record<string, Tally>;
  /** Each polling unit's upload offset, 0 to 1 of one upload interval, so units don't all report together. */
  offset: Record<string, number>;
}

export function liveSchedule(seed: number): LiveSchedule {
  const R = seeded(seed ^ 0x2c1b3c6d);
  const offset: Record<string, number> = {};
  for (const pu of POLLING_UNITS) offset[pu.code] = R();
  return { final: simulateVoters(seed), offset };
}

/** Share of a unit's votes cast by this point of the day (0 to 1): the morning queue is the longest. */
export const turnoutCurve = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 1.7);

/** Uploads a polling unit has made by `progress` (0 at polls open, 1 at polls close). */
export function uploadsDone(offset: number, progress: number): number {
  if (progress >= 1) return UPLOADS_PER_PU;
  return Math.min(UPLOADS_PER_PU, Math.max(0, Math.floor(progress * UPLOADS_PER_PU - offset) + 1));
}

/** When upload `n` (1-based) happens, as progress through the day. */
export const uploadAt = (offset: number, n: number) => (n - 1 + offset) / UPLOADS_PER_PU;

const votesAfter = (final: Tally, n: number): Tally => {
  const f = turnoutCurve(n / UPLOADS_PER_PU);
  return final.map((v) => Math.floor(v * f));
};

export interface FeedItem {
  puCode: string;
  lgaCode: string;
  stateCode: string;
  /** Progress through the day when it reported. */
  at: number;
  /** Votes in this upload. */
  added: number;
}

export interface LiveSnapshot {
  progress: number;
  votesCast: number;
  pusReporting: number;
  pusTotal: number;
  nation: Tally;
  states: Record<string, Tally>;
  lgas: Record<string, Tally>;
  /** The latest uploads that added votes, newest first. */
  feed: FeedItem[];
}

const addInto = (a: Tally, b: Tally) => {
  for (let i = 0; i < a.length; i++) a[i] += b[i];
};

/** Running totals at `progress` through polling day. `feedFilter` limits the feed (for a state or LGA view). */
export function liveSnapshot(sched: LiveSchedule, progress: number, feedSize = 8, feedFilter?: (puCode: string) => boolean): LiveSnapshot {
  const lgas: Record<string, Tally> = Object.fromEntries(LGAS.map((l) => [l.code, emptyTally()]));
  const states: Record<string, Tally> = Object.fromEntries(STATES.map((s) => [s.code, emptyTally()]));
  const nation = emptyTally();
  const feed: FeedItem[] = [];
  let pusReporting = 0;
  for (const pu of POLLING_UNITS) {
    const off = sched.offset[pu.code];
    const n = uploadsDone(off, progress);
    if (!n) continue;
    pusReporting++;
    const t = votesAfter(sched.final[pu.code], n);
    const stateCode = pu.lgaCode.slice(0, pu.lgaCode.indexOf("/"));
    addInto(lgas[pu.lgaCode], t);
    addInto(states[stateCode], t);
    addInto(nation, t);
    if (feedFilter && !feedFilter(pu.code)) continue;
    const before = votesAfter(sched.final[pu.code], n - 1);
    const added = t.reduce((a, v, i) => a + v - before[i], 0);
    if (added > 0) feed.push({ puCode: pu.code, lgaCode: pu.lgaCode, stateCode, at: uploadAt(off, n), added });
  }
  feed.sort((a, b) => b.at - a.at || a.puCode.localeCompare(b.puCode));
  feed.length = Math.min(feed.length, feedSize);
  const votesCast = nation.reduce((a, b) => a + b, 0);
  return { progress, votesCast, pusReporting, pusTotal: POLLING_UNITS.length, nation, states, lgas, feed };
}

/** Party indexes, most votes first. Ties (and the empty board before polls open) go alphabetically by code. */
export function rankParties(t: Tally, codes: readonly string[]): number[] {
  return t.map((_, i) => i).sort((a, b) => t[b] - t[a] || codes[a].localeCompare(codes[b]));
}
