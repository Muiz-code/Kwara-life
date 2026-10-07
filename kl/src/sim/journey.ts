// Travelling between LGAs and states. Everyone can go anywhere; you can only register, collect your PVC,
// sleep at home, buy votes and vote in your own LGA. Interstate trips run between state capitals; trips
// between LGAs of the same state count as a short bus ride.
import { CAPITALS } from "../data/capitals";
import { PRESIDENTIAL_2027 } from "../data/calendar";
import { LGA } from "../data/geography";
import type { ClassId } from "../data/jobs";
import { STATE } from "../data/states";
import { advance } from "./needs";
import type { Rng } from "./rng";
import { clone, log, naira, type GameState } from "./state";

export type JourneyMode = "bus" | "flight" | "car";

/** Where the citizen is now: their current LGA (home LGA if they have not travelled). */
export const currentLga = (s: GameState) => s.at ?? s.citizen?.lgaCode ?? null;
export const isAway = (s: GameState) => !!s.citizen && currentLga(s) !== s.citizen.lgaCode;

const ROAD_FACTOR = 1.25;
/** Bus distance between two LGAs in the same state. */
const SAME_STATE_KM = 60;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Road distance in km between two LGAs. */
export function journeyKm(fromLga: string, toLga: string): number {
  const a = LGA[fromLga];
  const b = LGA[toLga];
  if (!a || !b) throw new Error("Unknown LGA");
  if (a.code === b.code) return 0;
  if (a.stateCode === b.stateCode) return SAME_STATE_KM;
  return Math.round(haversineKm(CAPITALS[a.stateCode], CAPITALS[b.stateCode]) * ROAD_FACTOR);
}

/** Bus fares go up in the last days before the election: everybody is going home to vote. */
export const RUSH_DAYS = 3;
export const RUSH_FACTOR = 1.5;

export interface JourneyQuote {
  mode: JourneyMode;
  km: number;
  /** Game minutes door to door. */
  minutes: number;
  fare: number;
  blocked: string | null;
}

const round500 = (n: number) => Math.round(n / 500) * 500;

export const MODES_FOR_CLASS: Record<ClassId, JourneyMode[]> = {
  poor: ["bus"],
  middle: ["bus", "flight"],
  rich: ["bus", "flight", "car"],
};

export function quoteJourney(s: GameState, toLga: string, mode: JourneyMode, now: number, cal = PRESIDENTIAL_2027): JourneyQuote {
  const from = currentLga(s);
  const c = s.citizen;
  const base = { mode, km: 0, minutes: 0, fare: 0 };
  if (!c || !from) return { ...base, blocked: "Create your citizen first" };
  const km = journeyKm(from, toLga);
  const a = LGA[from];
  const b = LGA[toLga];
  const rush = now >= Date.parse(cal.pollsOpen) - RUSH_DAYS * 86_400_000 && now < Date.parse(cal.pollsClose);
  let minutes = 0;
  let fare = 0;
  if (mode === "bus") {
    minutes = Math.round((km / 60 + 1) * 60);
    fare = round500((2000 + km * 30) * (rush ? RUSH_FACTOR : 1));
  } else if (mode === "flight") {
    minutes = Math.round((3.5 + km / 600) * 60);
    fare = round500(70000 + km * 60);
  } else {
    minutes = Math.round((km / 80 + 0.5) * 60);
    fare = round500(km * 60);
  }
  let blocked: string | null = null;
  if (km === 0) blocked = "You are already here";
  else if (!MODES_FOR_CLASS[c.cls].includes(mode)) blocked = mode === "car" ? "You don't have a car" : "Flights are out of your budget";
  else if (mode === "flight" && a.stateCode === b.stateCode) blocked = "No flights within a state. Take the bus";
  else if (mode === "flight" && (!CAPITALS[a.stateCode].airport || !CAPITALS[b.stateCode].airport))
    blocked = `No flights between ${STATE[a.stateCode].name} and ${STATE[b.stateCode].name}. Take the bus`;
  else if (fare > s.money) blocked = "Not enough money";
  else if (mode === "bus" && s.loc !== "park") blocked = "Interstate buses leave from the motor park";
  return { mode, km, minutes, fare, blocked };
}

export const JOURNEY_LABEL: Record<JourneyMode, string> = { bus: "by bus", flight: "by air", car: "in your car" };

/** Travel to another LGA. You arrive at its motor park (bus) or in the town centre. */
export function takeJourney(state: GameState, toLga: string, mode: JourneyMode, now: number, rng: Rng, cal = PRESIDENTIAL_2027): GameState | { blocked: string } {
  const q = quoteJourney(state, toLga, mode, now, cal);
  if (q.blocked) return { blocked: q.blocked };
  const s = clone(state);
  const c = s.citizen!;
  s.money -= q.fare;
  advance(s, q.minutes, rng);
  s.at = toLga === c.lgaCode ? null : toLga;
  s.loc = toLga === c.lgaCode ? "home" : "park";
  s.inside = false;
  const dest = LGA[toLga];
  let msg = `You travelled to ${dest.name}, ${STATE[dest.stateCode].name} ${JOURNEY_LABEL[mode]} for ${naira(q.fare)}.`;
  const r = rng();
  if (mode !== "flight" && r < 0.25) {
    advance(s, 30, rng);
    msg += " A police checkpoint added 30 minutes.";
  } else if (mode === "bus" && r < 0.35) {
    advance(s, 90, rng);
    msg += " The bus broke down on the way. 90 minutes by the roadside.";
  } else if (mode === "flight" && r < 0.3) {
    advance(s, 120, rng);
    msg += " The flight was delayed by 2 hours.";
  }
  if (toLga === c.lgaCode) msg += " Welcome home.";
  log(s, msg);
  return s;
}

/** Why something that needs you at home is blocked while you are away, or null. */
export function awayReason(s: GameState, what: "home" | "inec" | "vote" | "bribe"): string | null {
  if (!isAway(s)) return null;
  const home = LGA[s.citizen!.lgaCode];
  switch (what) {
    case "home":
      return "You are away from home. Lodge at a hotel tonight";
    case "inec":
      return `Register and collect your PVC at the INEC office in ${home.name}`;
    case "vote":
      return `You can only vote at your polling unit in ${home.name}. Travel home first`;
    case "bribe":
      return "Nobody here knows you";
  }
}
