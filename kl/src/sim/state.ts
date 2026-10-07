import type { Character } from "../data/character";
import type { FriendId } from "../data/friends";
import type { GoalId } from "../data/ilorin/actions";
import type { NeedKey } from "../data/needs";
import { START_PLACE } from "../data/ilorin/places";

export interface LogEntry {
  t: number;
  msg: string;
}

/** Choices are data so the queue can be saved. "ok" just closes the note. */
export type ChoiceId = "ok" | "owambe-go" | "owambe-skip";

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
