import { describe, expect, it } from "vitest";
import { STATES } from "../data/states";
import { isAsoRockTown, lgaActions, lgaPlaces, type LgaContext } from "../data/lga";
import { CAR_ACTIONS, HOUSE_ACTIONS, OUTFIT_ACTIONS, outfitAttire } from "../data/shops";
import type { Action } from "../data/action";
import {
  blockReason, finishAction, freshState, journeyModes, quoteJourney, sanitizeGame, sequence, startAction,
  type Citizen, type GameState,
} from ".";

const look = { g: "m" as const, skin: "#8D5524", cloth: "#F4F1EA" };
const NOW = Date.parse("2026-10-20T10:00:00+01:00");
const place = { id: "shop", name: "Shop", kind: "office", open: [0, 24] as [number, number], gen: true };

function citizen(patch: Partial<Citizen> = {}): Citizen {
  return {
    name: "Bisi", look, stateCode: "lagos", lgaCode: "lagos/surulere", puCode: "lagos/surulere/1", cls: "poor", job: "Tailor",
    career: "artisan", education: "secondary", employed: true, monthlyPay: 0, home: "Rented room in a face-me-I-face-you",
    underFlyover: false, wasUnder: false, ownsTv: false, ownsRadio: false, pvc: "have", createdAt: NOW, registeredAt: null, ...patch,
  };
}
const make = (patch: Partial<GameState> = {}, c = citizen()): GameState => ({
  ...freshState(), citizen: c, char: { name: "Bisi", ...look }, loc: "park", homeId: "home", money: 600_000_000, t: 9 * 60, ...patch,
});

function buy(s: GameState, a: Action): GameState {
  const r = startAction(s, a, sequence(0.5), { place, now: NOW });
  if (!("plan" in r)) throw new Error("blocked" in r ? r.blocked : "flow");
  return finishAction(r.state, r.plan, sequence(0.5), { place, now: NOW });
}

describe("shops", () => {
  it("sells a car that drives you between states and round town, whatever your class", () => {
    const s = make();
    expect(journeyModes(s)).toEqual(["bus"]);
    const after = buy(s, CAR_ACTIONS[0]);
    expect(after.car).toBe("tokunbo-saloon");
    expect(after.money).toBe(s.money - CAR_ACTIONS[0].cost!);
    expect(journeyModes(after)).toContain("car");
    expect(quoteJourney(after, "fct/abuja-municipal", "car", NOW).blocked).toBeNull();
    expect(blockReason(after, CAR_ACTIONS[0], { place })).toBe("You already own this car");
  });

  it("sells a house that becomes your home, with light from its generator", () => {
    const flat = HOUSE_ACTIONS.find((a) => a.house === "flat")!;
    const after = buy(make({}, citizen({ underFlyover: true, home: "Under the flyover" })), flat);
    expect(after.house).toBe("flat");
    expect(after.citizen!.home).toBe("Three-bedroom flat with a generator");
    expect(after.citizen!.underFlyover).toBe(false);
    expect(after.notes.at(-1)!.title).toBe("Your own house");
    // At home with NEPA gone, the generator keeps the light on.
    const tv: Action = { id: "tv", label: "TV", dur: 60, light: true, fx: {}, done: "" };
    const dark = { ...after, loc: "home", light: false };
    expect(blockReason(dark, tv, { place: { ...place, gen: false } })).toBeNull();
    expect(blockReason({ ...dark, house: null }, tv, { place: { ...place, gen: false } })).toBe("NEPA took light");
    // No stepping down to a smaller house.
    expect(blockReason(after, HOUSE_ACTIONS.find((a) => a.house === "bungalow")!, { place })).toBe("Your house is already bigger than this");
  });

  it("sells outfits cut for you, which your character then wears", () => {
    const agbada = OUTFIT_ACTIONS.find((a) => a.outfit === "agbada")!;
    const iro = OUTFIT_ACTIONS.find((a) => a.outfit === "iro")!;
    const after = buy(make(), agbada);
    expect(after.outfit).toBe("agbada");
    expect(outfitAttire(after.outfit, "m")).toMatchObject({ body: "agbada", head: "fila", pattern: "asooke" });
    expect(blockReason(after, iro, { place })).toBe("That one is cut for women");
    // Women in hijab keep their hijab.
    expect(outfitAttire("iro", "h")?.head).toBe("hijab");
    expect(outfitAttire(null, "m")).toBeNull();
  });

  it("can't be bought without the money", () => {
    expect(blockReason(make({ money: 1000 }), CAR_ACTIONS[0], { place })).toBe("Not enough money");
  });

  it("keeps owned things through a save, and rejects made-up ones", () => {
    const owned = make({ car: "new-jeep", house: "mansion", outfit: "kaftan" });
    expect(sanitizeGame(owned)).toMatchObject({ car: "new-jeep", house: "mansion", outfit: "kaftan" });
    expect(sanitizeGame({ ...owned, car: "golden-jet" })).toBeNull();
    expect(sanitizeGame({ ...owned, house: "constructor" })).toBeNull();
  });

  it("puts a supermarket, boutique, car dealer and estate agent in every town", () => {
    const ctx: LgaContext = { state: STATES.find((s) => s.code === "kano")!, lgaName: "Fagge", cls: "middle", job: "Banker", home: "Mini flat", underFlyover: false };
    const ids = lgaPlaces(ctx).map((p) => p.id);
    for (const id of ["supermarket", "boutique", "cardealer", "estateagent"] as const) {
      expect(ids).toContain(id);
      expect(lgaActions(ctx)[id].length).toBeGreaterThan(0);
    }
  });

  it("puts Aso Rock and the Presidential Villa in Abuja Municipal only, with tours", () => {
    const fct = STATES.find((s) => s.code === "fct")!;
    const amac: LgaContext = { state: fct, lgaName: "Abuja Municipal", cls: "middle", job: "Banker", home: "Mini flat", underFlyover: false };
    expect(isAsoRockTown(amac)).toBe(true);
    expect(lgaPlaces(amac).find((p) => p.id === "landmark")).toMatchObject({ kind: "lm-villa", name: "Aso Rock and the Presidential Villa" });
    expect(lgaActions(amac).landmark.map((a) => a.id)).toEqual(["photo", "tour", "hike"]);
    const bwari = { ...amac, lgaName: "Bwari" };
    expect(lgaPlaces(bwari).find((p) => p.id === "landmark")!.kind).toBe("lm-rock");
  });
});
