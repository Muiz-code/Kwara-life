import { describe, expect, it } from "vitest";
import { EMPTY_GRACE, NEED_PACE } from "../data/needs";
import { findAction, type Action } from "../data/ilorin/actions";
import {
  advance, applyFx, blockReason, checkCritical, finishTrip, freshState, hourly, mood, performAction, performTrip,
  quoteTrip, resolveChoice, sequence, startAction, startTrip, type GameState,
} from ".";

const never = sequence(0.99);
const always = sequence(0);
const act = (place: string, id: string): Action => findAction(place, id)!;
/** Fresh state at a place and time. day 1 is a Monday; hour in 24h. */
function at(loc: string, day = 1, hour = 10, patch: Partial<GameState> = {}): GameState {
  return { ...freshState(), loc, t: (day - 1) * 1440 + hour * 60, ...patch };
}
const ok = (r: GameState | { blocked: string } | { flow: string }): GameState => {
  if ("blocked" in r) throw new Error(r.blocked);
  if ("flow" in r) throw new Error(`opens ${r.flow}`);
  return r;
};

describe("clock and needs", () => {
  it("decays needs each minute", () => {
    const s = freshState();
    advance(s, 100, never);
    expect(s.t).toBe(7 * 60 + 100);
    // 100 minutes at each need's rate, slowed by the pace (needs last longer than in the prototype).
    expect(s.needs.food).toBeCloseTo(70 - 100 * 0.1 * NEED_PACE);
    expect(s.needs.energy).toBeCloseTo(80 - 100 * 0.07 * NEED_PACE);
    expect(s.needs.social).toBeCloseTo(50 - 100 * 0.04 * NEED_PACE);
  });

  it("keeps energy and slows decay while asleep", () => {
    const s = freshState();
    advance(s, 100, never, { sleep: true });
    expect(s.needs.energy).toBe(80);
    expect(s.needs.food).toBeCloseTo(70 - 100 * 0.1 * 0.4 * NEED_PACE);
  });

  it("never goes below zero", () => {
    const s = freshState();
    advance(s, 2000, never);
    expect(s.needs.food).toBe(0);
  });

  it("reports mood from the average", () => {
    expect(mood(freshState())).toBe("Managing");
  });
});

describe("hourly events", () => {
  it("NEPA takes light and brings it back", () => {
    const s = at("home");
    hourly(s, always);
    expect(s.light).toBe(false);
    expect(s.toasts).toContain("NEPA took light");
    hourly(s, always);
    expect(s.light).toBe(true);
  });

  it("the Ministry calls 15 hours after you apply", () => {
    const s = at("secretariat", 1, 9);
    const applied = ok(performAction(s, act("secretariat", "apply"), never));
    expect(applied.flags.applied).toBeDefined();
    expect(applied.flags.job).toBeUndefined();
    // Applied at 10:30am. The check runs on the hour, so the call comes at 2am.
    advance(applied, 899, never);
    expect(applied.flags.job).toBeUndefined();
    advance(applied, 31, never);
    expect(applied.flags.job).toBe(true);
    expect(applied.notes.at(-1)?.title).toBe("You got the job");
  });

  it("owambe invite comes on Saturday at 10am, once", () => {
    const s = at("home", 6, 9);
    advance(s, 60, never);
    expect(s.notes.map((n) => n.title)).toEqual(["Owambe invite"]);
    s.t = 5 * 1440 + 9 * 60;
    advance(s, 60, never);
    expect(s.notes).toHaveLength(1);
  });

  it("going to the owambe costs ₦2,000 and four hours", () => {
    const s = at("home", 6, 10);
    resolveChoice(s, "owambe-go", never);
    expect(s.money).toBe(18000);
    expect(s.t).toBe(5 * 1440 + 14 * 60);
  });
});

