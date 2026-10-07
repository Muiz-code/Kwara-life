import { PLACE } from "../data/ilorin/places";
import { PRESIDENTIAL_2027, pollsAreOpen, seasonClosed } from "../data/calendar";
import type { GameState } from "./state";
import { clone, log } from "./state";
import type { Rng } from "./rng";
import { hourOf } from "./time";
import { advance, applyFx, clamp } from "./needs";
import { checkCritical } from "./critical";
import { horseToday } from "./actions";
import { route, type Route } from "./world";
import { FLOOD_DELAY, FUEL_FARE_FACTOR, flooded, fuelScarcity } from "./naija-life";
import { maybePoliceStop } from "./police";

export type ModeId = "walk" | "keke" | "okada" | "bus" | "horse";

export interface Mode {
  label: string;
  note: string;
  /** Game minutes for a route of length d (world pixels). */
  minutes: (d: number) => number;
  fare: (d: number) => number;
}

const kekeFare = (d: number) => 100 + Math.round(d / 150) * 50;

export const MODES: Record<ModeId, Mode> = {
  walk: { label: "Walk", note: "Free, but tiring", minutes: (d) => Math.round(d / 7), fare: () => 0 },
  keke: { label: "Keke", note: "The normal way", minutes: (d) => Math.round(4 + d / 30), fare: kekeFare },
  okada: {
    label: "Okada",
    note: "Fast and cheap, small wahala risk",
    minutes: (d) => Math.round(3 + d / 42),
    fare: (d) => Math.max(100, Math.round((kekeFare(d) * 0.75) / 50) * 50),
  },
  bus: { label: "Korope bus", note: "Cheapest, waits at stops", minutes: (d) => Math.round(12 + d / 30), fare: (d) => 150 + Math.round(d / 300) * 50 },
  horse: { label: "Durbar horse", note: "Slow, but everyone waves", minutes: (d) => Math.round(d / 11), fare: () => 0 },
};

export const MODE_IDS = Object.keys(MODES) as ModeId[];

/** Longest walk allowed, in world pixels. */
export const MAX_WALK = 1300;

/** Real-time animation length per world pixel (ms), and the cap. */
export const ANIM_MS_PER_PX: Record<ModeId, number> = { walk: 2.4, keke: 1.1, okada: 0.85, bus: 1.2, horse: 2 };
export const tripAnimMs = (mode: ModeId, d: number) => Math.min(9000, 900 + d * ANIM_MS_PER_PX[mode]);

export interface TripQuote {
  route: Route;
  modes: Record<ModeId, { minutes: number; fare: number }>;
}

export function quoteTrip(from: string, to: string): TripQuote {
  const r = route(from, to);
  const modes = {} as TripQuote["modes"];
  for (const k of MODE_IDS) modes[k] = { minutes: MODES[k].minutes(r.length), fare: MODES[k].fare(r.length) };
  return { route: r, modes };
}

export function modeBlockReason(s: GameState, mode: ModeId, q: TripQuote): string | null {
  if (mode === "walk" && q.route.length > MAX_WALK) return "Too far to walk";
  if (mode === "horse" && !horseToday(s)) return "Hire a horse at the Emir's Palace";
  if (mode === "okada" && q.route.highway) return "Okadas don't do the Malete road";
  if (q.modes[mode].fare > s.money) return "Not enough money";
  return null;
}

export interface Trip {
  dest: string;
  mode: ModeId;
  route: Route;
  minutes: number;
  fare: number;
}

/**
 * Start a trip. The caller animates it and runs the clock for trip.minutes
 * (advance), then calls finishTrip.
 */
export function startTrip(state: GameState, dest: string, mode: ModeId, now = 0): { state: GameState; trip: Trip } | { blocked: string } {
  if (dest === state.loc) return { blocked: "You are already here" };
  if (now && seasonClosed(PRESIDENTIAL_2027, now)) return { blocked: "The season is over. Thank you for voting" };
  // Election day: you may only move between home and your polling unit.
  if (now && pollsAreOpen(PRESIDENTIAL_2027, now) && !["pu", "home"].includes(dest)) return { blocked: "Movement is restricted on election day. Go and vote" };
  const q = quoteTrip(state.loc, dest);
  const why = modeBlockReason(state, mode, q);
  if (why) return { blocked: why };
  const s = clone(state);
  s.inside = false;
  const fare = fuelScarcity(s) ? Math.round((q.modes[mode].fare * FUEL_FARE_FACTOR) / 50) * 50 : q.modes[mode].fare;
  if (fare > s.money) return { blocked: "Not enough money" };
  return { state: s, trip: { dest, mode, route: q.route, minutes: q.modes[mode].minutes, fare } };
}

/** Arrive: pay, tire, roll for something happening on the way. */
export function finishTrip(state: GameState, trip: Trip, rng: Rng): GameState {
  const s = clone(state);
  const d = trip.route.length;
  s.money -= trip.fare;
  if (trip.mode === "walk") {
    s.needs.energy = clamp(s.needs.energy - d / 40);
    s.needs.hygiene = clamp(s.needs.hygiene - d / 60);
  }
  if (trip.mode === "horse") {
    applyFx(s, { fun: 10, social: 6 });
    s.flags.rode = true;
  }
  s.loc = trip.dest;
  if (trip.dest === "kwasu") s.flags.kwasu = true;

  let msg = `You went to ${PLACE[trip.dest].name} by ${MODES[trip.mode].label.toLowerCase()}.`;
  const r = rng();
  const h = hourOf(s.t);
  if (trip.mode === "okada" && r < 0.08) {
    applyFx(s, { hygiene: -15, fun: -5 });
    msg += " The okada man swerved into a pothole. You're fine, just dusty.";
  } else if (trip.mode === "horse" && r < 0.5) {
    applyFx(s, { social: 8 });
    msg += " Children ran after your horse shouting and waving.";
  } else if (trip.route.highway && r < 0.25) {
    advance(s, 15, rng);
    msg += " Police checkpoint on the Malete road added 15 minutes.";
  } else if (trip.route.highway && trip.mode === "bus" && r < 0.4) {
    advance(s, 30, rng);
    msg += " The korope broke down near Shao. 30 minutes by the roadside.";
  } else if (trip.mode === "keke" && r < 0.08 && s.money >= 100) {
    s.money -= 100;
    msg += " The keke man had no change, so you dashed him ₦100.";
  } else if (r < 0.16) {
    advance(s, 20, rng);
    msg += " Traffic at Challenge added 20 minutes.";
  } else if (r < 0.24 && h >= 13 && h < 18) {
    applyFx(s, { hygiene: -15 });
    msg += " Rain caught you on the way.";
  }
  if (flooded(s)) {
    advance(s, FLOOD_DELAY, rng);
    msg += " Flooded roads added 30 minutes.";
  }
  log(s, msg);
  if (trip.mode !== "walk" && trip.mode !== "horse") maybePoliceStop(s, false, rng);
  checkCritical(s, rng);
  return s;
}

/** Start, run the clock, and arrive in one go. */
export function performTrip(state: GameState, dest: string, mode: ModeId, rng: Rng): GameState | { blocked: string } {
  const started = startTrip(state, dest, mode);
  if ("blocked" in started) return started;
  const s = clone(started.state);
  advance(s, started.trip.minutes, rng);
  return finishTrip(s, started.trip, rng);
}
