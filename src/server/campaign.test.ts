import { describe, expect, it } from "vitest";
import { DAILY_PROMO_CAP, PROMO } from "../data/campaign";
import { freshState, type GameState, type Promo } from "../sim/state";
import { BRIBE_DAY_CAP, reconcileCampaign } from "./campaign";

const NOW = Date.parse("2026-10-20T12:00:00+01:00");
const BLACKOUT = Date.parse("2026-11-13T12:00:00+01:00");
const lga = "kwara/ilorin-west";
const base = (patch: Partial<GameState> = {}): GameState => ({
  ...freshState(),
  citizen: { lgaCode: lga } as GameState["citizen"],
  ...patch,
});
const card = (patch = {}) => ({ party: "APC", issues: ["Jobs"], note: "", day: "2026-10-20", ...patch });
const promo = (patch: Partial<Promo> = {}): Promo => ({ kind: "flyer", option: 0, party: "APC", price: PROMO.flyer[0].price, day: "2026-10-20", lgaCode: lga, ...patch });

describe("campaigning checked on the server", () => {
  it("takes one clean card a day from the lists, and drops the rest", () => {
    const g = base({ supportCards: [card(), card({ note: "you are a fool", day: "2026-10-19" }), card({ issues: ["Free money"], day: "2026-10-18" })] });
    const r = reconcileCampaign(base(), g, NOW, 0);
    expect(r.cards).toEqual([card()]);
    expect(r.changed).toBe(true);
    expect(g.supportCards).toEqual([card()]);
  });

  it("refuses campaign entries in the blackout", () => {
    const g = base({ supportCards: [card({ day: "2026-11-13" })], promos: [promo({ day: "2026-11-13" })] });
    const r = reconcileCampaign(base(), g, BLACKOUT, 0);
    expect(r.cards).toEqual([]);
    expect(r.promos).toEqual([]);
    expect(g.promos).toEqual([]);
  });

  it("takes promos only at their listed price, in your LGA, under the daily cap", () => {
    const big = promo({ kind: "flyer", option: 2, price: PROMO.flyer[2].price });
    const g = base({ promos: [big, big, big, promo({ price: 1 }), promo({ lgaCode: "lagos/ikeja" })] });
    const r = reconcileCampaign(base(), g, NOW, 0);
    expect(r.promos).toHaveLength(Math.floor(DAILY_PROMO_CAP / big.price));
    expect(g.promos).toEqual(r.promos);
    // Ones already recorded aren't counted again.
    const again = reconcileCampaign(base({ promos: r.promos }), base({ promos: r.promos }), NOW, 0);
    expect(again.promos).toEqual([]);
    expect(again.changed).toBe(false);
  });

  it("counts votes bought only up to the day's limit, and never fewer than before", () => {
    const before = base({ bribeEffects: { APC: 10 } });
    const r = reconcileCampaign(before, base({ bribeEffects: { APC: 10 + BRIBE_DAY_CAP + 50 } }), NOW, 0);
    expect(r.bribes).toEqual({ APC: BRIBE_DAY_CAP });
    expect(r.changed).toBe(true);
    const g = base({ bribeEffects: { APC: 2 } });
    reconcileCampaign(before, g, NOW, 0);
    expect(g.bribeEffects.APC).toBe(10);
    expect(reconcileCampaign(before, base({ bribeEffects: { APC: 30 } }), NOW, BRIBE_DAY_CAP).bribes).toEqual({});
  });
});
