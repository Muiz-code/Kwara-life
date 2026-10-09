// Reasons to come back: a daily streak, three missions a day and a stamp book of firsts. Days are real days
// in WAT, like the rest of the season. Everything lives in flags so old saves load as they are.
import type { GameState } from "./state";
import { PRESIDENTIAL_2027 } from "../data/calendar";
import { naira, note } from "./state";
import { book } from "./bank";
import { seeded } from "./rng";

/** Something that just happened, for missions and stamps. */
export type Moment =
  | { kind: "action"; id: string; place: string; food?: boolean; social?: boolean; fun?: number; shift?: boolean; media?: boolean; pvc?: "register" | "collect"; vote?: boolean; takeaway?: boolean; house?: boolean; carHire?: boolean }
  | { kind: "trip"; mode: string }
  | { kind: "served" };

export interface Mission {
  id: string;
  label: string;
  /** How many times. */
  need: number;
  reward: number;
  match: (m: Moment) => boolean;
}

const act = (m: Moment) => (m.kind === "action" ? m : null);
const FAITH = new Set(["pray", "cpray", "jummah", "service", "vigil", "tafsir"]);
const LOCAL_FOOD = new Set(["buka", "amala", "item7"]);

export const MISSIONS: Mission[] = [
  { id: "localfood", label: "Eat at a buka or food spot", need: 1, reward: 1500, match: (m) => !!act(m)?.food && LOCAL_FOOD.has(act(m)!.place) },
  { id: "keke", label: "Take a keke or okada somewhere", need: 1, reward: 1000, match: (m) => m.kind === "trip" && (m.mode === "keke" || m.mode === "okada") },
  { id: "walk", label: "Walk to a place", need: 1, reward: 1000, match: (m) => m.kind === "trip" && m.mode === "walk" },
  { id: "gist", label: "Gist with people twice", need: 2, reward: 1500, match: (m) => !!act(m)?.social },
  { id: "work", label: "Do a full shift", need: 1, reward: 3000, match: (m) => !!act(m)?.shift },
  { id: "bank", label: "Visit the bank", need: 1, reward: 1000, match: (m) => act(m)?.place === "bank" || act(m)?.place === "klario" },
  { id: "counter", label: "Get served at a counter", need: 1, reward: 1500, match: (m) => m.kind === "served" },
  { id: "news", label: "Catch up on the news", need: 1, reward: 1000, match: (m) => !!act(m)?.media },
  { id: "faith", label: "Pray or go to a service", need: 1, reward: 1000, match: (m) => FAITH.has(act(m)?.id ?? "") },
  { id: "fun", label: "Do something really fun", need: 1, reward: 1500, match: (m) => (act(m)?.fun ?? 0) >= 20 },
  { id: "homefood", label: "Eat at home", need: 1, reward: 1000, match: (m) => act(m)?.id === "cook" || act(m)?.id === "eat-takeaway" },
];
const MISSION = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

export interface Stamp {
  id: string;
  label: string;
  match?: (m: Moment) => boolean;
}

/** Firsts, in the order a life tends to meet them. */
export const STAMPS: Stamp[] = [
  { id: "keke", label: "First keke ride", match: (m) => m.kind === "trip" && m.mode === "keke" },
  { id: "okada", label: "First okada ride", match: (m) => m.kind === "trip" && m.mode === "okada" },
  { id: "danfo", label: "First danfo", match: (m) => m.kind === "trip" && (m.mode === "danfo" || m.mode === "bus") },
  { id: "hired", label: "Rode in a hired car", match: (m) => m.kind === "trip" && m.mode === "hire" },
  { id: "served", label: "Waited your turn", match: (m) => m.kind === "served" },
  { id: "shift", label: "First full shift", match: (m) => !!act(m)?.shift },
  { id: "registered", label: "Registered to vote", match: (m) => act(m)?.pvc === "register" },
  { id: "pvc", label: "PVC in hand", match: (m) => act(m)?.pvc === "collect" },
  { id: "voted", label: "Voted", match: (m) => !!act(m)?.vote },
  { id: "takeaway", label: "Take-away for the house", match: (m) => !!act(m)?.takeaway },
  { id: "home", label: "New home", match: (m) => !!act(m)?.house },
  { id: "carhire", label: "Car and driver for the day", match: (m) => !!act(m)?.carHire },
  { id: "faith", label: "Prayed with the town", match: (m) => FAITH.has(act(m)?.id ?? "") },
  { id: "perfect", label: "Perfect day: all three missions" },
  { id: "week", label: "Seven days in a row" },
];
const STAMP_LABEL = Object.fromEntries(STAMPS.map((s) => [s.id, s.label]));

