import { PLACE } from "../data/ilorin/places";
import { PRESIDENTIAL_2027, pollsAreOpen, seasonClosed } from "../data/calendar";
import type { GameState } from "./state";
import { clone, log } from "./state";
import type { Rng } from "./rng";
import { hourOf, worldT } from "./time";
import { advance, applyFx, clamp } from "./needs";
import { checkCritical } from "./critical";
import { horseToday } from "./actions";
import { route, type Route } from "./world";
import { FLOOD_DELAY, FUEL_FARE_FACTOR, flooded, fuelScarcity } from "./naija-life";
import { book } from "./bank";
import { maybePoliceStop } from "./police";

/** Ilorin's modes. Other maps use the class-based modes in src/data/transport.ts. */
export type ModeId = "walk" | "keke" | "okada" | "bus" | "horse";
/** Any mode id on any map. */
export type AnyModeId = string;

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
export const ANIM_MS_PER_PX: Record<string, number> = { walk: 2.4, keke: 1.1, okada: 0.85, bus: 1.2, horse: 2, danfo: 1.2, ride: 0.9, suv: 0.9 };
/** How long a trip plays on screen: about five seconds across town, longer for far trips, up to ten. */
export const tripAnimMs = (mode: AnyModeId, d: number) => Math.min(10000, Math.max(3500, 2500 + d * (ANIM_MS_PER_PX[mode] ?? 1.1) * 1.5));

/**
 * The map a trip happens on: how to route between its places, which modes it offers, and place names.
 * Ilorin's hand-built map is the default; other maps pass their own (see tripWorldFor in the store).
 */
export interface TripWorld {
  route: (from: string, to: string) => Route;
  modes: Record<string, Mode>;
  modeIds: AnyModeId[];
  placeName: (id: string) => string;
}

export const ILORIN_TRIPS: TripWorld = {
  route,
  modes: MODES,
  modeIds: MODE_IDS,
  placeName: (id) => PLACE[id]?.name ?? id,
};

export interface TripQuote {
  route: Route;
  modes: Record<AnyModeId, { minutes: number; fare: number }>;
}

export function quoteTrip(from: string, to: string, w: TripWorld = ILORIN_TRIPS): TripQuote {
  const r = w.route(from, to);
  const modes: TripQuote["modes"] = {};
  for (const k of w.modeIds) modes[k] = { minutes: w.modes[k].minutes(r.length), fare: w.modes[k].fare(r.length) };
  return { route: r, modes };
}

/** onFoot: the player already walked there in free roam, so the walking distance limit does not apply. */
export function modeBlockReason(s: GameState, mode: AnyModeId, q: TripQuote, onFoot = false): string | null {
  // Own keys only: "constructor" or "__proto__" must not pass as a free way to travel.
  if (!Object.hasOwn(q.modes, mode) || !q.modes[mode]) return "You can't travel that way";
  if (mode === "walk" && !onFoot && q.route.length > MAX_WALK) return "Too far to walk";
  if (mode === "horse" && !horseToday(s)) return "Hire a horse at the Emir's Palace";
  if (mode === "okada" && q.route.highway) return "Okadas don't do the Malete road";
  if (q.modes[mode].fare > s.money) return "Not enough money";
  return null;
}

export interface Trip {
  dest: string;
  destName: string;
  mode: AnyModeId;
  modeLabel: string;
  route: Route;
  minutes: number;
  fare: number;
}

/**
 * Start a trip. The caller animates it and runs the clock for trip.minutes
 * (advance), then calls finishTrip.
 */
export function startTrip(
  state: GameState,
  dest: string,
  mode: AnyModeId,
  now = 0,
  w: TripWorld = ILORIN_TRIPS,
  onFoot = false,
): { state: GameState; trip: Trip } | { blocked: string } {
  if (dest === state.loc) return { blocked: "You are already here" };
  if (now && seasonClosed(PRESIDENTIAL_2027, now)) return { blocked: "The season is over. Thank you for voting" };
  // Election day: you may only move between home and your polling unit.
  if (now && pollsAreOpen(PRESIDENTIAL_2027, now) && !["pu", "home"].includes(dest)) return { blocked: "Movement is restricted on election day. Go and vote" };
  const q = quoteTrip(state.loc, dest, w);
  const why = modeBlockReason(state, mode, q, onFoot);
  if (why) return { blocked: why };
  const s = clone(state);
  s.inside = false;
  const fare = fuelScarcity(s) ? Math.round((q.modes[mode].fare * FUEL_FARE_FACTOR) / 50) * 50 : q.modes[mode].fare;
  if (fare > s.money) return { blocked: "Not enough money" };
  return { state: s, trip: { dest, destName: w.placeName(dest), mode, modeLabel: w.modes[mode].label, route: q.route, minutes: q.modes[mode].minutes, fare } };
}

/** Arrive: pay, tire, roll for something happening on the way. */
export function finishTrip(state: GameState, trip: Trip, rng: Rng): GameState {
  const s = clone(state);
  const d = trip.route.length;
  book(s, -trip.fare, "Fare", "transport");
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

  let msg = `You went to ${trip.destName} by ${trip.modeLabel.toLowerCase()}.`;
  const r = rng();
  const h = hourOf(worldT(s));
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
    book(s, -100, "Small fee", "transport");
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
export function performTrip(state: GameState, dest: string, mode: AnyModeId, rng: Rng, w: TripWorld = ILORIN_TRIPS): GameState | { blocked: string } {
  const started = startTrip(state, dest, mode, 0, w);
  if ("blocked" in started) return started;
  const s = clone(started.state);
  advance(s, started.trip.minutes, rng);
  return finishTrip(s, started.trip, rng);
}
