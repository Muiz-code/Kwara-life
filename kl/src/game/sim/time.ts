import type { Place } from "../data/locations";

export const MIN_PER_HOUR = 60;
export const MIN_PER_DAY = 1440;
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_PLURALS = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"];

/** t is game minutes since midnight on day 1 (a Monday). */
export const hourOf = (t: number) => Math.floor((t % MIN_PER_DAY) / MIN_PER_HOUR);
export const dayNum = (t: number) => Math.floor(t / MIN_PER_DAY) + 1;
/** 0 = Monday ... 6 = Sunday */
export const dayOfWeek = (t: number) => Math.floor(t / MIN_PER_DAY) % 7;

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

export const isOpen = (p: Place, h: number) => h >= p.open[0] && h < p.open[1];

export const openText = (p: Place) =>
  p.open[0] === 0 && p.open[1] === 24 ? "Open all day" : `Open ${fmtHour(p.open[0])} to ${fmtHour(p.open[1])}`;

/** Darkness from 0 (day) to 0.55 (night). Dusk 5:30pm to 8pm, dawn 5am to 7am. */
export function nightLevel(t: number): number {
  const m = (t % MIN_PER_DAY) / 60;
  if (m >= 7 && m < 17.5) return 0;
  if (m >= 17.5 && m < 20) return ((m - 17.5) / 2.5) * 0.55;
  if (m >= 5 && m < 7) return ((7 - m) / 2) * 0.55;
  return 0.55;
}
