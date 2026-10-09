import { describe, expect, it } from "vitest";
import { doWork, freshState, sanitizeGame, sequence, type Citizen, type GameState } from ".";
import { MAX_LEVEL, REVIEW_EVERY, noteTasks, promoOf, promotionChance } from "./promotion";

const look = { g: "f" as const, skin: "#6B3E26", cloth: "#8C2F5A" };
const banker = (patch: Partial<Citizen> = {}): Citizen => ({
  name: "Bisi", look, stateCode: "lagos", lgaCode: "lagos/surulere", puCode: "lagos/surulere/1", cls: "middle", job: "Banker",
  career: "worker", education: "degree", employed: true, monthlyPay: 200000, home: "Mini flat", underFlyover: false,
  wasUnder: false, ownsTv: true, ownsRadio: true, pvc: "have", createdAt: 0, registeredAt: null, ...patch,
});
const make = (c: Citizen): GameState => ({ ...freshState(), citizen: c, loc: "home", homeId: "home", money: 0, t: 7 * 60 });

/** Work one shift a day for n days, starting at the game's current day. */
function workDays(s: GameState, n: number, rng = sequence(0)) {
  for (let i = 0; i < n; i++) {
    doWork(s, rng);
    s.t += 1440;
  }
}

describe("getting on at work", () => {
  it("reviews every 5 days worked: a new title and a raise on a salary", () => {
    const s = make(banker());
    workDays(s, REVIEW_EVERY - 1);
    expect(s.citizen!.job).toBe("Banker");
    workDays(s, 1);
    expect(s.citizen!.job).toBe("Senior Banker");
    expect(s.citizen!.monthlyPay).toBe(220000);
    expect(s.notes.at(-1)?.title).toBe("You got promoted");
    // The new title keeps the record going.
    expect(promoOf(s)?.level).toBe(1);
  });

  it("stops at the top", () => {
    const s = make(banker());
    workDays(s, REVIEW_EVERY * (MAX_LEVEL + 2));
    expect(s.citizen!.job).toBe("Chief Banker");
    expect(promoOf(s)?.level).toBe(MAX_LEVEL);
  });

  it("grows takings for people paid by the day instead of a title", () => {
    const s = make(banker({ career: "artisan", job: "Tailor", monthlyPay: 0 }));
    workDays(s, REVIEW_EVERY);
    expect(s.citizen!.job).toBe("Tailor");
    expect(promoOf(s)?.level).toBe(1);
  });

  it("helps if you handle things on shift, and hurts if you miss days", () => {
    expect(promotionChance(0, 0)).toBe(0.5);
    expect(promotionChance(6, 0)).toBe(0.8);
    expect(promotionChance(0, 3)).toBe(0.2);
    expect(promotionChance(20, 0)).toBe(0.95);
    expect(promotionChance(0, 20)).toBe(0.1);
    const s = make(banker());
    noteTasks(s, 2);
    expect(promoOf(s)?.tasks).toBe(2);
  });

  it("starts again at a new job, and never promotes students or corps members", () => {
    const s = make(banker());
    workDays(s, REVIEW_EVERY);
    s.citizen!.job = "Accountant";
    expect(promoOf(s)?.level).toBe(0);
    const corper = make(banker({ career: "corper", job: "Corps member", monthlyPay: 77000 }));
    workDays(corper, REVIEW_EVERY * 2);
    expect(corper.citizen!.job).toBe("Corps member");
  });

  it("keeps a promoted save loadable", () => {
    const s = make(banker());
    workDays(s, REVIEW_EVERY * MAX_LEVEL);
    expect(sanitizeGame(JSON.parse(JSON.stringify(s)))?.citizen?.job).toBe("Chief Banker");
  });
});
