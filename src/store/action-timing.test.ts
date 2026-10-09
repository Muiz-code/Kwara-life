import { describe, expect, it } from "vitest";
import { actionAnimMs } from "./game";

const plan = (dur: number, extra: { sleep?: boolean; shift?: boolean } = {}) => ({ dur, sleep: !!extra.sleep, action: { shift: extra.shift } });

describe("how long actions play", () => {
  it("long enough to feel, never a chore", () => {
    expect(actionAnimMs(plan(40))).toBe(20_000); // eating
    expect(actionAnimMs(plan(30))).toBe(15_000); // a bath
    expect(actionAnimMs(plan(5))).toBe(6_000); // the shortest
    expect(actionAnimMs(plan(300))).toBe(40_000); // the longest
  });

  it("a night's sleep is 30 seconds, a work shift a minute to a minute and a half", () => {
    expect(actionAnimMs(plan(480, { sleep: true }))).toBe(30_000);
    expect(actionAnimMs(plan(90, { sleep: true }))).toBe(15_000);
    expect(actionAnimMs(plan(240, { shift: true }))).toBe(60_000);
    expect(actionAnimMs(plan(480, { shift: true }))).toBe(90_000);
  });
});
