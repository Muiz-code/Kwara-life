// What happens after polls close (docs/DECISIONS.md, "After the season closes"). The game never loads again;
// the results can be watched for three days; on the fifth day every player's data is deleted and sign-in closes.
import { PRESIDENTIAL_2027, type ElectionCalendar } from "./calendar";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days after polls close that the results stay up. */
export const RESULTS_DAYS = 3;
/** Day after polls close on which every player's data is deleted and nobody can sign in. */
export const DELETE_AFTER_DAYS = 5;

export type SeasonState = "playing" | "results" | "ended";

const close = (c: ElectionCalendar) => Date.parse(c.pollsClose);

export const resultsUntil = (c: ElectionCalendar = PRESIDENTIAL_2027) => close(c) + RESULTS_DAYS * DAY_MS;
export const dataDeletedAt = (c: ElectionCalendar = PRESIDENTIAL_2027) => close(c) + DELETE_AFTER_DAYS * DAY_MS;

/** Playing until polls close, then results for three days, then the season has ended. */
export function seasonState(now: number, c: ElectionCalendar = PRESIDENTIAL_2027): SeasonState {
  if (now < close(c)) return "playing";
  return now < resultsUntil(c) ? "results" : "ended";
}
