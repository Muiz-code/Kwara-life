import { describe, expect, it } from "vitest";
import { CAREERS, MINIMUM_WAGE, NYSC_ALLAWEE } from "../data/careers";
import { PARTIES } from "../data/parties";
import {
  actionCost, applyForJob, dailyLife, decideApplications, doWork, efccChance, efccDaily, freshState, hireChance, maybePoliceStop,
  openings, quoteJourney, resolveChoice, rollCitizen, seeded, sequence, stopChance, type Citizen, type GameState,
} from ".";

const EARLY = Date.parse("2026-10-12T10:00:00+01:00");
const never = sequence(0.99);
const always = sequence(0);
const look = { g: "f" as const, skin: "#6B3E26", cloth: "#8C2F5A" };

function citizen(patch: Partial<Citizen> = {}): Citizen {
  return {
    name: "Bisi", look, stateCode: "lagos", lgaCode: "lagos/surulere", puCode: "lagos/surulere/1", cls: "middle", job: "Banker",
    career: "worker", education: "degree", employed: true, monthlyPay: 154000, home: "Mini flat", underFlyover: false,
    wasUnder: false, ownsTv: true, ownsRadio: true, pvc: "have", createdAt: EARLY, registeredAt: null, ...patch,
  };
}
const make = (c = citizen(), patch: Partial<GameState> = {}): GameState => ({ ...freshState(), citizen: c, loc: "home", homeId: "home", money: 100000, t: 7 * 60, ...patch });

describe("careers", () => {
  it("keeps pay at or above the floors", () => {
    expect(CAREERS.worker.min).toBe(MINIMUM_WAGE);
    expect(CAREERS.corper.min).toBe(NYSC_ALLAWEE);
    const R = seeded(5);
    for (let i = 0; i < 300; i++) {
      const c = rollCitizen({ name: "A", look, stateCode: "kwara", lgaCode: "kwara/offa" }, EARLY, R);
      if (CAREERS[c.career].pay === "salary" && c.employed) expect(c.monthlyPay).toBeGreaterThanOrEqual(CAREERS[c.career].min);
      if (c.career === "corper") expect(["ond", "degree", "masters"]).toContain(c.education);
    }
  });

  it("rolls a mix of careers by class", () => {
    const R = seeded(11);
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(rollCitizen({ name: "A", look, stateCode: "kwara", lgaCode: "kwara/offa" }, EARLY, R).career);
    for (const c of ["student", "corper", "worker", "artisan", "trader", "creator", "developer", "herbalist", "politician", "yahoo", "launderer", "executive", "founder"]) {
      expect(seen).toContain(c);
    }
  });

  it("hits careers mostly earn nothing, sometimes a lot, and build EFCC heat", () => {
    const s = make(citizen({ career: "yahoo", job: "Yahoo boy", monthlyPay: 0 }));
    const miss = doWork(s, never);
    expect(miss.earned).toBe(0);
    expect(s.heat).toBe(12);
    const t = make(citizen({ career: "yahoo", job: "Yahoo boy", monthlyPay: 0 }));
    expect(doWork(t, sequence(0, 0.5)).earned).toBeGreaterThan(300000);
  });

  it("holds back pay while salary is owed, then pays it all", () => {
    const s = make(citizen(), { events: { owedUntil: 1 } });
    const w = doWork(s, never);
    expect(w.earned).toBe(0);
    expect(s.payOwed).toBe(7000);
    s.t = 1440 + 7 * 60; // day 2, 7am
    dailyLife(s, never);
    expect(s.payOwed).toBe(0);
    expect(s.money).toBe(107000);
  });
});

