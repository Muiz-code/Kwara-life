import { describe, expect, it } from "vitest";
import { PRESIDENTIAL_2027, electionDayLabel, moveElection, pollHoursLabel, setCalendar, type ElectionCalendar } from "./calendar";

const base = (): ElectionCalendar => ({ ...PRESIDENTIAL_2027 });
const at = (iso: string) => Date.parse(iso);

describe("moving the election", () => {
  it("moves polls a week later, PVC close 10 minutes before, unpassed dates shift too", () => {
    const c = base();
    const r = moveElection(c, "2026-11-21T08:00:00+01:00", "2026-11-21T16:00:00+01:00", at("2026-10-20T12:00:00+01:00"));
    if (!("calendar" in r)) throw new Error(r.error);
    expect(r.calendar.pollsOpen).toBe("2026-11-21T07:00:00.000Z");
    expect(r.calendar.pvcCollectionClose).toBe("2026-11-21T06:50:00.000Z");
    expect(r.calendar.registrationClose).toBe(new Date(at(c.registrationClose) + 7 * 86_400_000).toISOString());
  });

  it("keeps dates that have already passed", () => {
    const c = base();
    const r = moveElection(c, "2026-11-21T08:00:00+01:00", "2026-11-21T16:00:00+01:00", at("2026-11-02T12:00:00+01:00"));
    if (!("calendar" in r)) throw new Error(r.error);
    expect(r.calendar.registrationClose).toBe(c.registrationClose);
    expect(r.calendar.pvcAnnouncement).toBe(c.pvcAnnouncement);
  });

  it("refuses once polls have opened, too soon, or backwards hours", () => {
    const c = base();
    expect(moveElection(c, "2026-11-21T08:00:00+01:00", "2026-11-21T16:00:00+01:00", at("2026-11-14T09:00:00+01:00"))).toEqual({ error: expect.stringMatching(/locked/) });
    expect(moveElection(c, "2026-10-20T20:00:00+01:00", "2026-10-21T04:00:00+01:00", at("2026-10-20T12:00:00+01:00"))).toEqual({ error: expect.stringMatching(/a day/) });
    expect(moveElection(c, "2026-11-21T16:00:00+01:00", "2026-11-21T08:00:00+01:00", at("2026-10-20T12:00:00+01:00"))).toEqual({ error: expect.stringMatching(/close after/) });
  });

  it("applies overrides in place and labels the day", () => {
    const c = base();
    setCalendar({ pollsOpen: "2026-11-21T07:00:00.000Z", pollsClose: "2026-11-21T15:00:00.000Z" }, c);
    expect(electionDayLabel(c)).toBe("Saturday 21 November 2026");
    expect(electionDayLabel(c, true)).toBe("Sat 21 Nov");
    expect(pollHoursLabel(c)).toBe("8am to 4pm");
    setCalendar({ pollsOpen: "not a date" }, c);
    expect(c.pollsOpen).toBe("2026-11-21T07:00:00.000Z");
  });
});
