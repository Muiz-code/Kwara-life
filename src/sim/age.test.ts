import { describe, expect, it } from "vitest";
import { UNDER_AGE, ageOn, dobProblem, dobString, lagosToday } from "./age";

const today: [number, number, number] = [2026, 10, 9];

describe("the 18+ check", () => {
  it("lets in a player who turns 18 today, not one who turns 18 tomorrow", () => {
    expect(dobProblem(2008, 10, 9, today)).toBeNull();
    expect(dobProblem(2008, 10, 10, today)).toBe(UNDER_AGE);
    expect(dobProblem(1990, 1, 1, today)).toBeNull();
  });

  it("turns a 29 February birthday over on 1 March", () => {
    expect(ageOn([2008, 2, 29], [2026, 2, 28])).toBe(17);
    expect(ageOn([2008, 2, 29], [2026, 3, 1])).toBe(18);
  });

  it("refuses missing, impossible and future dates", () => {
    expect(dobProblem(0, 5, 5, today)).toBe("Enter your date of birth");
    expect(dobProblem(2001, 2, 30, today)).toBe("Enter a real date of birth");
    expect(dobProblem(2027, 1, 1, today)).toBe("Enter a real date of birth");
    expect(dobProblem(1900, 1, 1, today)).toBe("Enter a real date of birth");
  });

  it("writes the date the way the server reads it", () => {
    expect(dobString(2001, 2, 3)).toBe("2001-02-03");
    expect(dobString(2001, 2, 29)).toBeNull();
  });

  it("counts the day on Nigeria's calendar", () => {
    // 23:30 UTC on 8 Oct is 00:30 on 9 Oct in Lagos.
    expect(lagosToday(new Date(Date.UTC(2026, 9, 8, 23, 30)))).toEqual([2026, 10, 9]);
  });
});
