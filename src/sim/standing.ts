// Where you stand in life, and who you know.
//
// Class follows your life: once a game day it is checked against your money, home, car and job. You
// rise after holding a richer life for a few days, and fall (more slowly, and only when properly broke)
// after a run of hard days. A rich citizen who simply hasn't bought anything never drops a class.
//
// Connections (0 to 100) grow from gisting, owambes, church and mosque, town halls and friends. They
// open the political ladder and nudge every job application a little: knowing people helps.
import type { ClassId } from "../data/jobs";
import { MINIMUM_WAGE } from "../data/careers";
import { HOMES } from "../data/jobs";
import { HOUSE } from "../data/shops";
import { netWorth } from "./bank";
import { log, note, type GameState } from "./state";
import { dayNum } from "./time";

export const CONNECTIONS_MAX = 100;
/** Most connections one game day can add, so grinding gist all day doesn't buy a political career. */
export const CONNECTIONS_PER_DAY = 8;
/** Days a richer life must last before you move up, and a broke one before you move down. */
export const RISE_DAYS = 3;
export const FALL_DAYS = 7;

const RANK: Record<ClassId, number> = { poor: 0, middle: 1, rich: 2 };
const BY_RANK: ClassId[] = ["poor", "middle", "rich"];

/** Progress toward a class change: which way, and for how many days in a row. */
export interface Standing {
  toward: ClassId | null;
  days: number;
  /** Connections gained so far today, and which game day that is. */
  connDay: number;
  connToday: number;
}

export const freshStanding = (): Standing => ({ toward: null, days: 0, connDay: -1, connToday: 0 });

/** Connections gained from each action, by id. Faith, community and gisting count; so do friends. */
export const CONNECTION_GAIN: Record<string, number> = {
  // Gisting
  gist: 1, haggle: 1, drivers: 1, elders: 2, chill: 1, coach: 1, bar: 1, drink: 1, suya: 1,
  // Ceremonies and community
  naming: 3, townhall: 3, debate: 2, edu: 2, help: 3, seminar: 2, table: 3,
  // Faith
  pray: 1, cpray: 1, jummah: 3, service: 3, vigil: 2, tafsir: 2,
  // Work networking
  recruit: 2, officer: 1, pitch: 1,
};
/** An owambe is where Nigerians network: going adds this many. */
export const OWAMBE_CONNECTIONS = 5;
/** Each new heart with a friend. */
export const FRIEND_CONNECTIONS = 2;

/** Add connections, within today's cap and the maximum. Returns how many were actually added. */
export function addConnections(s: GameState, n: number): number {
  if (n <= 0 || !s.citizen) return 0;
  const today = dayNum(s.t);
  if (s.standing.connDay !== today) s.standing = { ...s.standing, connDay: today, connToday: 0 };
  const room = Math.min(CONNECTIONS_PER_DAY - s.standing.connToday, CONNECTIONS_MAX - s.connections);
  const got = Math.max(0, Math.min(n, room));
  s.connections += got;
  s.standing.connToday += got;
  return got;
}

/** How grand your home is, 0 to 4: a house you bought, or the home you started in. */
function homeTier(s: GameState): number {
  if (s.house && Object.hasOwn(HOUSE, s.house)) return HOUSE[s.house].tier;
  const home = s.citizen?.home ?? "";
  if (HOMES.rich.includes(home)) return 3;
  if (HOMES.middle.includes(home)) return 1;
  return 0;
}

/** Monthly pay from a salaried job. */
const salary = (s: GameState) => (s.citizen?.employed ? s.citizen.monthlyPay : 0);

/** The class your life has earned you, before any waiting: up, down or where you are. */
export function earnedClass(s: GameState): ClassId {
  const c = s.citizen;
  if (!c) return "poor";
  const worth = netWorth(s);
  const bought = !!s.house && Object.hasOwn(HOUSE, s.house);
  const tier = homeTier(s);
  const pay = salary(s);
  const current = c.cls;

  const risesToRich = worth >= 50_000_000 || (bought && tier >= 3 && worth >= 5_000_000) || pay >= 1_500_000;
  const risesToMiddle = worth >= 2_000_000 || bought || pay >= 150_000 || !!s.car;
  if (current !== "rich" && risesToRich) return "rich";
  if (current === "poor" && risesToMiddle) return "middle";

  // Falling needs real hardship: lower bars than rising, so you don't bounce at the line.
  const fallsFromRich = worth < 5_000_000 && pay < 1_500_000 && !(bought && tier >= 3);
  const fallsFromMiddle = worth < 50_000 && pay < MINIMUM_WAGE && !bought && !s.car;
  if (current === "rich" && fallsFromRich) return fallsFromMiddle ? "poor" : "middle";
  if (current === "middle" && fallsFromMiddle) return "poor";
  return current;
}

/** Once a game day: move toward the class your life has earned, after enough days in a row. */
export function checkStanding(s: GameState) {
  const c = s.citizen;
  if (!c) return;
  const want = earnedClass(s);
  if (want === c.cls) {
    s.standing = { ...s.standing, toward: null, days: 0 };
    return;
  }
  const days = s.standing.toward === want ? s.standing.days + 1 : 1;
  const up = RANK[want] > RANK[c.cls];
  if (days < (up ? RISE_DAYS : FALL_DAYS)) {
    s.standing = { ...s.standing, toward: want, days };
    return;
  }
  // One step at a time: poor to middle, then middle to rich.
  const next = BY_RANK[RANK[c.cls] + (up ? 1 : -1)];
  c.cls = next;
  s.standing = { ...s.standing, toward: null, days: 0 };
  if (up) {
    note(s, "You've moved up", `You've moved up. People now call you oga. You live like the ${next === "rich" ? "rich" : "middle class"} now: other doors open.`);
    log(s, `You moved up to the ${next === "rich" ? "rich" : "middle class"}.`);
  } else {
    note(s, "Hard times", `Money has been tight for a while. You are ${next === "poor" ? "poor" : "middle class"} again now. Hustle, save and you will rise again.`);
    log(s, `Hard times: you are ${next === "poor" ? "poor" : "middle class"} again.`);
  }
}
