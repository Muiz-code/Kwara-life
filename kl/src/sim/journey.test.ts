import { describe, expect, it } from "vitest";
import { lgaActions, lgaPlaces } from "../data/lga";
import { STATE } from "../data/states";
import { castVote, handoverSeconds, zoneHops, currentLga, freshState, isAway, journeyKm, performAction, quoteJourney, sequence, takeJourney, type Citizen, type GameState } from ".";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-12T10:00:00+01:00");
const POLLS = at("2026-11-14T10:00:00+01:00");
const never = sequence(0.99);
const look = { g: "m" as const, skin: "#8D5524", cloth: "#F4F1EA" };

function citizen(patch: Partial<Citizen> = {}): Citizen {
  return {
    name: "Ada", look, stateCode: "lagos", lgaCode: "lagos/ikeja", puCode: "lagos/ikeja/1", cls: "middle", job: "Nurse",
    home: "Mini flat", career: "worker", education: "degree", employed: true, monthlyPay: 220000, underFlyover: false, wasUnder: false, ownsTv: true, ownsRadio: true, pvc: "have",
    createdAt: at("2026-10-07T12:00:00+01:00"), registeredAt: null, ...patch,
  };
}
const make = (patch: Partial<GameState> = {}, c = citizen()): GameState => ({ ...freshState(), citizen: c, loc: "park", homeId: "home", money: 300000, t: 8 * 60, ...patch });
const ok = (r: GameState | { blocked: string }) => {
  if ("blocked" in r) throw new Error(r.blocked);
  return r;
};

describe("travelling between states", () => {
  it("measures road distance between state capitals", () => {
    const km = journeyKm("lagos/ikeja", "fct/abuja-municipal");
    expect(km).toBeGreaterThan(600);
    expect(km).toBeLessThan(800);
    expect(journeyKm("lagos/ikeja", "lagos/surulere")).toBe(60);
  });

  it("quotes bus, flight and car by class", () => {
    const s = make();
    const bus = quoteJourney(s, "fct/abuja-municipal", "bus", NOW);
    expect(bus.blocked).toBeNull();
    expect(bus.minutes).toBeGreaterThan(10 * 60);
    const fly = quoteJourney(s, "fct/abuja-municipal", "flight", NOW);
    expect(fly.blocked).toBeNull();
    expect(fly.fare).toBeGreaterThan(bus.fare);
    expect(fly.minutes).toBeLessThan(bus.minutes);
    expect(quoteJourney(s, "fct/abuja-municipal", "car", NOW).blocked).toBe("You don't have a car");
    expect(quoteJourney(make({}, citizen({ cls: "poor" })), "fct/abuja-municipal", "flight", NOW).blocked).toBe("Flights are out of your budget");
  });

  it("only flies between states with airports, and buses leave from the motor park", () => {
    expect(quoteJourney(make(), "yobe/damaturu", "flight", NOW).blocked).toMatch(/No flights between Lagos and Yobe/);
    expect(quoteJourney(make({ loc: "market" }), "fct/abuja-municipal", "bus", NOW).blocked).toBe("Interstate buses leave from the motor park");
  });

  it("raises bus fares in election week", () => {
    const normal = quoteJourney(make(), "fct/abuja-municipal", "bus", NOW).fare;
    const rush = quoteJourney(make(), "fct/abuja-municipal", "bus", at("2026-11-12T10:00:00+01:00")).fare;
    expect(rush).toBeGreaterThan(normal * 1.4);
  });

  it("arrives at the motor park, pays and takes time", () => {
    const s0 = make();
    const q = quoteJourney(s0, "kwara/ilorin-west", "bus", NOW);
    const s = ok(takeJourney(s0, "kwara/ilorin-west", "bus", NOW, never));
    expect(currentLga(s)).toBe("kwara/ilorin-west");
    expect(isAway(s)).toBe(true);
    expect(s.loc).toBe("park");
    expect(s.money).toBe(300000 - q.fare);
    expect(s.t).toBe(s0.t + q.minutes);
  });
});

