// Election day: BVAS accreditation, the ballot, and casting a secret vote.
// The citizen's state records only that they voted, never the choice. The ballot that goes to the server
// carries the polling unit and party but nothing that identifies the voter.
import { PRESIDENTIAL_2027 } from "../data/calendar";
import { PARTIES, PARTY, type Party } from "../data/parties";
import { civicBlockReason, type CivicContext } from "./civic";
import { advance } from "./needs";
import type { Rng } from "./rng";
import { clone, log, note, type GameState } from "./state";

export const VOTE_ACTION = { id: "vote", label: "Vote", dur: 60, vote: true, fx: {}, done: "" } as const;

/** BVAS fails the first fingerprint scan this often; facial capture always works. */
export const FINGERPRINT_FAIL = 0.25;

export type BvasResult = "accredited" | "face-capture";

/** One tap on the BVAS pad. First attempt may fail and fall back to facial capture. */
export const bvasScan = (attempt: number, rng: Rng): BvasResult => (attempt === 1 && rng() < FINGERPRINT_FAIL ? "face-capture" : "accredited");

/** The ballot: every party, alphabetical by code, equal boxes, no logos. */
export const ballot = (): Party[] => [...PARTIES].sort((a, b) => a.code.localeCompare(b.code));

/** Why this citizen can't vote right now. They must be at their polling unit. */
export function voteBlockReason(s: GameState, ctx: CivicContext & { atPollingUnit: boolean }): string | null {
  const why = civicBlockReason(s, { ...VOTE_ACTION, fx: {} }, ctx);
  if (why) return why;
  if (!ctx.atPollingUnit) return "Go to your polling unit to vote";
  return null;
}

/** What is sent to the server. No citizen id, no exact time. */
export interface Ballot {
  electionId: string;
  puCode: string;
  party: string;
}

export function castVote(
  state: GameState,
  party: string,
  ctx: CivicContext & { atPollingUnit: boolean },
  rng: Rng,
): { state: GameState; ballot: Ballot } | { blocked: string } {
  const why = voteBlockReason(state, ctx);
  if (why) return { blocked: why };
  if (!PARTY[party]) return { blocked: "Choose one party" };
  const cal = ctx.cal ?? PRESIDENTIAL_2027;
  const s = clone(state);
  s.voted.push(cal.id);
  advance(s, VOTE_ACTION.dur, rng);
  log(s, "You voted. Your thumb carries the purple ink.");
  note(s, "You voted", "Your thumb carries the purple ink. Results go live when polls close.");
  return { state: s, ballot: { electionId: cal.id, puCode: s.citizen!.puCode, party } };
}
