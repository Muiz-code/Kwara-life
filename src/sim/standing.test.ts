import { describe, expect, it } from "vitest";
import { HOMES } from "../data/jobs";
import {
  addConnections, applyForJob, checkStanding, CONNECTIONS_PER_DAY, earnedClass, FALL_DAYS, finishAction, freshState, hireChance,
  openings, POLITICAL_LADDER, RISE_DAYS, sanitizeGame, sequence, startAction, type Citizen, type GameState,
} from ".";

const NOW = Date.parse("2026-10-20T10:00:00+01:00");
const look = { g: "m" as const, skin: "#8D5524", cloth: "#F4F1EA" };

function citizen(patch: Partial<Citizen> = {}): Citizen {
  return {
    name: "Tunde", look, stateCode: "lagos", lgaCode: "lagos/surulere", puCode: "lagos/surulere/1", cls: "poor", job: "Tailor",
    career: "artisan", education: "secondary", employed: true, monthlyPay: 0, home: HOMES.poor[0], underFlyover: false,
    wasUnder: false, ownsTv: false, ownsRadio: false, pvc: "have", createdAt: NOW, registeredAt: null, ...patch,
  };
}
const make = (patch: Partial<GameState> = {}, c = citizen()): GameState => ({
  ...freshState(), citizen: c, char: { name: "Tunde", ...look }, loc: "home", homeId: "home", money: 10_000, t: 9 * 60, ...patch,
});

/** Run the daily check for n days. */
function days(s: GameState, n: number) {
  for (let i = 0; i < n; i++) {
    s.t += 24 * 60;
    checkStanding(s);
  }
  return s;
}

describe("class follows your life", () => {
  it("moves a poor hustler up once the money has lasted a few days", () => {
    const s = make({ money: 3_000_000 });
    expect(earnedClass(s)).toBe("middle");
    days(s, RISE_DAYS - 1);
    expect(s.citizen!.cls).toBe("poor");
    days(s, 1);
    expect(s.citizen!.cls).toBe("middle");
    expect(s.notes.at(-1)!.body).toContain("You've moved up. People now call you oga.");
  });

  it("rises one class at a time, all the way to rich", () => {
    const s = days(make({ money: 80_000_000 }), RISE_DAYS);
    expect(s.citizen!.cls).toBe("middle");
    days(s, RISE_DAYS);
    expect(s.citizen!.cls).toBe("rich");
  });

  it("counts a bought house, a car or a good salary as moving up", () => {
    expect(earnedClass(make({ house: "bungalow" }))).toBe("middle");
    expect(earnedClass(make({ car: "tokunbo-saloon" }))).toBe("middle");
    expect(earnedClass(make({}, citizen({ monthlyPay: 200_000 })))).toBe("middle");
  });

  it("never drops a rich citizen who simply hasn't bought anything", () => {
    const s = make({ money: 25_000_000 }, citizen({ cls: "rich", home: HOMES.rich[0] }));
    expect(earnedClass(s)).toBe("rich");
  });

  it("falls more slowly than it rises, and only when properly broke", () => {
    const s = make({ money: 30_000 }, citizen({ cls: "middle", home: HOMES.middle[0] }));
    expect(earnedClass(s)).toBe("poor");
    days(s, FALL_DAYS - 1);
    expect(s.citizen!.cls).toBe("middle");
    days(s, 1);
    expect(s.citizen!.cls).toBe("poor");
    expect(s.notes.at(-1)!.title).toBe("Hard times");
    // ₦60k with a minimum-wage job is getting by, not broke.
    expect(earnedClass(make({ money: 60_000 }, citizen({ cls: "middle", monthlyPay: 70_000 })))).toBe("middle");
  });

  it("starts the count again when a good spell is broken", () => {
    const s = days(make({ money: 3_000_000 }), RISE_DAYS - 1);
    s.money = 10_000;
    days(s, 1);
    expect(s.standing.days).toBe(0);
    s.money = 3_000_000;
    days(s, RISE_DAYS - 1);
    expect(s.citizen!.cls).toBe("poor");
  });
});

describe("connections", () => {
  it("grow from gisting, prayer and friends, up to a daily cap", () => {
    const s = make();
    const gist = { id: "gist", label: "Gist", dur: 30, fx: {}, done: "", overhear: false };
    const place = { id: "buka", name: "Buka", kind: "buka", open: [0, 24] as [number, number], gen: true };
    const r = startAction(s, gist, sequence(0.5), { place, now: NOW });
    if (!("plan" in r)) throw new Error("blocked");
    expect(finishAction(r.state, r.plan, sequence(0.5), { place, now: NOW }).connections).toBe(1);
    expect(addConnections(s, 50)).toBe(CONNECTIONS_PER_DAY);
    expect(addConnections(s, 5)).toBe(0);
    s.t += 24 * 60;
    expect(addConnections(s, 3)).toBe(3);
  });

  it("help every job application a little", () => {
    const app = { minEducation: "secondary" as const, applicants: 100 };
    expect(hireChance(make({ connections: 60 }), app)).toBeGreaterThan(hireChance(make(), app));
  });

  it("are checked when a save loads", () => {
    expect(sanitizeGame(make({ connections: 250 }))?.connections).toBe(100);
    expect(sanitizeGame(make({ connections: Number.NaN }))).toBeNull();
    expect(sanitizeGame({ ...make(), standing: "nonsense" })?.standing).toEqual({ toward: null, days: 0, connDay: -1, connToday: 0 });
  });
});

describe("the political ladder", () => {
  // Find a week whose board in Surulere has a given rung.
  function rung(title: string) {
    for (let day = 1; day < 2000; day += 7) {
      const o = openings("lagos/surulere", day).find((x) => x.title === title);
      if (o) return { o, t: (day - 1) * 24 * 60 + 9 * 60 };
    }
    throw new Error(`no ${title} in 2000 days`);
  }

  it("climbs from ward coordinator to commissioner's aide, by who you know", () => {
    expect(POLITICAL_LADDER.map((r) => r.title)).toEqual(["Ward coordinator", "Special assistant", "Commissioner's aide"]);
    const ward = rung("Ward coordinator");
    expect(ward.o.minConnections).toBe(15);
    expect(applyForJob(make({ t: ward.t, money: 1000 }), ward.o, sequence(0.5))).toEqual({
      blocked: expect.stringContaining("You need more connections for this (0 of 15)"),
    });
    expect(applyForJob(make({ t: ward.t, money: 1000, connections: 15 }), ward.o, sequence(0.5))).not.toHaveProperty("blocked");

    const aide = rung("Commissioner's aide");
    expect(aide.o.minEducation).toBe("degree");
    expect(aide.o.monthly).toBeGreaterThanOrEqual(600_000);
    // Plenty of connections, but no degree: still out.
    expect(applyForJob(make({ t: aide.t, money: 1000, connections: 90 }), aide.o, sequence(0.5))).toEqual({ blocked: "You don't have the qualification for this one" });
  });

  it("keeps ordinary jobs open to everyone", () => {
    const plain = openings("lagos/surulere", 1).find((o) => !o.minConnections);
    if (plain) expect(plain.minConnections).toBeUndefined();
  });
});
