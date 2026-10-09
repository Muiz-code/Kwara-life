import { describe, expect, it } from "vitest";
import { tripPhase, tripTiming, tripTotalMs } from "./travel";

describe("trip timing", () => {
  it("rides at the vehicle's speed: a typical keke trip is about 15 seconds", () => {
    expect(tripTiming("keke", 1100).ride).toBeGreaterThan(13_000);
    expect(tripTiming("keke", 1100).ride).toBeLessThan(17_000);
    expect(tripTiming("okada", 1100).ride).toBeLessThan(tripTiming("keke", 1100).ride);
    expect(tripTiming("danfo", 1100).ride).toBeGreaterThan(tripTiming("keke", 1100).ride);
  });

  it("a short hop still takes a moment, and the longest road is capped", () => {
    expect(tripTiming("keke", 100).ride).toBe(5_000);
    expect(tripTiming("keke", 50_000).ride).toBe(60_000);
  });

  it("walks through wait, board, ride and alight in order", () => {
    const t = tripTiming("keke", 1100);
    expect(tripPhase(t, 0).phase).toBe("wait");
    expect(tripPhase(t, t.wait + 10).phase).toBe("board");
    expect(tripPhase(t, t.wait + t.board + 10).phase).toBe("ride");
    expect(tripPhase(t, tripTotalMs(t) - 10).phase).toBe("alight");
    expect(tripPhase(t, tripTotalMs(t) + 5000)).toEqual({ phase: "alight", q: 1 });
  });

  it("walking has no vehicle to wait for", () => {
    expect(tripTiming("walk", 800)).toMatchObject({ wait: 0, board: 0, alight: 0 });
  });
});
