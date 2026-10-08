import { describe, expect, it } from "vitest";
import { PRESIDENTIAL_2027 as CAL } from "../data/calendar";
import { freshState, pvcReminders, type Citizen, type GameState } from ".";

const at = (iso: string) => Date.parse(iso);
const look = { g: "m" as const, skin: "#8D5524", cloth: "#F4F1EA" };
const CREATED = at("2026-10-14T09:00:00+01:00");

function citizen(patch: Partial<Citizen> = {}): Citizen {
  return {
    name: "Ada", look, stateCode: "lagos", lgaCode: "lagos/surulere", puCode: "lagos/surulere/1", cls: "middle", job: "Banker",
    career: "worker", education: "degree", employed: true, monthlyPay: 150000, home: "Mini flat", underFlyover: false,
    wasUnder: false, ownsTv: true, ownsRadio: true, pvc: "none", createdAt: CREATED, registeredAt: null, ...patch,
  };
}
const make = (c = citizen()): GameState => ({ ...freshState(), citizen: c });
const titles = (s: GameState) => s.notes.map((n) => n.title);

describe("PVC reminders", () => {
  it("tells a new citizen to register, once", () => {
    const s = make();
    pvcReminders(s, at("2026-10-14T10:00:00+01:00"));
    pvcReminders(s, at("2026-10-14T10:05:00+01:00"));
    expect(titles(s)).toEqual(["Register to vote"]);
    expect(s.notes[0].body).toContain("30 October");
  });

  it("waits for VINEC to open before the first reminder", () => {
    const s = make();
    pvcReminders(s, CREATED + 30_000);
    expect(s.notes).toHaveLength(0);
  });

  it("reminds again with 7, 3 and 1 days left", () => {
    const s = make();
    for (const iso of ["2026-10-15T10:00:00+01:00", "2026-10-24T10:00:00+01:00", "2026-10-28T10:00:00+01:00", "2026-10-30T09:00:00+01:00"])
      pvcReminders(s, at(iso));
    expect(s.notes.map((n) => n.body.split(" to register")[0])).toEqual([
      "You have until 30 October", "Only 7 days left", "Only 3 days left", "Today is the last day",
    ]);
  });

  it("says once that a missed registration means no vote", () => {
    const s = make();
    pvcReminders(s, at("2026-11-01T10:00:00+01:00"));
    pvcReminders(s, at("2026-11-02T10:00:00+01:00"));
    expect(titles(s)).toEqual(["Registration has closed"]);
    expect(s.notes[0].body).toContain("can't vote");
  });

  it("tells registered citizens to collect their PVC once collection opens", () => {
    const s = make(citizen({ pvc: "registered" }));
    pvcReminders(s, at("2026-10-29T10:00:00+01:00"));
    expect(s.notes).toHaveLength(0);
    pvcReminders(s, at("2026-11-01T10:00:00+01:00"));
    pvcReminders(s, at("2026-11-13T10:00:00+01:00"));
    expect(titles(s)).toEqual(["Your PVC is ready", "Collect your PVC"]);
    pvcReminders(s, at("2026-11-14T07:55:00+01:00"));
    expect(titles(s).at(-1)).toBe("PVC collection has closed");
  });

  it("leaves citizens who have their PVC alone", () => {
    const s = make(citizen({ pvc: "have" }));
    for (const iso of ["2026-10-15T10:00:00+01:00", "2026-11-01T10:00:00+01:00", "2026-11-13T10:00:00+01:00"]) pvcReminders(s, at(iso));
    expect(s.notes).toHaveLength(0);
  });

  it("goes quiet once the season is over", () => {
    const s = make();
    pvcReminders(s, Date.parse(CAL.pollsClose) + 86_400_000 * 3);
    expect(s.notes).toHaveLength(0);
  });
});
