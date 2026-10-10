import { describe, expect, it } from "vitest";
import { CAN, allowed } from "./admin";

describe("admin roles", () => {
  it("lets moderators see the dashboard and moderate", () => {
    for (const a of ["stats", "reports", "cards", "promos", "hide", "ban", "unban"]) expect(allowed("moderator", a)).toBe(true);
  });
  it("keeps announcements and the log for the owner", () => {
    for (const a of ["announce", "unannounce", "log"]) {
      expect(allowed("owner", a)).toBe(true);
      expect(allowed("moderator", a)).toBe(false);
    }
  });
  it("has no action that touches votes or results", () => {
    expect(Object.keys(CAN).some((a) => /vote|result|tally|elect/i.test(a))).toBe(false);
    expect(allowed("owner", "vote")).toBe(false);
  });
});
