import { describe, expect, it } from "vitest";
import { dataDeletedAt, resultsUntil, seasonState } from "./season";

const at = (iso: string) => Date.parse(iso);

describe("after the season closes", () => {
  it("plays until 4pm on election day, shows results for three days, then ends", () => {
    expect(seasonState(at("2026-11-14T15:59:59+01:00"))).toBe("playing");
    expect(seasonState(at("2026-11-14T16:00:00+01:00"))).toBe("results");
    expect(seasonState(at("2026-11-17T15:59:59+01:00"))).toBe("results");
    expect(seasonState(at("2026-11-17T16:00:00+01:00"))).toBe("ended");
  });

  it("deletes player data on the fifth day", () => {
    expect(new Date(resultsUntil()).toISOString()).toBe("2026-11-17T15:00:00.000Z");
    expect(new Date(dataDeletedAt()).toISOString()).toBe("2026-11-19T15:00:00.000Z");
  });
});
