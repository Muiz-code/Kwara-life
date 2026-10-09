import { describe, expect, it } from "vitest";
import { PARTIES } from "@/data/parties";
import { hazeLevel, OVERHEARD } from "./Vibes";

describe("vibes", () => {
  it("harmattan haze from November, thickest in the morning", () => {
    expect(hazeLevel(Date.parse("2026-10-20T09:00:00+01:00"), 9)).toBe(0);
    expect(hazeLevel(Date.parse("2026-11-03T09:00:00+01:00"), 9)).toBe(1);
    expect(hazeLevel(Date.parse("2026-11-03T14:00:00+01:00"), 14)).toBeLessThan(1);
  });

  it("overheard lines never name a party", () => {
    for (const line of OVERHEARD)
      for (const p of PARTIES) {
        expect(line).not.toContain(p.name);
        expect(line.split(/\W+/)).not.toContain(p.code);
      }
  });

  it("no em dashes in the copy", () => {
    for (const line of OVERHEARD) expect(line).not.toContain("—");
  });
});
