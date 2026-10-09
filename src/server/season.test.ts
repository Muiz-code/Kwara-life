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
});
