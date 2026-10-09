import { describe, expect, it } from "vitest";
import { DAY_MS, MAX_AD_DAYS, PRICE_PER_DAY } from "../data/ads";
import { boardDayPrice, boardTypeOf, clampDays, daysUntil } from "./ads";

describe("boards by the day", () => {
  it("₦10,000 a day a face, times the board's factor", () => {
    expect(boardDayPrice(1, "classic", "front")).toBe(PRICE_PER_DAY);
    expect(boardDayPrice(7, "classic", "both")).toBe(7 * PRICE_PER_DAY * 2);
    expect(boardDayPrice(2, "smart", "back")).toBe(2 * PRICE_PER_DAY * 2);
  });

  it("whole days from 1 to 30, the length of the season", () => {
    expect(clampDays(0)).toBe(1);
    expect(clampDays(3.7)).toBe(3);
    expect(clampDays(99)).toBe(MAX_AD_DAYS);
    expect(clampDays(Number.NaN)).toBe(1);
    expect(daysUntil(1000, 3)).toBe(1000 + 3 * DAY_MS);
  });

  it("plot boards in town are classic billboards", () => {
    expect(boardTypeOf("plot-12_40")).toBe("classic");
  });
});
