// Travelling between LGAs and states. Everyone can go anywhere; you can only register, collect your PVC,
// sleep at home, buy votes and vote in your own LGA. Interstate trips run between state capitals; trips
// between LGAs of the same state count as a short bus ride.
import { AIRPORT_NAMES, CAPITALS, airportLga } from "../data/capitals";
import { markVisited } from "./explore";
import { PRESIDENTIAL_2027, pollsAreOpen, seasonClosed } from "../data/calendar";
import { LGA, LGAS } from "../data/geography";
import type { ClassId } from "../data/jobs";
import { STATE } from "../data/states";
import type { ZoneCode } from "../data/zones";
import { advance } from "./needs";
import type { Rng } from "./rng";
import { clone, log, naira, note, type GameState } from "./state";
import { BIOMES, LOCAL_FOOD, lookOf } from "../data/biomes";
import { FUEL_FARE_FACTOR, fuelScarcity } from "./naija-life";
import { book } from "./bank";
import { maybePoliceStop } from "./police";

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

/** Ways this citizen can travel between LGAs: their class's, plus a car they bought. */
export function journeyModes(s: GameState): JourneyMode[] {
  const modes = [...MODES_FOR_CLASS[s.citizen?.cls ?? "poor"]];
  if (s.car && !modes.includes("car")) modes.push("car");
  return modes;
}

export function quoteJourney(s: GameState, toLga: string, mode: JourneyMode, now: number, cal = PRESIDENTIAL_2027): JourneyQuote {
  const from = currentLga(s);
  const c = s.citizen;
  const base = { mode, km: 0, minutes: 0, fare: 0 };
  if (!c || !from) return { ...base, blocked: "Create your citizen first" };
  if (!Object.hasOwn(LGA, toLga)) return { ...base, blocked: "Pick a real LGA" };
  if (!Object.hasOwn(JOURNEY_LABEL, mode)) return { ...base, blocked: "Pick a way to travel" };
  const km = journeyKm(from, toLga);
  const a = LGA[from];
  const b = LGA[toLga];
  const rush = now >= Date.parse(cal.pollsOpen) - RUSH_DAYS * 86_400_000 && now < Date.parse(cal.pollsClose);
  let minutes = 0;
  let fare = 0;
  if (mode === "bus") {
    minutes = Math.round((km / 60 + 1) * 60);
    fare = round500((2000 + km * 30) * (rush ? RUSH_FACTOR : 1) * (fuelScarcity(s) ? FUEL_FARE_FACTOR : 1));
  } else if (mode === "flight") {
    minutes = Math.round((3.5 + km / 600) * 60);
    fare = round500(70000 + km * 60);
  } else {
    minutes = Math.round((km / 80 + 0.5) * 60);
    fare = round500(km * 60);
  }
  let blocked: string | null = null;
  if (seasonClosed(cal, now)) blocked = "The season is over. Thank you for voting";
  else if (pollsAreOpen(cal, now)) blocked = "Movement is restricted on election day";
  else if (km === 0) blocked = "You are already here";
  // A car you bought takes you anywhere a rich citizen's car can.
  else if (!journeyModes(s).includes(mode)) blocked = mode === "car" ? "You don't have a car. Buy one at the car dealer" : "Flights are out of your budget";
  else if (mode === "flight" && a.stateCode === b.stateCode) blocked = "No flights within a state. Take the bus";
  else if (mode === "flight" && (!CAPITALS[a.stateCode].airport || !CAPITALS[b.stateCode].airport))
    blocked = `No flights between ${STATE[a.stateCode].name} and ${STATE[b.stateCode].name}. Take the bus`;
  else if (fare > s.money) blocked = "Not enough money";
  else if (mode === "bus" && !BUS_FROM.has(s.loc)) blocked = "Interstate buses leave from the motor park or the bus terminal";
  return { mode, km, minutes, fare, blocked };
}

/** Where interstate buses leave from. */
export const BUS_FROM = new Set(["park", "terminal"]);

/** How people greet a visitor, by the state's language. */
const WELCOME: Record<string, string> = { ha: "Sannu da zuwa!", yo: "Ẹ kú àbọ̀!", ig: "Nnọọ!", pcm: "Welcome o!", en: "Welcome!" };

/** Mutates s: the welcome card for a state, longer the first time you visit. */
function welcome(s: GameState, stateCode: string) {
  const st = STATE[stateCode];
  const first = !s.seen[`visit:${stateCode}`];
  s.seen[`visit:${stateCode}`] = true;
  const look = BIOMES[lookOf(st)];
  const food = LOCAL_FOOD[st.zone];
  const greet = WELCOME[st.lang] ?? WELCOME.en;
  note(
    s,
    greet === WELCOME.en ? `Welcome to ${st.name}` : `${greet} Welcome to ${st.name}`,
    first
      ? `${st.slogan}. This is ${look.name} country: look around, the towns here are built their own way. Don't leave without seeing ${st.landmark.name} or eating ${food.dish.toLowerCase()} at a ${food.place.toLowerCase()}.`
      : `Back in ${st.name}. ${st.landmark.name} is still waiting for you.`,
  );
}

