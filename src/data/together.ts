// Things real players do together (docs/DECISIONS.md, "Playing together"). No chat: you see who is at the
// same place, invite them to one of these, and they answer Accept or Not today. The one who invites pays;
// both spend the time and both get the lift. Nothing here ever mentions a party.
import type { Action } from "./action";

export type TogetherId = "date" | "buka" | "owambe" | "match" | "service" | "dance";

export interface Together {
  id: TogetherId;
  label: string;
  /** What the invite card says: "<name> is inviting you to ..." */
  invite: string;
  /** Place kinds where it can happen. */
  kinds: string[];
  /** Game minutes. */
  dur: number;
  /** Paid by the one who invites, for both of you. */
  cost: number;
  fx: Action["fx"];
  /** Connections gained by each of you (src/sim/standing.ts). */
  connections: number;
  /** Only between these hours, [from, to). */
  hours?: [number, number];
  /** A date needs both players to have switched on "Open to dates". */
  date?: boolean;
  done: string;
}

export const TOGETHER: Together[] = [
  {
    id: "date", label: "Take them on a date", invite: "a date", kinds: ["lounge", "hotel", "garden", "mall", "club", "buka"],
    dur: 90, cost: 6_000, fx: { fun: 25, social: 25 }, connections: 3, hours: [11, 23], date: true,
    done: "Lovely date. Small chops, good gist, and nobody checked their phone.",
  },
  {
    id: "buka", label: "Lunch at the buka", invite: "lunch at the buka", kinds: ["buka"],
    dur: 45, cost: 3_000, fx: { food: 40, social: 15 }, connections: 2, hours: [10, 18],
    done: "Amala, ewedu and gbegiri for two. Mama added extra meat for the company.",
  },
  {
    id: "owambe", label: "Go to an owambe together", invite: "an owambe", kinds: ["townhall", "hotel", "hall"],
    dur: 180, cost: 2_000, fx: { fun: 30, social: 30, energy: -10 }, connections: 4, hours: [12, 23],
    done: "Aso ebi, jollof and spraying on the dance floor. You both danced till your legs gave up.",
  },
  {
    id: "match", label: "Watch the match together", invite: "the match at the viewing centre", kinds: ["viewing", "lounge"],
    dur: 120, cost: 400, fx: { fun: 25, social: 15 }, connections: 2, hours: [14, 23],
    done: "You screamed at the same goal. Strangers became brothers for ninety minutes.",
  },
  {
    id: "service", label: "Go to the service together", invite: "the service", kinds: ["church", "mosque"],
    dur: 90, cost: 0, fx: { social: 20, energy: -4 }, connections: 3, hours: [6, 20],
    done: "Side by side through the service, then gist outside after.",
  },
  {
    id: "dance", label: "Dance at the club", invite: "a night out at the club", kinds: ["club"],
    dur: 120, cost: 5_000, fx: { fun: 30, social: 20, energy: -15 }, connections: 2, hours: [20, 24],
    done: "Afrobeats till the DJ played the last song twice.",
  },
];

export const TOGETHER_BY_ID: Record<TogetherId, Together> = Object.fromEntries(TOGETHER.map((t) => [t.id, t])) as Record<TogetherId, Together>;

/** Quick reactions in place of chat. */
export const EMOTES = [
  { id: "wave", label: "Wave", glyph: "👋" },
  { id: "laugh", label: "Laugh", glyph: "😂" },
  { id: "clap", label: "Clap", glyph: "👏" },
  { id: "dance", label: "Dance", glyph: "💃" },
  { id: "respect", label: "Respect", glyph: "🙏" },
] as const;
export type EmoteId = (typeof EMOTES)[number]["id"];

/** Limits that keep invites friendly. */
export const INVITE_LIMITS = {
  /** Invites one player can send in a real hour. */
  perHour: 10,
  /** An unanswered invite lapses after this many real seconds. */
  expireS: 120,
  /** After this many "Not today" from the same person in a day, you cannot invite them again that day. */
  declinesPerDay: 3,
  /** Seconds between two reactions from the same player. */
  emoteGapS: 3,
};
