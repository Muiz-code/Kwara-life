// The rules for playing together (src/data/together.ts). Pure, so the server can run the same checks before
// it passes an invite on. Players only meet at the same place; invites need the other player to be open to
// them (dates need their own switch); blocks work both ways; and there are limits so nobody gets pestered.
import type { Action } from "../data/action";
import type { Look } from "../data/character";
import { INVITE_LIMITS, TOGETHER, TOGETHER_BY_ID, type TogetherId } from "../data/together";

/** Another real player, as the game sees them: a nickname, how they look, where they are. Never a real name. */
export interface Player {
  id: string;
  nickname: string;
  look: Look;
  lgaCode: string;
  placeId: string;
  /** Switched on "Open to invites". */
  openInvites: boolean;
  /** Switched on "Open to dates" as well. */
  openDates: boolean;
  /** In the middle of something (an action, a trip, another activity). */
  busy: boolean;
}

export interface Invite {
  id: string;
  from: { id: string; nickname: string };
  to: string;
  activity: TogetherId;
  placeId: string;
  /** Real time it was sent (ms). */
  sentAt: number;
}

/** Activities on offer at a place of this kind. */
export const activitiesAt = (kind: string) => TOGETHER.filter((t) => t.kinds.includes(kind));

export interface InviteCheck {
  me: { id: string; openDates: boolean };
  them: Player;
  activity: TogetherId;
  /** Where I am. */
  placeId: string;
  placeKind: string;
  /** Game hour now. */
  hour: number;
  /** Players either of us has blocked (ids). */
  blocked: ReadonlySet<string>;
  /** Invites I have sent in the last real hour. */
  sentLastHour: number;
  /** Times they have said Not today to me today. */
  declinesToday: number;
  /** I already have an invite waiting with them. */
  pending: boolean;
}

/** Why this invite can't go, or null when it can. */
export function inviteProblem(c: InviteCheck): string | null {
  const t = TOGETHER_BY_ID[c.activity];
  if (!t) return "Pick something to do";
  if (c.them.id === c.me.id) return "That's you";
  if (c.blocked.has(c.them.id)) return "You can't invite this player";
  if (c.them.placeId !== c.placeId) return `${c.them.nickname} is not here any more`;
  if (!t.kinds.includes(c.placeKind)) return `You can't do that here`;
  if (t.hours && (c.hour < t.hours[0] || c.hour >= t.hours[1])) return `Not at this hour. ${t.label} is from ${t.hours[0]}:00`;
  if (!c.them.openInvites) return `${c.them.nickname} is not taking invites`;
  if (t.date && !c.me.openDates) return "Switch on Open to dates first";
  if (t.date && !c.them.openDates) return `${c.them.nickname} is not open to dates`;
  if (c.them.busy) return `${c.them.nickname} is busy right now`;
  if (c.pending) return `You already invited ${c.them.nickname}. Wait for their answer`;
  if (c.declinesToday >= INVITE_LIMITS.declinesPerDay) return `${c.them.nickname} can't today. Try another day`;
  if (c.sentLastHour >= INVITE_LIMITS.perHour) return "You have sent plenty of invites. Rest small";
  return null;
}

/** An invite lapses if nobody answers it in time. */
export const inviteExpired = (inv: Invite, now: number) => now - inv.sentAt > INVITE_LIMITS.expireS * 1000;

/** The activity as an ordinary game action: the host pays for both, the guest pays nothing. */
export function togetherAction(id: TogetherId, role: "host" | "guest", withName: string): Action {
  const t = TOGETHER_BY_ID[id];
  return {
    id: `together-${id}-${role}`,
    label: t.label,
    dur: t.dur,
    cost: role === "host" ? t.cost : 0,
    fx: t.fx,
    hours: t.hours,
    bubble: `With ${withName}`,
    done: `${t.done} (with ${withName})`,
  };
}
