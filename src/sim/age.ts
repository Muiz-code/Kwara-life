// 18 and over only, the same as voting age in Nigeria. The same check the database makes
// (supabase/migrations/*_age_gate.sql: dob_problem); it has the final say. Dates of birth are never stored.

export const MIN_AGE = 18;
export const UNDER_AGE = "Naija Votes is for players aged 18 and over";

/** Today's date in Nigeria as [year, month 1-12, day]. */
export function lagosToday(now = new Date()): [number, number, number] {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return [get("year"), get("month"), get("day")];
}

/** The date as 'YYYY-MM-DD', or null if it isn't a real date. */
export function dobString(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Full years between a date of birth and today. A 29 February birthday turns over on 1 March. */
export function ageOn(dob: [number, number, number], today: [number, number, number]): number {
  const [y, m, d] = dob;
  const [ty, tm, td] = today;
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

/** Why a date of birth won't do, or null. */
export function dobProblem(y: number, m: number, d: number, today = lagosToday()): string | null {
  if (!y || !m || !d) return "Enter your date of birth";
  if (!dobString(y, m, d)) return "Enter a real date of birth";
  const age = ageOn([y, m, d], today);
  if (age < 0 || age >= 120) return "Enter a real date of birth";
  if (age < MIN_AGE) return UNDER_AGE;
  return null;
}
