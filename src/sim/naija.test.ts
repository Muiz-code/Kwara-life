import { describe, expect, it } from "vitest";
import { PRESIDENTIAL_2027 as CAL } from "../data/calendar";
import { lgaActions, lgaPlaces, type LgaPlaceId } from "../data/lga";
import { PARTIES } from "../data/parties";
import { STATE } from "../data/states";
import {
  ballot, buyPromo, buyVotes, bvasScan, castVote, catchRisk, collate, freshState, offerDue, performAction, postSupportCard,
  puSheets, resolveChoice, rollCitizen, seeded, sequence, showOffer, simulateVoters, spreadBribes, uploadOrder, PARTY_INDEX,
  type Citizen, type GameState,
} from ".";

const at = (iso: string) => Date.parse(iso);
const EARLY = at("2026-10-10T12:00:00+01:00"); // registration open
const PVC_TIME = at("2026-11-02T12:00:00+01:00"); // collection open
const BLACKOUT = at("2026-11-13T09:00:00+01:00");
const POLLS = at("2026-11-14T10:00:00+01:00");
const never = sequence(0.99);
const always = sequence(0);

const look = { g: "m" as const, skin: "#8D5524", cloth: "#F4F1EA" };
function citizen(patch: Partial<Citizen> = {}): Citizen {
  return {
    name: "Muiz", look, stateCode: "kwara", lgaCode: "kwara/offa", puCode: "kwara/offa/2", cls: "poor", job: "Tailor",
    home: "Family compound", career: "artisan", education: "secondary", employed: true, monthlyPay: 0, underFlyover: false, wasUnder: false, ownsTv: false, ownsRadio: true, pvc: "have",
    createdAt: at("2026-10-07T12:00:00+01:00"), registeredAt: null, ...patch,
  };
}
const ctxFor = (c: Citizen) => ({ state: STATE[c.stateCode], lgaName: "Offa", cls: c.cls, job: c.job, home: c.home, underFlyover: c.underFlyover, wasUnder: c.wasUnder, career: c.career });
/** A citizen on a generated LGA map at a place, game day 1 (Monday), 10am. */
function onMap(loc: LgaPlaceId, c = citizen(), patch: Partial<GameState> = {}): GameState {
  return { ...freshState(), citizen: c, loc, homeId: "home", t: 10 * 60, money: 50000, ...patch };
}
const place = (s: GameState) => {
  const p = lgaPlaces(ctxFor(s.citizen!)).find((x) => x.id === s.loc)!;
  return { name: p.name, open: p.open, gen: p.gen };
};
const act = (s: GameState, id: string) => lgaActions(ctxFor(s.citizen!))[s.loc as LgaPlaceId].find((a) => a.id === id)!;
function run(s: GameState, id: string, now: number, rng = never) {
  const r = performAction(s, act(s, id), rng, { now, place: place(s) });
  if ("blocked" in r) throw new Error(r.blocked);
  if ("flow" in r) throw new Error(r.flow);
  return r;
}
const why = (s: GameState, id: string, now: number) => {
  const r = performAction(s, act(s, id), never, { now, place: place(s) });
  return "blocked" in r ? r.blocked : "flow" in r ? `flow:${r.flow}` : null;
};

describe("citizen roll", () => {
  it("keeps the player's state and LGA and rolls the rest", () => {
    const c = rollCitizen({ name: " Muiz ", look, stateCode: "kwara", lgaCode: "kwara/ilorin-west" }, EARLY, seeded(3));
    expect(c.name).toBe("Muiz");
    expect(c.lgaCode).toBe("kwara/ilorin-west");
    expect(c.puCode).toMatch(/^kwara\/ilorin-west\/[123]$/);
    expect(["poor", "middle", "rich"]).toContain(c.cls);
  });

  it("rejects an LGA from another state", () => {
    expect(() => rollCitizen({ name: "A", look, stateCode: "lagos", lgaCode: "kwara/offa" }, EARLY, seeded(1))).toThrow();
  });

  it("matches the class odds over many rolls, and hands nobody a PVC", () => {
    const n = 4000;
    const counts = { poor: 0, middle: 0, rich: 0, none: 0, under: 0 };
    const R = seeded(42);
    for (let i = 0; i < n; i++) {
      const c = rollCitizen({ name: "A", look, stateCode: "kwara", lgaCode: "kwara/offa" }, EARLY, R);
      counts[c.cls]++;
      if (c.pvc === "none") counts.none++;
      if (c.underFlyover) counts.under++;
      if (c.underFlyover) expect(c.ownsTv).toBe(false);
    }
    expect(counts.poor / n).toBeCloseTo(0.63, 1);
    expect(counts.rich / n).toBeCloseTo(0.05, 1);
    // Everyone registers and collects their own PVC.
    expect(counts.none).toBe(n);
    expect(counts.under / counts.poor).toBeCloseTo(0.15, 1);
  });

  it("gives late joiners no PVC either: missing registration means no vote", () => {
    const c = rollCitizen({ name: "A", look, stateCode: "kwara", lgaCode: "kwara/moro" }, at("2026-11-01T10:00:00+01:00"), seeded(7));
    expect(c.pvc).toBe("none");
  });
});

