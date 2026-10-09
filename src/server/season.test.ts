import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRESIDENTIAL_2027 as CAL } from "../data/calendar";
import { dataDeletedAt, resultsUntil } from "../data/season";
import { gameClosed, resultsClosed, signInClosed } from "./season";

const close = Date.parse(CAL.pollsClose);

describe("the season's end on the server", () => {
  it("refuses game routes from polls close", () => {
    expect(gameClosed(close - 1)).toBeNull();
    expect(gameClosed(close)?.status).toBe(410);
  });

  it("keeps the results feeds for three days", () => {
    expect(resultsClosed(close + 1)).toBeNull();
    expect(resultsClosed(resultsUntil() - 1)).toBeNull();
    expect(resultsClosed(resultsUntil())?.status).toBe(410);
  });

  it("closes sign-in on the deletion day", () => {
    expect(signInClosed(dataDeletedAt() - 1)).toBe(false);
    expect(signInClosed(dataDeletedAt())).toBe(true);
  });

  it("cleans the database on the same day the game says", () => {
    const sql = readFileSync(new URL("../../supabase/migrations/20261009190000_season_purge.sql", import.meta.url), "utf8");
    const at = sql.match(/insert into public\.season_control \(delete_at\) values \('([^']+)'\)/)?.[1];
    expect(at && Date.parse(at)).toBe(dataDeletedAt());
    // The timers fire at 15:00 UTC, which is 4pm WAT: the rehearsal a day early, then the clean-up.
    expect(new Date(dataDeletedAt()).toISOString()).toBe("2026-11-19T15:00:00.000Z");
    expect(sql).toContain("'0 15 18 11 *'");
    expect(sql).toContain("'0 15 19 11 *'");
  });
});