describe("away from home", () => {
  const away = ok(takeJourney(make(), "kwara/offa", "bus", NOW, never));
  const ctx = { state: STATE.kwara, lgaName: "Offa", cls: "middle" as const, job: "Nurse", home: "Mini flat", underFlyover: false, visiting: true };

  it("the visited town has a hotel but no home or workplace", () => {
    const ids = lgaPlaces(ctx).map((p) => p.id);
    expect(ids).toContain("hotel");
    expect(ids).not.toContain("home");
    expect(ids).not.toContain("work");
  });

  it("you lodge at a hotel and pay by class", () => {
    const lodge = lgaActions(ctx).hotel.find((a) => a.id === "lodge")!;
    expect(lodge.cost).toBe(25000);
    const r = performAction({ ...away, loc: "hotel", t: 22 * 60 }, lodge, never, { now: NOW, place: { name: "Hotel", open: [0, 24], gen: true } });
    expect("blocked" in r).toBe(false);
  });

  it("you register, collect your PVC and buy votes only at home", () => {
    const inec = lgaActions(ctx).inec;
    const s = { ...away, loc: "inec", t: 10 * 60, citizen: { ...away.citizen!, pvc: "none" as const } };
    const r = performAction(s, inec.find((a) => a.id === "register")!, never, { now: NOW, place: { name: "INEC Office", open: [8, 17], gen: true } });
    expect(r).toEqual({ blocked: "Register and collect your PVC at the INEC office in Ikeja" });
    const b = performAction({ ...away, loc: "market", t: 10 * 60 }, lgaActions(ctx).market[0], never, { now: NOW, place: { name: "Market", open: [6, 20], gen: false } });
    expect(b).toEqual({ blocked: "Nobody here knows you" });
  });

  it("you can only vote at your own polling unit", () => {
    expect(castVote({ ...away, loc: "pu" }, "LP", { now: POLLS, atPollingUnit: true }, never)).toEqual({
      blocked: "You can only vote at your polling unit in Ikeja. Travel home first",
    });
    const home = ok(takeJourney({ ...away, loc: "park" }, "lagos/ikeja", "bus", NOW, never));
    expect(isAway(home)).toBe(false);
    expect(home.loc).toBe("home");
    expect("ballot" in castVote({ ...home, loc: "pu" }, "LP", { now: POLLS, atPollingUnit: true }, never)).toBe(true);
  });
});

describe("crossing servers", () => {
  it("needs no handover inside a zone and up to 30 seconds across the country", () => {
    expect(handoverSeconds("lagos/ikeja", "oyo/ibadan-north")).toBe(0);
    expect(handoverSeconds("lagos/ikeja", "kwara/ilorin-west")).toBe(14);
    expect(zoneHops("SW", "NE")).toBe(2);
    expect(handoverSeconds("lagos/ikeja", "borno/maiduguri")).toBe(22);
    for (const z of ["NW", "NE", "NC", "SW", "SS", "SE"] as const) for (const y of ["NW", "NE", "NC", "SW", "SS", "SE"] as const) expect(zoneHops(z, y)).toBeLessThanOrEqual(3);
  });
});

describe("election day and the end of the season", () => {
  it("restricts movement during polls and freezes everything after", () => {
    const s = make();
    expect(quoteJourney(s, "kwara/offa", "bus", POLLS).blocked).toBe("Movement is restricted on election day");
    expect(quoteJourney(s, "kwara/offa", "bus", Date.parse("2026-11-14T16:00:00+01:00")).blocked).toBe("The season is over. Thank you for voting");
    const market = lgaActions({ state: STATE.lagos, lgaName: "Ikeja", cls: "middle", job: "Nurse", home: "Mini flat", underFlyover: false }).market[1];
    expect(performAction({ ...s, loc: "market", t: 10 * 60 }, market, never, { now: POLLS, place: { name: "Market", open: [6, 20], gen: false } })).toEqual({
      blocked: "Election day: markets and offices are closed. Go and vote",
    });
  });
});