export interface Daily {
  day: string;
  missions: { id: string; got: number }[];
  /** Activities done today. Signed in with PLAY_ACTIVITIES or more, the day counts as one play (season credits). */
  acts?: number;
}

/** A day counts as a play for the season credits once you have done this many activities (owner, 9 Oct 2026). */
export const PLAY_ACTIVITIES = 5;

/** Whether this real day (WAT) counts as a play: at least PLAY_ACTIVITIES activities done. */
export const playedOn = (s: GameState, day: string) => s.flags.daily?.day === day && (s.flags.daily.acts ?? 0) >= PLAY_ACTIVITIES;

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Today's three missions, the same all day for this citizen. */
export function missionsFor(day: string, who: string): string[] {
  const R = seeded(hash(`${day}|${who}`));
  const pool = MISSIONS.map((m) => m.id);
  const out: string[] = [];
  while (out.length < 3) {
    const id = pool.splice(Math.floor(R() * pool.length), 1)[0];
    out.push(id);
  }
  return out;
}

/** Today's missions, rolled fresh on a new day. */
export function dailyOf(s: GameState, day: string): Daily {
  const d = s.flags.daily;
  if (d && d.day === day && Array.isArray(d.missions)) return d;
  const fresh: Daily = { day, missions: missionsFor(day, s.citizen?.name ?? s.char?.name ?? "you").map((id) => ({ id, got: 0 })) };
  s.flags.daily = fresh;
  return fresh;
}

/** Mutates s: give a stamp once, with a note. */
export function stamp(s: GameState, id: string) {
  const book_ = s.flags.stamps && typeof s.flags.stamps === "object" ? s.flags.stamps : {};
  if (book_[id]) return;
  book_[id] = s.t;
  s.flags.stamps = book_;
  s.toasts.push(`New stamp: ${STAMP_LABEL[id] ?? id}`);
}

/** Mutates s: something happened. Missions move on, stamps for firsts, rewards paid. */
export function track(s: GameState, m: Moment, day: string) {
  for (const st of STAMPS) if (st.match?.(m)) stamp(s, st.id);
  const d = dailyOf(s, day);
  if (m.kind === "action") d.acts = (d.acts ?? 0) + 1;
  for (const ms of d.missions) {
    const def = MISSION[ms.id];
    if (!def || ms.got >= def.need || !def.match(m)) continue;
    ms.got++;
    if (ms.got >= def.need) {
      book(s, def.reward, `Daily mission: ${def.label}`, "gift");
      s.toasts.push(`Mission done: ${def.label}. +${naira(def.reward)}`);
    }
  }
  if (d.missions.every((ms) => ms.got >= (MISSION[ms.id]?.need ?? 1))) stamp(s, "perfect");
}

const yesterday = (day: string) => new Date(Date.parse(`${day}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** The streak reward for day n of a streak: ₦500 a day, up to ₦3,500 from day seven. */
export const streakReward = (n: number) => Math.min(7, n) * 500;

/** In the last week before polls open, ask once whether the player wants their name in the closing credits. */
function creditsReminder(s: GameState, day: string) {
  const left = (Date.parse(PRESIDENTIAL_2027.pollsOpen) - Date.parse(`${day}T00:00:00+01:00`)) / 86_400_000;
  if (!s.citizen || s.flags.credits !== undefined || s.seen.creditsAsk || left > 7 || left < 0) return;
  s.seen.creditsAsk = true;
  note(s, "Your name in the credits?", "When the season ends, the players who played the most are named in the closing credits. Only those who agree, and only your citizen's name and LGA. Turn it on in the menu: Show my name in the closing credits.");
}

/** Mutates s: the first visit of a real day checks you in. Returns true if it did. */
export function checkIn(s: GameState, day: string): boolean {
  const st = s.flags.streak;
  if (st && st.last === day) return false;
  const count = st && st.last === yesterday(day) ? st.count + 1 : 1;
  s.flags.streak = { last: day, count };
  const reward = streakReward(count);
  book(s, reward, `Day ${count} streak`, "gift");
  dailyOf(s, day);
  note(
    s,
    count > 1 ? `Day ${count} in a row!` : "Welcome back",
    `${count > 1 ? `You've played ${count} days running.` : "Your streak starts today."} Here's ${naira(reward)}. Today's three missions are on your phone in Daily. Come back tomorrow to keep the streak.`,
  );
  if (count >= 7) stamp(s, "week");
  creditsReminder(s, day);
  return true;
}
