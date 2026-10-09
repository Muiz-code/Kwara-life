import { DECAY, NEED_KEYS, NEED_PACE, SLEEP_DECAY_FACTOR, type NeedKey } from "../data/needs";
import type { GameState } from "./state";
import type { Rng } from "./rng";
import { hourly } from "./events";

export const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Mutates s: adds the need changes, clamped to 0..100. */
export function applyFx(s: GameState, fx: Partial<Record<NeedKey, number>>) {
  for (const k in fx) {
    const key = k as NeedKey;
    let v = fx[key] ?? 0;
    // Smelling: people only gist with you briefly.
    if (key === "social" && v > 0 && s.flags.smelly) v = Math.round(v / 2);
    s.needs[key] = clamp(s.needs[key] + v);
  }
}

const EMPTY_WARNING: Record<NeedKey, string> = {
  food: "You're starving. Eat in the next 2 minutes or you'll end up in hospital",
  energy: "You're exhausted. Rest in the next 2 minutes or you'll collapse",
  hygiene: "You need a bath. In 2 minutes people will start to smell you",
  fun: "You're bored stiff. Do something fun soon or you'll feel low",
  social: "You haven't talked to anyone in ages. Gist with someone soon or you'll feel low",
};

/** Mutates s: starts the 2-minute clock on a need that just hit empty, and clears it on one that rose. */
export function markEmpty(s: GameState) {
  const at = s.flags.emptyAt && typeof s.flags.emptyAt === "object" ? s.flags.emptyAt : {};
  let changed = false;
  for (const k of NEED_KEYS) {
    if (s.needs[k] <= 0 && typeof at[k] !== "number") {
      at[k] = s.t;
      s.toasts.push(EMPTY_WARNING[k]);
      changed = true;
    } else if (s.needs[k] > 0 && at[k] !== undefined) {
      delete at[k];
      changed = true;
    }
  }
  if (changed || s.flags.emptyAt) s.flags.emptyAt = at;
}

/** Mutates s: runs the clock forward minute by minute, firing hourly events. */
export function advance(s: GameState, mins: number, rng: Rng, opts: { sleep?: boolean } = {}) {
  for (let i = 0; i < mins; i++) {
    for (const k of NEED_KEYS) {
      let r = DECAY[k] * NEED_PACE;
      // Smelling keeps people away; feeling low saps your strength.
      if (k === "social" && s.flags.smelly) r *= 2;
      if (k === "energy" && s.flags.low) r *= 1.5;
      if (opts.sleep) {
        if (k === "energy") continue;
        r *= SLEEP_DECAY_FACTOR;
      }
      s.needs[k] = clamp(s.needs[k] - r);
    }
    markEmpty(s);
    s.t++;
    if (s.t % 60 === 0) hourly(s, rng);
  }
}

export function mood(s: GameState): string {
  const avg = NEED_KEYS.reduce((sum, k) => sum + s.needs[k], 0) / NEED_KEYS.length;
  if (avg > 70) return "Feeling fine";
  if (avg > 45) return "Managing";
  if (avg > 25) return "Stressed";
  return "Wahala";
}