describe("job hunting", () => {
  it("posts the same openings for everyone in an LGA that week", () => {
    expect(openings("lagos/surulere", 3)).toEqual(openings("lagos/surulere", 5));
    expect(openings("lagos/surulere", 3)).not.toEqual(openings("lagos/surulere", 10));
    for (let day = 1; day < 60; day += 7)
      for (const o of openings("kano/fagge", day)) {
        expect(o.monthly).toBeGreaterThanOrEqual(MINIMUM_WAGE);
        if (o.minEducation === "none") expect(o.monthly).toBeLessThanOrEqual(110000);
      }
  });

  it("applies, waits and sometimes gets hired", () => {
    const jobless = make(citizen({ employed: false, monthlyPay: 0 }));
    const o = { ...openings("lagos/surulere", 1)[0], minEducation: "secondary" as const };
    const s = applyForJob(jobless, o, never);
    if ("blocked" in s) throw new Error(s.blocked);
    expect(s.money).toBe(99500);
    expect(applyForJob(s, o, never)).toEqual({ blocked: "You already applied" });
    s.t = (s.applications[0].decideDay - 1) * 1440 + 9 * 60;
    decideApplications(s, always);
    expect(s.citizen!.employed).toBe(true);
    expect(s.citizen!.monthlyPay).toBe(o.monthly);
    expect(s.notes.at(-1)!.title).toBe("You got the job");
  });

  it("weights hiring by qualification, being informed and long leg", () => {
    const app = { ...openings("lagos/surulere", 1)[0], minEducation: "secondary" as const, applicants: 400 };
    const low = hireChance(make(citizen({ education: "secondary", cls: "poor" })), app);
    const high = hireChance(make(citizen({ education: "masters", cls: "rich" }), { informed: 30 }), app);
    expect(high).toBeGreaterThan(low);
    expect(applyForJob(make(citizen({ education: "none" })), { ...app, minEducation: "degree" }, never)).toEqual({ blocked: "You don't have the qualification for this one" });
  });
});

describe("police", () => {
  it("stops young people with phones and laptops more", () => {
    expect(stopChance(make(citizen({ career: "creator" })), false)).toBeGreaterThan(stopChance(make(), false));
    expect(stopChance(make(), true)).toBeGreaterThan(stopChance(make(), false));
  });

  it("demands money and lets you pay, argue or report", () => {
    const s = make();
    expect(maybePoliceStop(s, true, sequence(0, 0.5))).toBe(true);
    const demand = s.events.policeDemand!;
    expect(s.notes.at(-1)!.choices!.map((c) => c.id)).toEqual(["police-pay", "police-argue", "police-report"]);
    resolveChoice(s, "police-report", never);
    expect(s.money).toBe(100000 - demand);
    expect(s.civic).toBe(2);
  });

  it("gives the connected a phone call", () => {
    const s = make(citizen({ career: "politician", job: "Councillor" }));
    maybePoliceStop(s, true, sequence(0, 0.5));
    expect(s.notes.at(-1)!.choices!.map((c) => c.id)).toContain("police-call");
    resolveChoice(s, "police-call", always);
    expect(s.money).toBe(100000);
  });
});

describe("EFCC", () => {
  it("comes more often as heat rises", () => {
    expect(efccChance(0)).toBe(0);
    expect(efccChance(80)).toBeGreaterThan(efccChance(20));
  });

  it("raids, and arrest news names no party", () => {
    const s = make(citizen({ career: "yahoo", job: "Yahoo boy", monthlyPay: 0 }), { heat: 90 });
    efccDaily(s, sequence(0.99, 0));
    expect(s.notes.at(-1)!.title).toBe("EFCC raid");
    resolveChoice(s, "efcc-surrender", never);
    expect(s.money).toBe(50000);
    expect(s.heat).toBe(0);
    const news = s.localNews.join(" ");
    for (const p of PARTIES) expect(news).not.toMatch(new RegExp(`\\b${p.code}\\b`));
  });

  it("sends politicians an invitation instead of a raid", () => {
    const s = make(citizen({ career: "politician", job: "Councillor" }), { heat: 90 });
    efccDaily(s, sequence(0.99, 0));
    expect(s.notes.at(-1)!.title).toBe("EFCC invitation");
  });
});

describe("Nigerian life", () => {
  it("fuel scarcity raises bus fares and cash scarcity adds POS charges", () => {
    const s = make(citizen(), { loc: "park" });
    const before = quoteJourney(s, "kwara/offa", "bus", EARLY).fare;
    s.events.fuelUntil = 5;
    expect(quoteJourney(s, "kwara/offa", "bus", EARLY).fare).toBeGreaterThan(before);
    const a = { id: "food", label: "Buy foodstuff", dur: 40, cost: 2000, fx: {}, done: "" };
    expect(actionCost(s, a)).toBe(2000);
    s.events.cashUntil = 5;
    expect(actionCost(s, a)).toBe(2200);
  });

  it("family asks for money (black tax)", () => {
    const s = make();
    // Rolls: fuel, cash, flood, salary owed, then black tax.
    dailyLife(s, sequence(0.99, 0.99, 0.99, 0.99, 0, 0.99));
    const ask = s.notes.find((n) => n.title === "Black tax");
    expect(ask).toBeDefined();
    resolveChoice(s, "family-give", never);
    expect(s.money).toBe(90000);
  });
});
