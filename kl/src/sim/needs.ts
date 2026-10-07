import { DECAY, NEED_KEYS, SLEEP_DECAY_FACTOR, type NeedKey } from "../data/needs";
import type { GameState } from "./state";
import type { Rng } from "./rng";
import { hourly } from "./events";

export const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Mutates s: adds the need changes, clamped to 0..100. */
export function applyFx(s: GameState, fx: Partial<Record<NeedKey, number>>) {
  for (const k in fx) {
    const key = k as NeedKey;
    s.needs[key] = clamp(s.needs[key] + (fx[key] ?? 0));
  }
}

/** Mutates s: runs the clock forward minute by minute, firing hourly events. */
export function advance(s: GameState, mins: number, rng: Rng, opts: { sleep?: boolean } = {}) {
  for (let i = 0; i < mins; i++) {
    for (const k of NEED_KEYS) {
      let r = DECAY[k];
      if (opts.sleep) {
        if (k === "energy") continue;
        r *= SLEEP_DECAY_FACTOR;
      }
      s.needs[k] = clamp(s.needs[k] - r);
    }
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
