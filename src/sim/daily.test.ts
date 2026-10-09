import { describe, expect, it } from "vitest";
import { freshState, type GameState } from ".";
import { checkIn, dailyOf, MISSIONS, missionsFor, streakReward, track } from "./daily";

const fresh = (): GameState => ({ ...freshState(), money: 0 });

describe("daily streak", () => {
  it("checks you in once a day and grows while you keep coming", () => {
    const s = fresh();
    expect(checkIn(s, "2026-10-14")).toBe(true);
    expect(checkIn(s, "2026-10-14")).toBe(false);
    expect(s.flags.streak).toEqual({ last: "2026-10-14", count: 1 });
    expect(s.money).toBe(streakReward(1));
    checkIn(s, "2026-10-15");
    expect(s.flags.streak?.count).toBe(2);
    expect(s.money).toBe(streakReward(1) + streakReward(2));
  });

  it("a missed day starts it again, and day seven earns a stamp", () => {
    const s = fresh();
    for (let d = 14; d <= 20; d++) checkIn(s, `2026-10-${d}`);
    expect(s.flags.streak?.count).toBe(7);
    expect(s.flags.stamps?.week).toBeDefined();
    checkIn(s, "2026-10-22");
    expect(s.flags.streak?.count).toBe(1);
    expect(streakReward(30)).toBe(3500);
  });
});

describe("daily missions", () => {
  it("are three different ones, the same all day for the same person", () => {
    const a = missionsFor("2026-10-14", "Muiz");
    expect(new Set(a).size).toBe(3);
    expect(missionsFor("2026-10-14", "Muiz")).toEqual(a);
  });

  it("move on as you play and pay when done", () => {
    const s = fresh();
    s.flags.daily = { day: "2026-10-14", missions: [{ id: "keke", got: 0 }, { id: "gist", got: 0 }, { id: "counter", got: 0 }] };
    track(s, { kind: "trip", mode: "keke" }, "2026-10-14");
    expect(s.money).toBe(MISSIONS.find((m) => m.id === "keke")!.reward);
    track(s, { kind: "action", id: "gist", place: "buka", social: true }, "2026-10-14");
    expect(dailyOf(s, "2026-10-14").missions[1].got).toBe(1);
    track(s, { kind: "action", id: "gist", place: "buka", social: true }, "2026-10-14");
    track(s, { kind: "served" }, "2026-10-14");
    expect(s.flags.stamps?.perfect).toBeDefined();
  });

  it("a new day brings new missions", () => {
    const s = fresh();
    dailyOf(s, "2026-10-14").missions[0].got = 5;
    expect(dailyOf(s, "2026-10-15").missions.every((m) => m.got === 0)).toBe(true);
  });
});

describe("stamps", () => {
  it("come once, for firsts", () => {
    const s = fresh();
    track(s, { kind: "trip", mode: "keke" }, "2026-10-14");
    const at = s.flags.stamps?.keke;
    expect(at).toBeDefined();
    track(s, { kind: "trip", mode: "keke" }, "2026-10-14");
    expect(s.toasts.filter((t) => t.includes("First keke ride"))).toHaveLength(1);
  });
});
