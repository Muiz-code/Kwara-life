import { describe, expect, it } from "vitest";
import type { StateStorage } from "zustand/middleware";
import { sequence } from "../sim";
import { TASK_EVERY, TASK_FIRST, taskAt, taskPay } from "../data/work-tasks";
import { createGameStore } from "./game";

function memoryStorage(): StateStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe("work tasks", () => {
  it("come up on a schedule, each open for a few seconds", () => {
    expect(taskAt(0)).toBeNull();
    expect(taskAt(TASK_FIRST + 100)).toBe(0);
    expect(taskAt(TASK_FIRST + TASK_EVERY - 100)).toBeNull();
    expect(taskAt(TASK_FIRST + 2 * TASK_EVERY + 100)).toBe(2);
  });

  it("pay about 4% of a day's pay (a month's salary), within limits", () => {
    expect(taskPay(220_000)).toBe(8800);
    expect(taskPay(0)).toBe(500);
    expect(taskPay(50_000_000)).toBe(50000);
  });

  it("a shift where you handled things pays a bonus on top", () => {
    const store = createGameStore({ rng: sequence(0.5), storage: memoryStorage() });
    const err = store.getState().createCitizen({ name: "Muiz", look: { g: "m", skin: "#8D5524", cloth: "#F4F1EA" }, stateCode: "kwara", lgaCode: "kwara/offa" });
    expect(err).toBeFalsy();
    const g = store.getState().game;
    store.setState({
      game: { ...g, notes: [], loc: "work", citizen: { ...g.citizen!, career: "worker", employed: true, monthlyPay: 220_000 } },
      activity: {
        kind: "action", startedAt: 0, ms: 60_000, done: 0,
        plan: { action: { id: "work", label: "Go to work", dur: 0, shift: true, fx: {}, done: "Shift done." }, dur: 240, cost: 0, sleep: false, pre: "" },
      },
    });
    const before = store.getState().game.bank.txns.filter((t) => t.label === "Bonus for good work").length;
    store.getState().workTask(0, TASK_FIRST + 100);
    store.getState().workTask(0, TASK_FIRST + 200); // twice counts once
    store.getState().workTask(1, TASK_FIRST + 100); // not open yet
    store.getState().workTask(1, TASK_FIRST + TASK_EVERY + 100);
    store.getState().progress(60_000);
    expect(store.getState().activity).toBeNull();
    const bonus = store.getState().game.bank.txns.filter((t) => t.label === "Bonus for good work");
    expect(bonus.length).toBe(before + 1);
    expect(bonus.at(-1)!.amt).toBe(2 * taskPay(220_000));
  });
});
