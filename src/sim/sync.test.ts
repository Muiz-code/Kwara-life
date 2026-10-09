import { describe, expect, it } from "vitest";
import { lgaActions, lgaPlaces, type LgaContext } from "../data/lga";
import { STATES } from "../data/states";
import { CAR_HIRE, CAR_HIRE_PRICE } from "../data/sync";
import { HOUSE_ACTIONS } from "../data/shops";
import { tasksFor } from "../data/work-tasks";
import { tripWorldFor } from "../store/world";
import { blockReason, dayNum, freshState, openings, performAction, sequence, type GameState } from ".";

const ctx = (patch: Partial<LgaContext> = {}): LgaContext => ({
  state: STATES.find((s) => s.code === "kwara")!, lgaName: "Offa", cls: "middle", job: "Banker", home: "Mini flat", underFlyover: false, career: "worker", ...patch,
});
const place = { name: "Sync", open: [8, 20] as [number, number], gen: true };
const ok = (r: ReturnType<typeof performAction>): GameState => {
  if ("blocked" in r || "flow" in r) throw new Error(JSON.stringify(r));
  return r;
};

describe("Sync", () => {
  it("has an office in every town that rents and sells homes and hires out cars", () => {
    expect(lgaPlaces(ctx()).some((p) => p.id === "sync")).toBe(true);
    const ids = lgaActions(ctx()).sync.map((a) => a.id);
    expect(ids).toContain("carhire");
    expect(ids).toContain("house-selfcon");
    expect(ids).toContain("house-mansion");
  });

  it("is hiring every week", () => {
    for (let day = 1; day < 60; day += 7) expect(openings("kwara/offa", day).some((o) => o.career === "sync")).toBe(true);
  });

  it("Sync staff work at the Sync office, with tasks for their role", () => {
    const c = ctx({ career: "sync", job: "Sync office cleaner" });
    expect(lgaPlaces(c).some((p) => p.id === "work")).toBe(false);
    expect(lgaActions(c).sync.some((a) => a.id === "work")).toBe(true);
    expect(tasksFor("sync", "Sync office cleaner")![0].act).toBe("Mop it");
  });

  it("a hired car is a free way to travel for the rest of the day", () => {
    const s = { ...freshState(), loc: "sync", t: 10 * 60, money: 100_000 };
    const hired = ok(performAction(s, CAR_HIRE, sequence(0.99), { place }));
    expect(hired.money).toBe(100_000 - CAR_HIRE_PRICE);
    expect(hired.flags.carHireDay).toBe(dayNum(hired.t));
    expect(blockReason(hired, CAR_HIRE, { place })).toMatch(/already on standby/);
    const w = tripWorldFor(hired, null);
    expect(w.modeIds).toContain("hire");
    expect(w.modes.hire.fare(1000)).toBe(0);
    expect(tripWorldFor({ ...hired, t: hired.t + 24 * 60 }, null).modeIds).not.toContain("hire");
  });

  it("rents a place by the year, but not once you own a house", () => {
    const rent = HOUSE_ACTIONS.find((a) => a.house === "miniflat")!;
    expect(rent.label).toMatch(/a year/);
    const citizen = {
      name: "Muiz", look: { g: "m" as const, skin: "#8D5524", cloth: "#F4F1EA" }, stateCode: "kwara", lgaCode: "kwara/offa", puCode: "kwara/offa/2", cls: "middle" as const,
      job: "Banker", home: "Family compound", career: "worker" as const, education: "degree" as const, employed: true, monthlyPay: 200_000, underFlyover: false, wasUnder: false,
      ownsTv: false, ownsRadio: true, pvc: "have" as const, createdAt: 0, registeredAt: null,
    };
    const s = { ...freshState(), citizen, loc: "sync", t: 10 * 60, money: 2_000_000 };
    const moved = ok(performAction(s, rent, sequence(0.99), { place }));
    expect(moved.house).toBe("miniflat");
    expect(blockReason({ ...s, house: "bungalow" }, rent, { place })).toMatch(/own a house already/);
  });
});