export const JOURNEY_LABEL: Record<JourneyMode, string> = { bus: "by bus", flight: "by air", car: "in your car" };

/** The town in a state with its airport, as an LGA code, or undefined if the state has none. */
export function airportTown(stateCode: string): string | undefined {
  const name = airportLga(stateCode);
  return name ? LGAS.find((l) => l.stateCode === stateCode && l.name === name)?.code : undefined;
}

/** Where a journey ends: a flight lands in the state's airport town, buses and cars go where you asked. */
export const landingTown = (toLga: string, mode: JourneyMode) => (mode === "flight" ? (airportTown(LGA[toLga].stateCode) ?? toLga) : toLga);

/** Travel to another LGA. A bus or car brings you to its motor park; a flight lands you at the state's airport. */
export function takeJourney(state: GameState, toLga: string, mode: JourneyMode, now: number, rng: Rng, cal = PRESIDENTIAL_2027): GameState | { blocked: string } {
  const q = quoteJourney(state, toLga, mode, now, cal);
  if (q.blocked) return { blocked: q.blocked };
  const s = clone(state);
  const c = s.citizen!;
  const currentLgaBefore = currentLga(state)!;
  book(s, -q.fare, `Trip to ${LGA[toLga]?.name ?? "another town"} ${JOURNEY_LABEL[mode]}`, "transport");
  advance(s, q.minutes, rng);
  const land = landingTown(toLga, mode);
  s.at = land === c.lgaCode ? null : land;
  s.loc = mode === "flight" ? "airport" : land === c.lgaCode ? "home" : "park";
  s.inside = false;
  const dest = LGA[land];
  let msg = `You travelled to ${dest.name}, ${STATE[dest.stateCode].name} ${JOURNEY_LABEL[mode]} for ${naira(q.fare)}.`;
  if (mode === "flight" && AIRPORT_NAMES[dest.stateCode]) msg += ` You landed at ${AIRPORT_NAMES[dest.stateCode]}${land !== toLga ? `. Take a bus on to ${LGA[toLga].name} from the motor park` : ""}.`;
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
  if (land === c.lgaCode) msg += " Welcome home.";
  else if (dest.stateCode !== LGA[currentLgaBefore].stateCode) welcome(s, dest.stateCode);
  markVisited(s, dest.stateCode);
  log(s, msg);
  if (mode !== "flight") maybePoliceStop(s, true, rng);
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
      return `Register and collect your PVC at the VINEC office in ${home.name}`;
    case "vote":
      return `You can only vote at your polling unit in ${home.name}. Travel home first`;
    case "bribe":
      return "Nobody here knows you";
  }
}

// ---- Crossing servers ----
// Each zone is its own server (Supabase shard). A journey into another zone hands the citizen over from one
// server to the other, shown as a "long journey" loading screen. The handover itself is quick; the wait scales
// with how far apart the zones are, up to 30 seconds. Journeys inside a zone need no handover.

/** Zone neighbours, roughly by geography. */
const ZONE_LINKS: Record<ZoneCode, ZoneCode[]> = {
  NW: ["NE", "NC"],
  NE: ["NW", "NC"],
  NC: ["NW", "NE", "SW", "SS", "SE"],
  SW: ["NC", "SS"],
  SS: ["SW", "SE", "NC"],
  SE: ["SS", "NC"],
};

/** Number of zone hops between two zones (0 when the same). */
export function zoneHops(a: ZoneCode, b: ZoneCode): number {
  if (a === b) return 0;
  const seen = new Set<ZoneCode>([a]);
  let frontier: ZoneCode[] = [a];
  for (let hops = 1; frontier.length; hops++) {
    const next: ZoneCode[] = [];
    for (const z of frontier) {
      for (const n of ZONE_LINKS[z]) {
        if (n === b) return hops;
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return 3;
}

export const MAX_HANDOVER_SECONDS = 30;

/** Real seconds of the "long journey" loading screen between two LGAs. 0 inside a zone. */
export function handoverSeconds(fromLga: string, toLga: string): number {
  const a = STATE[LGA[fromLga].stateCode].zone;
  const b = STATE[LGA[toLga].stateCode].zone;
  const hops = zoneHops(a, b);
  return hops === 0 ? 0 : Math.min(MAX_HANDOVER_SECONDS, 6 + hops * 8);
}
