import { describe, expect, it } from "vitest";
import { PARTIES } from "../data/parties";
import { UPLOADS_PER_PU, liveSchedule, liveSnapshot, rankParties, uploadsDone } from "./live";
import { simulateVoters } from "./results";

const SEED = 20261114;
const sched = liveSchedule(SEED);
const sum = (t: number[]) => t.reduce((a, b) => a + b, 0);

describe("live results", () => {
  it("starts empty when polls open and ends on the final simulated result", () => {
    expect(liveSnapshot(sched, -0.1).votesCast).toBe(0);
    const end = liveSnapshot(sched, 1);
    const final = Object.values(simulateVoters(SEED)).reduce((a, t) => a + sum(t), 0);
    expect(end.votesCast).toBe(final);
    expect(end.pusReporting).toBe(end.pusTotal);
  });

  it("never goes down for any party as the day goes on", () => {
    let prev = liveSnapshot(sched, 0).nation;
    for (let p = 0.01; p <= 1.001; p += 0.01) {
      const next = liveSnapshot(sched, p).nation;
      next.forEach((v, i) => expect(v).toBeGreaterThanOrEqual(prev[i]));
      prev = next;
    }
  });

  it("state totals add up to the nation", () => {
    const s = liveSnapshot(sched, 0.4);
    const states = Object.values(s.states).reduce((a, t) => a + sum(t), 0);
    expect(states).toBe(s.votesCast);
  });

  it("counts uploads within the day", () => {
    expect(uploadsDone(0.5, 0)).toBe(0);
    expect(uploadsDone(0, 0)).toBe(1);
    expect(uploadsDone(0.99, 0.999)).toBe(UPLOADS_PER_PU - 1);
    expect(uploadsDone(0.99, 0.9999)).toBe(UPLOADS_PER_PU);
    expect(uploadsDone(0.3, 1)).toBe(UPLOADS_PER_PU);
  });

  it("lists the newest uploads first and honours the filter", () => {
    const s = liveSnapshot(sched, 0.5, 10, (pu) => pu.startsWith("lagos/"));
    expect(s.feed.length).toBeGreaterThan(0);
    expect(s.feed.every((f) => f.stateCode === "lagos")).toBe(true);
    for (let i = 1; i < s.feed.length; i++) expect(s.feed[i - 1].at).toBeGreaterThanOrEqual(s.feed[i].at);
  });

  it("ranks most votes first, ties alphabetically", () => {
    const codes = PARTIES.map((p) => p.code);
    expect(rankParties(PARTIES.map(() => 0), codes)).toEqual(PARTIES.map((_, i) => i));
    const t = PARTIES.map(() => 0);
    t[5] = 10;
    t[2] = 10;
    t[9] = 30;
    expect(rankParties(t, codes).slice(0, 3)).toEqual([9, 2, 5]);
  });
});
