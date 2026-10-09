// The server's side of the season's end (docs/DECISIONS.md, "After the season closes"), on the dates in
// src/data/season.ts. From polls close the game never runs again, so every game route is refused; the results
// feeds stop after the three days of results; from the deletion day nobody can sign in.
import { dataDeletedAt, seasonState } from "../data/season";
import type { Reply } from "./game";

export const SEASON_OVER = "Naija Votes has ended. Thank you for playing, and go and vote for real.";

/** Null while the game is on; after polls close, the reply refusing a game route (save, citizen, device, vote). */
export const gameClosed = (now: number): Reply | null =>
  seasonState(now) === "playing" ? null : { status: 410, body: { error: SEASON_OVER, over: true } };

/** Null while results are up; after the three days, the reply for the results feeds (turnout, credits). */
export const resultsClosed = (now: number): Reply | null =>
  seasonState(now) === "ended" ? { status: 410, body: { error: SEASON_OVER, over: true } } : null;

/** From the deletion day nobody can sign in again. */
export const signInClosed = (now: number) => now >= dataDeletedAt();