describe("action rules", () => {
  it("blocks home actions where you don't live", () => {
    expect(blockReason(at("adewole"), act("adewole", "sleep"))).toBe("You don't live here yet");
  });

  it("blocks by opening hours, day and skill", () => {
    expect(blockReason(at("hub", 1, 20), act("hub", "learn"))).toBe("Innovation Hub is closed now");
    expect(blockReason(at("palace", 1, 13), act("palace", "jummah"))).toBe("Only on Fridays");
    expect(blockReason(at("palace", 5, 13), act("palace", "jummah"))).toBeNull();
    expect(blockReason(at("hub", 1, 10), act("hub", "gig"))).toMatch(/Needs skill 3/);
    expect(blockReason(at("secretariat", 1, 9), act("secretariat", "work"))).toBe("Submit your CV first");
  });

  it("blocks TV without light unless there is a generator", () => {
    expect(blockReason(at("home", 1, 20, { light: false }), act("home", "tv"))).toBe("NEPA took light");
    expect(blockReason(at("adewole", 1, 20, { light: false, homeId: "adewole" }), act("adewole", "tv"))).toBeNull();
  });

  it("blocks what you can't afford", () => {
    expect(blockReason(at("taiwo", 1, 10), act("taiwo", "newphone"))).toBe("Not enough money");
  });

  it("pays, earns and logs", () => {
    const s = ok(performAction(at("po", 1, 9), act("po", "pos"), never));
    expect(s.money).toBe(24500);
    expect(s.t).toBe(13 * 60);
    expect(s.log[0].msg).toMatch(/You earned ₦4,500/);
    expect(s.toasts).toContain("+₦4,500");
  });

  it("uses foodstuff when cooking", () => {
    const s = ok(performAction(at("home", 1, 18), act("home", "cook"), never));
    expect(s.groceries).toBe(0);
    expect(blockReason(s, act("home", "cook"))).toMatch(/No foodstuff/);
  });

  it("sometimes the tap is dry", () => {
    const r = startAction(at("home"), act("home", "bath"), always);
    if (!("plan" in r)) throw new Error();
    expect(r.plan.dur).toBe(60);
    expect(r.plan.pre).toMatch(/Tap no run/);
  });

  it("grows friendship once a day and unlocks Mama Basira's price at 3 hearts", () => {
    let s = at("amala", 1, 12);
    s = ok(performAction(s, act("amala", "basira"), never));
    s = ok(performAction(s, act("amala", "basira"), never));
    expect(s.friends.basira).toBe(1);
    expect(s.log[0].msg).toMatch(/happy to see you again/);
    s.friends.basira = 3;
    const before = s.money;
    s = ok(performAction(s, act("amala", "amala"), never));
    expect(before - s.money).toBe(1800);
  });

  it("renting moves your home", () => {
    const s = ok(performAction(at("irewolede", 1, 10, { money: 200000 }), act("irewolede", "rent"), never));
    expect(s.homeId).toBe("irewolede");
    expect(blockReason(s, act("irewolede", "sleep"))).toBeNull();
    expect(blockReason({ ...s, loc: "home" }, act("home", "sleep"))).toBe("You moved out of this place");
  });

  it("reaching a goal adds a note once", () => {
    const s = ok(performAction(at("taiwo", 1, 10, { money: 70000 }), act("taiwo", "newphone"), never));
    expect(s.goals.phone).toBe(true);
    expect(s.notes.at(-1)?.title).toBe("Goal reached");
    expect(blockReason({ ...s, money: 70000 }, act("taiwo", "newphone"))).toBe("Already done");
  });
});

