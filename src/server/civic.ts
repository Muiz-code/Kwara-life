// The server's civic rules (Phase E2): how far a save may move the PVC, and what a vote attempt's answer means.
// Pure, so they are tested without a database.
import { PRESIDENTIAL_2027, canCollectPvc, canRegister, type ElectionCalendar } from "../data/calendar";
import type { PvcStatus } from "../sim/roll";

/** A save uploads every few minutes: a step taken just before a window closed still counts this long after. */
export const PVC_GRACE_MS = 15 * 60_000;

/**
 * The PVC status the server will accept, moving from what it has (`have`) towards what a save says (`want`), one
 * real step at a time: register while registration is open, collect while collection is open. A seizure always
 * sticks, and nothing goes backwards. Anything else stays where the server has it.
 */
export function reachPvc(have: PvcStatus, want: PvcStatus, createdAt: number, now: number, cal: ElectionCalendar = PRESIDENTIAL_2027): PvcStatus {
  if (have === want || have === "seized") return have;
  if (want === "seized") return "seized";
  let at = have;
  if (at === "none" && (want === "registered" || want === "have") && (canRegister(cal, createdAt, now) || canRegister(cal, createdAt, now - PVC_GRACE_MS)))
    at = "registered";
  if (at === "registered" && want === "have" && (canCollectPvc(cal, now) || canCollectPvc(cal, now - PVC_GRACE_MS))) at = "have";
  return at;
}

export type VoteAnswer = "ok" | "already" | "no-citizen" | "no-pvc" | "closed";

/** What the player is told for each answer from cast_vote. Null: the vote counted (or had already). */
export const VOTE_REASON: Record<VoteAnswer, string | null> = {
  ok: null,
  already: null,
  "no-citizen": "Create your citizen first",
  "no-pvc": "You need your PVC to vote. VINEC has no record of you collecting it",
  closed: "Polls are not open",
};
