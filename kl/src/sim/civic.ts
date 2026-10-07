// Civic rules that depend on the real election calendar: registration, PVC collection, campaigning, voting.
import type { Action } from "../data/action";
import { PRESIDENTIAL_2027, campaigningAllowed, canCollectPvc, canRegister, pollsAreOpen, seasonClosed, type ElectionCalendar } from "../data/calendar";
import type { GameState } from "./state";
import { awayReason } from "./journey";

/** Real-world context a civic check needs. now is real time in ms. */
export interface CivicContext {
  now: number;
  cal?: ElectionCalendar;
}

/** Calendar date in WAT (YYYY-MM-DD) for a real moment. Support cards and the promotion cap reset on this. */
export const watDate = (now: number) => new Date(now + 3600_000).toISOString().slice(0, 10);

const watParts = (iso: string) => new Date(Date.parse(iso) + 3600_000);
const longDate = (iso: string) => watParts(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", timeZone: "UTC" });
/** "8am", "4pm", "8:30am" in WAT. */
const clockTime = (iso: string) => {
  const d = watParts(iso);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`;
};

export const MIN_BRIBE_CASH = 5000;

export const SEASON_OVER = "The season is over. Thank you for voting";

/** Actions still allowed while polls are open (movement is restricted on election day). */
const ELECTION_DAY_ALLOWED = new Set(["vote", "check", "sleep", "nap", "bath", "cook", "radio", "tv", "phone", "lodge"]);

/**
 * Election day and the end of the season apply to every action: during polls only voting and staying home are
 * allowed; after polls close nothing is.
 */
export function seasonBlockReason(a: Action, ctx: CivicContext): string | null {
  const cal = ctx.cal ?? PRESIDENTIAL_2027;
  if (!ctx.now) return null;
  if (seasonClosed(cal, ctx.now)) return SEASON_OVER;
  if (pollsAreOpen(cal, ctx.now) && !ELECTION_DAY_ALLOWED.has(a.id)) return "Election day: markets and offices are closed. Go and vote";
  return null;
}

/** Why a civic action is blocked, or null. Non-civic actions always pass. */
export function civicBlockReason(s: GameState, a: Action, ctx: CivicContext): string | null {
  const cal = ctx.cal ?? PRESIDENTIAL_2027;
  const now = ctx.now;
  const c = s.citizen;
  if (c) {
    const season = seasonBlockReason(a, ctx);
    if (season) return season;
  }
  if (a.home && c) {
    const away = awayReason(s, "home");
    if (away) return away;
  }
  const civic = a.pvcAct || a.vote || a.bribe || a.flyer || a.buy || a.shelter || a.shift || a.media === "radio" || a.media === "tv";
  if (!civic) return null;
  if (!c) return "Create your citizen first";
  if (a.pvcAct) {
    const away = awayReason(s, "inec");
    if (away) return away;
  }
  if (a.bribe) {
    const away = awayReason(s, "bribe");
    if (away) return away;
  }
  if (a.shift && s.loc === "work") {
    const away = awayReason(s, "home");
    if (away) return "Your workplace is in your own LGA";
  }
  if (a.media === "tv" && s.loc === "home" && !c.ownsTv) return "You don't have a TV. Buy one at the market or watch at the viewing centre";
  if (a.media === "radio" && !c.ownsRadio) return "You don't have a radio. Buy one at the market";
  if (a.buy && (a.buy === "tv" ? c.ownsTv : c.ownsRadio)) return "You already have one";

  if (a.pvcAct === "register") {
    if (c.pvc !== "none") return "You are already registered";
    if (now < c.createdAt + cal.registrationOpensAfterMs) return "Registration opens in a moment. INEC is setting up";
    if (!canRegister(cal, c.createdAt, now)) return `Registration closed on ${longDate(cal.registrationClose)}`;
  }
  if (a.pvcAct === "collect") {
    if (c.pvc === "have") return "You already have your PVC";
    if (c.pvc === "seized") return "Your PVC was seized";
    if (c.pvc !== "registered") return "Register first";
    if (now < Date.parse(cal.pvcAnnouncement)) return `INEC will announce PVC collection on ${longDate(cal.pvcAnnouncement)}`;
    if (!canCollectPvc(cal, now)) return "PVC collection has closed";
    if (s.flags.pvcTurnedAway === watDate(now)) return "INEC said come back tomorrow";
  }
  if (a.flyer && !campaigningAllowed(cal, now)) return "Campaigning has ended";
  if (a.bribe) {
    if (now >= Date.parse(cal.pollsClose)) return "The election is over";
    if (s.onBail) return "You are on bail. Police are watching you";
    if (s.money < MIN_BRIBE_CASH) return "You need at least ₦5,000";
  }
  if (a.vote) {
    if (s.voted.includes(cal.id)) return "You have voted";
    const away = awayReason(s, "vote");
    if (away) return away;
    if (!pollsAreOpen(cal, now)) return now < Date.parse(cal.pollsOpen) ? `Voting is on ${longDate(cal.pollsOpen)}, ${clockTime(cal.pollsOpen)} to ${clockTime(cal.pollsClose)}` : "The election is over";
    if (c.pvc === "seized") return "Your PVC was seized. You cannot vote this election";
    if (c.pvc !== "have") return "You need a PVC to vote";
  }
  if (a.shelter && !c.underFlyover) return "You have a bed already";
  return null;
}