describe("critical needs", () => {
  it("an empty need only warns you at first", () => {
    const s = at("po", 1, 10);
    s.needs.food = 0;
    checkCritical(s, never);
    expect(s.loc).toBe("po");
    expect(s.notes).toHaveLength(0);
    expect(s.toasts[0]).toMatch(/starving/);
    expect(s.flags.emptyAt?.food).toBe(s.t);
  });

  it("eating in time stops the clock", () => {
    const s = at("po", 1, 10);
    s.needs.food = 0;
    checkCritical(s, never);
    s.needs.food = 30;
    s.t += EMPTY_GRACE;
    checkCritical(s, never);
    expect(s.notes).toHaveLength(0);
    expect(s.flags.emptyAt?.food).toBeUndefined();
  });

  it("fainting from hunger after the grace sends you home with a hospital bill", () => {
    const s = at("po", 1, 10);
    s.needs.food = 0;
    s.flags.emptyAt = { food: s.t - EMPTY_GRACE };
    checkCritical(s, never);
    expect(s.loc).toBe("home");
    expect(s.money).toBe(17000);
    expect(s.needs.food).toBe(40);
    expect(s.notes[0].title).toBe("You fainted");
  });

  it("sleeping off where you are", () => {
    const s = at("po", 1, 10);
    s.needs.energy = 0;
    s.flags.emptyAt = { energy: s.t - EMPTY_GRACE };
    checkCritical(s, never);
    expect(s.loc).toBe("po");
    expect(s.needs.energy).toBe(45);
    expect(s.t).toBe(14 * 60);
  });

  it("no bath for too long: you smell until you wash, and gisting does half as much", () => {
    const s = at("po", 1, 10);
    s.needs.hygiene = 0;
    s.needs.social = 60;
    s.flags.emptyAt = { hygiene: s.t - EMPTY_GRACE };
    checkCritical(s, never);
    expect(s.flags.smelly).toBe(true);
    expect(s.notes[0].title).toBe("You're smelling");
    expect(s.needs.social).toBe(45);
    applyFx(s, { social: 20 });
    expect(s.needs.social).toBe(55);
    s.needs.hygiene = 70;
    checkCritical(s, never);
    expect(s.flags.smelly).toBe(false);
  });

  it("no fun or company for too long: you feel low until both pick up", () => {
    const s = at("po", 1, 10);
    s.needs.fun = 0;
    s.flags.emptyAt = { fun: s.t - EMPTY_GRACE };
    checkCritical(s, never);
    expect(s.flags.low).toBe(true);
    s.needs.fun = 50;
    s.needs.social = 50;
    checkCritical(s, never);
    expect(s.flags.low).toBe(false);
  });
});

describe("travel", () => {
  it("quotes every mode", () => {
    const q = quoteTrip("home", "unilorin");
    expect(q.modes.keke.fare).toBeGreaterThanOrEqual(100);
    expect(q.modes.walk.fare).toBe(0);
    expect(q.modes.okada.minutes).toBeLessThan(q.modes.keke.minutes);
  });

  it("blocks okadas on the Malete road, horses you haven't hired and long walks", () => {
    const s = at("home");
    expect(startTrip(s, "kwasu", "okada")).toEqual({ blocked: "Okadas don't do the Malete road" });
    expect(startTrip(s, "kwasu", "walk")).toEqual({ blocked: "Too far to walk" });
    expect(startTrip(s, "item7", "horse")).toEqual({ blocked: "Hire a horse at the Emir's Palace" });
    expect(startTrip(s, "home", "keke")).toEqual({ blocked: "You are already here" });
  });

  it("pays the fare, moves you and runs the clock", () => {
    const s0 = at("home", 1, 9);
    const q = quoteTrip("home", "unilorin");
    const s = ok(performTrip(s0, "unilorin", "keke", never));
    expect(s.loc).toBe("unilorin");
    expect(s.money).toBe(20000 - q.modes.keke.fare);
    expect(s.t).toBe(s0.t + q.modes.keke.minutes);
    expect(s.log[0].msg).toBe("You went to Unilorin by keke.");
  });

  it("walking tires you", () => {
    const s = ok(performTrip(at("home", 1, 9), "item7", "walk", never));
    expect(s.needs.energy).toBeLessThan(80);
  });

  it("visiting KWASU completes the goal", () => {
    const s = ok(performTrip(at("home", 1, 9), "kwasu", "keke", never));
    expect(s.flags.kwasu).toBe(true);
  });

  it("the okada can hit a pothole", () => {
    const r = startTrip(at("home", 1, 9), "item7", "okada");
    if ("blocked" in r) throw new Error();
    const s = finishTrip(r.state, r.trip, always);
    expect(s.log[0].msg).toMatch(/pothole/);
  });
});
