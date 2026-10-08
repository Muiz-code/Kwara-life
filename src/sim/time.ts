import type { Place } from "../data/ilorin/places";

export const MIN_PER_HOUR = 60;
export const MIN_PER_DAY = 1440;
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_PLURALS = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"];

/** t is game minutes since midnight on day 1 (a Monday). */
export const hourOf = (t: number) => Math.floor((t % MIN_PER_DAY) / MIN_PER_HOUR);
export const dayNum = (t: number) => Math.floor(t / MIN_PER_DAY) + 1;
/** 0 = Monday ... 6 = Sunday */
export const dayOfWeek = (t: number) => Math.floor(t / MIN_PER_DAY) % 7;

/**
 * The world clock. Time of day, the day of the week and shop hours follow real Nigeria time (WAT) for
 * every player; the game's own clock (s.t) still drives needs, which drain while you play.
 * The store switches the real clock on in the browser; tests and the server leave it off and use s.t.
 */
let worldNow: (() => number) | null = null;
export const setWorldClock = (now: (() => number) | null) => {
  worldNow = now;
};

/** Monday 12 October 2026, 00:00 WAT: day 1 of the season, the Monday of launch week. */
const SEASON_MONDAY = Date.parse("2026-10-12T00:00:00+01:00");

/** Real time as game minutes since that Monday's midnight, in WAT. */
export const watT = (now: number) => Math.floor((now - SEASON_MONDAY) / 60000);

/** The minute of the world: real WAT when the world clock is on, the game's own clock otherwise. */
export function worldT(s: { t: number }): number {
  if (!worldNow) return s.t;
  const t = watT(worldNow());
  // Before the season starts, wrap into the current week so the day and hour are still right.
  return t >= 0 ? t : ((t % (7 * MIN_PER_DAY)) + 7 * MIN_PER_DAY) % (7 * MIN_PER_DAY);
}

export function fmtHour(h: number): string {
  h = h % 24;
  const ap = h < 12 ? "am" : "pm";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return hh + ap;
}

export function fmtTime(t: number): string {
  const m = t % MIN_PER_DAY;
  const h = Math.floor(m / 60);
  const mi = m % 60;
  const ap = h < 12 ? "am" : "pm";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(mi).padStart(2, "0")}${ap}`;
}

export function fmtDuration(min: number): string {
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${min} min`;
}

/** Open hours may run past midnight: a club open [21, 4] is open from 9pm to 4am. */
export const isOpen = (p: Pick<Place, "open">, h: number) =>
  p.open[0] <= p.open[1] ? h >= p.open[0] && h < p.open[1] : h >= p.open[0] || h < p.open[1];

export const openText = (p: Pick<Place, "open">) =>
  p.open[0] === 0 && p.open[1] === 24 ? "Open all day" : `Open ${fmtHour(p.open[0])} to ${fmtHour(p.open[1])}`;

/** Darkness from 0 (day) to 0.55 (night). Dusk 5:30pm to 8pm, dawn 5am to 7am. */
export function nightLevel(t: number): number {
  const m = (t % MIN_PER_DAY) / 60;
  if (m >= 7 && m < 17.5) return 0;
  if (m >= 17.5 && m < 20) return ((m - 17.5) / 2.5) * 0.55;
  if (m >= 5 && m < 7) return ((7 - m) / 2) * 0.55;
  return 0.55;
}
