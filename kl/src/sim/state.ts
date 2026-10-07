import type { Character } from "../data/character";
import type { FriendId } from "../data/friends";
import type { GoalId } from "../data/action";
import type { NeedKey } from "../data/needs";
import { START_PLACE } from "../data/ilorin/places";
import type { Citizen } from "./roll";

export interface LogEntry {
  t: number;
  msg: string;
}

/** Choices are data so the queue can be saved. "ok" just closes the note. */
export type ChoiceId =
  | "ok"
  | "owambe-go"
  | "owambe-skip"
  | "door-report"
  | "door-refuse"
  | "door-take"
  | "pu-report"
  | "pu-refuse"
  | "pu-take";

export interface Note {
  title: string;
  body: string;
  choices?: { label: string; id: ChoiceId }[];
}

export interface Flags {
  /** Game minute the CV was submitted. */
  applied?: number;
  job?: boolean;
  /** Day number of the last shift worked. */
  worked?: number;
  rode?: boolean;
  kwasu?: boolean;
  /** Game day number of the last work shift (Naija jobs). */
  shiftDay?: number;
  /** Real date (WAT, YYYY-MM-DD) of the last PVC collection attempt that INEC turned away. */
  pvcTurnedAway?: string;
}

/** A paid promotion: flyers on notice boards or a sponsored news line. */
export interface Promo {
  kind: "flyer" | "news";
  /** Index into PROMO[kind]. */
  option: number;
  /** Party code, or "civic" for "go out and vote". */
  party: string;
  price: number;
  /** Real date in WAT (YYYY-MM-DD). */
  day: string;
  lgaCode: string;
}

export interface SupportCard {
  party: string;
  issues: string[];
  note: string;
  /** Real date in WAT (YYYY-MM-DD). */
  day: string;
}

export interface GameState {
  t: number;
  money: number;
  needs: Record<NeedKey, number>;
  loc: string;
  homeId: string;
  /** NEPA light is on. */
  light: boolean;
  /** Meals of foodstuff at home. */
  groceries: number;
  skill: number;
  friends: Record<FriendId, number>;
  /** Day number each friend was last met, so hearts grow once a day. */
  friendDay: Partial<Record<FriendId, number>>;
  log: LogEntry[];
  /** One-off event keys already shown. */
  seen: Record<string, true>;
  char: Character | null;
  goals: Partial<Record<GoalId, true>>;
  flags: Flags;
  /** Day number the Durbar horse was hired, or -1. */
  horseDay: number;
  inside: boolean;
  // ---- Naija Votes ----
  /** The rolled citizen. Null on the Ilorin-only legacy save until the player makes one. */
  citizen: Citizen | null;
  /** LGA code the citizen is visiting, or null when at home. loc is a place in this LGA's map. */
  at: string | null;
  informed: number;
  civic: number;
  /** Arrested for vote buying: on bail for the rest of the season. */
  onBail: boolean;
  /** Election ids this citizen has voted in. Never stores the choice. */
  voted: string[];
  supportCards: SupportCard[];
  promos: Promo[];
  /**
   * Votes this citizen's vote buying swung in their own LGA, by party. Kept for offline results; the
   * server keeps its own copy. The buyer is never shown this.
   */
  bribeEffects: Record<string, number>;
  /** Modals waiting to be shown, oldest first. */
  notes: Note[];
  /** Short messages for the toast. The store drains these; not saved. */
  toasts: string[];
}

export const START_MONEY = 20000;
export const LOG_LIMIT = 30;

export function freshState(): GameState {
  return {
    t: 7 * 60,
    money: START_MONEY,
    needs: { food: 70, energy: 80, fun: 60, social: 50, hygiene: 70 },
    loc: START_PLACE,
    homeId: START_PLACE,
    light: true,
    groceries: 1,
    skill: 0,
    friends: { aisha: 0, tunde: 0, basira: 0, kayode: 0 },
    friendDay: {},
    log: [],
    seen: {},
    char: null,
    goals: {},
    flags: {},
    horseDay: -1,
    inside: false,
    citizen: null,
    at: null,
    informed: 0,
    civic: 0,
    onBail: false,
    voted: [],
    supportCards: [],
    promos: [],
    bribeEffects: {},
    notes: [],
    toasts: [],
  };
}

export const clone = (s: GameState): GameState => structuredClone(s);

export function log(s: GameState, msg: string) {
  s.log.unshift({ t: s.t, msg });
  if (s.log.length > LOG_LIMIT) s.log.length = LOG_LIMIT;
}

export function note(s: GameState, title: string, body: string, choices?: Note["choices"]) {
  s.notes.push(choices ? { title, body, choices } : { title, body });
}

export const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");