describe("civic actions on an LGA map", () => {
  it("opens registration 2 minutes after sign-up and closes it on 30 October", () => {
    const c = citizen({ pvc: "none", createdAt: EARLY });
    const s = onMap("inec", c);
    expect(why(s, "register", EARLY + 60_000)).toMatch(/opens in a moment/);
    const r = run(s, "register", EARLY + 120_000);
    expect(r.citizen!.pvc).toBe("registered");
    expect(r.citizen!.registeredAt).toBe(EARLY + 120_000);
    expect(why(s, "register", at("2026-10-31T09:00:00+01:00"))).toMatch(/Registration closed on 30 October/);
  });

  it("collects the PVC only after the announcement, sometimes after a second try", () => {
    const s = onMap("inec", citizen({ pvc: "registered" }));
    expect(why(s, "collect", EARLY)).toMatch(/announce PVC collection on 31 October/);
    const turned = run(s, "collect", PVC_TIME, always);
    expect(turned.citizen!.pvc).toBe("registered");
    expect(why(turned, "collect", PVC_TIME)).toBe("VINEC said come back tomorrow");
    const got = run(turned, "collect", PVC_TIME + 86_400_000);
    expect(got.citizen!.pvc).toBe("have");
    expect(why(onMap("inec", citizen({ pvc: "registered" })), "collect", at("2026-11-14T07:51:00+01:00"))).toBe("PVC collection has closed");
  });

  it("pays a day's share of a monthly salary, once a game day", () => {
    const nurse = citizen({ cls: "middle", job: "Nurse", career: "worker", monthlyPay: 220000 });
    const s = run(onMap("work", nurse), "work", EARLY, sequence(0.5));
    expect(s.money).toBe(50000 + 10000);
    expect(s.t).toBe(10 * 60 + 480);
    expect(s.log[0].msg).toBe("A full day as a nurse. You earned ₦10,000.");
    expect(why({ ...s, loc: "work" }, "work", EARLY)).toBe("You already worked today");
  });

  it("pays artisans by the day and needs a job for 9 to 5 work", () => {
    const s = run(onMap("work"), "work", EARLY, sequence(0.5));
    expect(s.money).toBeGreaterThan(50000);
    const jobless = onMap("work", citizen({ career: "worker", employed: false }));
    expect(why(jobless, "work", EARLY)).toMatch(/You don't have a job yet/);
  });

  it("needs a TV for TV news at home, and a radio for the radio", () => {
    const home = onMap("home", citizen({ ownsTv: false, ownsRadio: false }));
    expect(why(home, "tv", EARLY)).toMatch(/You don't have a TV/);
    expect(why(home, "radio", EARLY)).toMatch(/You don't have a radio/);
    const bought = run(onMap("market", citizen({ ownsRadio: false })), "buyradio", EARLY);
    expect(bought.citizen!.ownsRadio).toBe(true);
    expect(why({ ...bought, loc: "market" }, "buyradio", EARLY)).toBe("You already have one");
  });

  it("media and gist make you more informed and show the news", () => {
    const tv = run(onMap("viewing"), "vnews", EARLY);
    expect(tv.informed).toBe(2);
    expect(tv.notes.at(-1)!.title).toBe("On the TV");
    const gist = run(onMap("buka"), "gist", EARLY);
    expect(gist.informed).toBe(1);
    expect(gist.log[0].msg).toMatch(/Someone said/);
  });

  it("the shelter sometimes has a bed", () => {
    const c = citizen({ underFlyover: true, home: "Under a flyover near the motor park" });
    const s = run(onMap("shelter", c), "bed", EARLY, always);
    expect(s.citizen!.underFlyover).toBe(false);
    expect(s.citizen!.wasUnder).toBe(true);
    expect(why(onMap("shelter", citizen({ wasUnder: true })), "bed", EARLY)).toBe("You have a bed already");
  });

  it("vote, vote buying and flyers open their own screens", () => {
    expect(why(onMap("pu"), "vote", POLLS)).toBe("flow:vote");
    expect(why(onMap("market"), "bribe", EARLY)).toBe("flow:bribe");
    expect(why(onMap("board"), "postfly", EARLY)).toBe("flow:flyer");
    expect(why(onMap("board"), "postfly", BLACKOUT)).toBe("Campaigning has ended");
  });
});

describe("campaign", () => {
  const s = onMap("home");
  it("posts one support card a day with a clean note", () => {
    const r = postSupportCard(s, { party: "LP", issues: ["Jobs", "Roads"], note: "Fix the roads" }, { now: EARLY });
    if ("blocked" in r) throw new Error(r.blocked);
    expect(r.supportCards).toHaveLength(1);
    expect(postSupportCard(r, { party: "APC", issues: [], note: "" }, { now: EARLY })).toEqual({ blocked: "You have posted today. Come back tomorrow" });
    expect("blocked" in postSupportCard(r, { party: "APC", issues: [], note: "" }, { now: EARLY + 86_400_000 })).toBe(false);
  });

  it("filters notes and limits issues", () => {
    expect(postSupportCard(s, { party: "LP", issues: [], note: "visit www.x.ng" }, { now: EARLY })).toEqual({ blocked: "That note can't be posted. Keep it positive, no links" });
    expect(postSupportCard(s, { party: "LP", issues: [], note: "they are stupid" }, { now: EARLY })).toHaveProperty("blocked");
    expect(postSupportCard(s, { party: "LP", issues: ["Jobs", "Roads", "Security", "Healthcare"], note: "" }, { now: EARLY })).toHaveProperty("blocked");
    expect(postSupportCard(s, { party: "LP", issues: [], note: "" }, { now: BLACKOUT })).toHaveProperty("blocked");
  });

  it("refuses doctored promotion requests", () => {
    const rich = { ...s, money: 5_000_000 };
    for (const bad of [
      { kind: "flyer", option: "length", party: "APC" },
      { kind: "constructor", option: 0, party: "APC" },
      { kind: "flyer", option: 1.5, party: "APC" },
      { kind: "flyer", option: 0, party: "__proto__" },
    ])
      expect(buyPromo(rich, bad as never, { now: EARLY })).toHaveProperty("blocked");
  });

  it("charges the same price for every party and caps a day at ₦1m", () => {
    const rich = { ...s, money: 5_000_000 };
    const a = buyPromo(rich, { kind: "flyer", option: 2, party: "APC" }, { now: EARLY });
    const b = buyPromo(rich, { kind: "flyer", option: 2, party: "ZLP" }, { now: EARLY });
    if ("blocked" in a || "blocked" in b) throw new Error();
    expect(a.promo.price).toBe(b.promo.price);
    const two = buyPromo(a.state, { kind: "flyer", option: 2, party: "civic" }, { now: EARLY });
    if ("blocked" in two) throw new Error(two.blocked);
    expect(buyPromo(two.state, { kind: "news", option: 0, party: "LP" }, { now: EARLY })).toEqual({ blocked: "Daily promotion cap is ₦1,000,000" });
    expect(buyPromo(rich, { kind: "news", option: 0, party: "LP" }, { now: BLACKOUT })).toEqual({ blocked: "No promotion during the blackout" });
  });
});

describe("vote buying", () => {
  it("uses the prototype's catch risk", () => {
    expect(catchRisk(1000, 5)).toBe(16);
    expect(catchRisk(10000, 50)).toBe(47);
  });

  it("caught: money gone, fined, PVC seized, custody, on bail, news without a party", () => {
    const r = buyVotes(onMap("market"), { party: "APC", perPerson: 5000, people: 5 }, { now: EARLY }, always);
    if ("blocked" in r || !r.outcome.caught) throw new Error();
    expect(r.state.money).toBe(12500);
    expect(r.state.citizen!.pvc).toBe("seized");
    expect(r.state.onBail).toBe(true);
    expect(r.outcome.news).not.toMatch(/APC/);
    expect(buyVotes(r.state, { party: "APC", perPerson: 1000, people: 5 }, { now: EARLY }, never)).toHaveProperty("blocked");
  });

  it("not caught: some take it, half of those vote as paid, the buyer never learns who", () => {
    // Not caught (0.99), then per person: takes (0.1) and complies (0.1).
    const r = buyVotes(onMap("market"), { party: "PDP", perPerson: 1000, people: 5 }, { now: EARLY }, sequence(0.99, ...Array(10).fill(0.1)));
    if ("blocked" in r || r.outcome.caught) throw new Error();
    expect(r.outcome.took).toBe(5);
    expect(r.state.bribeEffects.PDP).toBe(5);
    expect(r.state.log[0].msg).toMatch(/never know how they voted/);
  });

  it("offers to sell your vote come once, and reporting earns civic points", () => {
    const s = onMap("home", citizen(), { t: 19 * 60 + 5 });
    expect(offerDue(s, PVC_TIME)).toBe("door");
    showOffer(s, "door");
    expect(offerDue(s, PVC_TIME)).toBeNull();
    resolveChoice(s, "door-report", never);
    expect(s.civic).toBe(3);
    const t = onMap("pu");
    resolveChoice(t, "pu-take", always);
    expect(t.citizen!.pvc).toBe("seized");
  });
});

describe("election day", () => {
  it("lists every party alphabetically on the ballot", () => {
    expect(ballot().map((p) => p.code)).toEqual(PARTIES.map((p) => p.code).sort());
    expect(ballot()).toHaveLength(21);
  });

  it("falls back to facial capture when the fingerprint fails", () => {
    expect(bvasScan(1, always)).toBe("face-capture");
    expect(bvasScan(2, always)).toBe("accredited");
  });

  it("votes once, at the polling unit, during polls, and never stores the choice", () => {
    const s = onMap("pu");
    expect(castVote(s, "LP", { now: EARLY, atPollingUnit: true }, never)).toEqual({ blocked: "Voting is on 14 November, 8am to 4pm" });
    expect(castVote(s, "LP", { now: POLLS, atPollingUnit: false }, never)).toEqual({ blocked: "Go to your polling unit to vote" });
    const r = castVote(s, "LP", { now: POLLS, atPollingUnit: true }, never);
    if ("blocked" in r) throw new Error(r.blocked);
    expect(r.ballot).toEqual({ electionId: CAL.id, puCode: "kwara/offa/2", party: "LP" });
    expect(JSON.stringify(r.state)).not.toMatch(/"LP"/);
    expect(castVote(r.state, "APC", { now: POLLS, atPollingUnit: true }, never)).toEqual({ blocked: "You have voted" });
    expect(castVote(onMap("pu", citizen({ pvc: "registered" })), "LP", { now: POLLS, atPollingUnit: true }, never)).toEqual({ blocked: "You need a PVC to vote" });
    // Object built-ins are not parties.
    for (const fake of ["constructor", "__proto__", "toString", "hasOwnProperty"])
      expect(castVote(s, fake, { now: POLLS, atPollingUnit: true }, never)).toEqual({ blocked: "Choose one party" });
  });
});

describe("results", () => {
  it("gives every party the same odds over many draws", () => {
    const totals = PARTIES.map(() => 0);
    for (let seed = 1; seed <= 20; seed++) for (const t of Object.values(simulateVoters(seed))) t.forEach((v, i) => (totals[i] += v));
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    for (const t of totals) expect(Math.abs(t - mean) / mean).toBeLessThan(0.08);
  });

  it("is deterministic per seed", () => {
    expect(simulateVoters(9)).toEqual(simulateVoters(9));
    expect(uploadOrder(9)).toEqual(uploadOrder(9));
    expect(new Set(uploadOrder(9)).size).toBe(555);
  });

  it("spreads vote buying over the buyer's LGA only", () => {
    const spread = spreadBribes("kwara/offa", { APC: 7 });
    expect(Object.keys(spread)).toEqual(["kwara/offa/1", "kwara/offa/2", "kwara/offa/3"]);
    expect(Object.values(spread).map((t) => t[PARTY_INDEX.APC])).toEqual([3, 2, 2]);
  });

  it("shows a real-player breakdown only from 10 real voters", () => {
    const real = { "kwara/offa/1": PARTIES.map((_, i) => (i === 0 ? 9 : 0)), "kwara/offa/2": PARTIES.map((_, i) => (i === 0 ? 10 : 0)) };
    const sheets = puSheets({ simulated: {}, real, bribes: {} });
    expect(sheets.find((s) => s.code === "kwara/offa/1")!.real).toBeUndefined();
    expect(sheets.find((s) => s.code === "kwara/offa/2")!.real).toBeDefined();
  });

  it("collates only uploaded units and adds up by LGA, state and nation", () => {
    const sheets = puSheets({ simulated: simulateVoters(1), real: {}, bribes: {} });
    const all = new Set(sheets.map((s) => s.code));
    const snap = collate(sheets, all, 1, "now");
    const nation = snap.nation.reduce((a, b) => a + b, 0);
    const states = Object.values(snap.states).flat().reduce((a, b) => a + b, 0);
    expect(states).toBe(nation);
    expect(snap.pusUploaded).toBe(555);
    expect(collate(sheets, new Set(), 0, "now").nation.every((v) => v === 0)).toBe(true);
  });
});
