import { describe, expect, it } from "vitest";
import type { StateStorage } from "zustand/middleware";
import { sequence } from "../sim";
import { createGameStore, FAST_FORWARD_MS } from "./game";

function memoryStorage(): StateStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

/** A player standing at Item 7 at lunchtime with money. */
function atItem7() {
  const store = createGameStore({ rng: sequence(0.99), storage: memoryStorage() });
  store.getState().setCharacter({ name: "Muiz", g: "m", skin: "#8D5524", cloth: "#F4F1EA" });
  store.getState().answer("ok");
  store.getState().travel("item7", "walk", 0);
  store.getState().progress(10 * 60_000);
  // Lunchtime, when Item 7 is open.
  store.setState({ game: { ...store.getState().game, t: 12 * 60 } });
  return store;
}

describe("service counters", () => {
  it("take a number, wait, go through the steps, then the action runs", () => {
    const store = atItem7();
    expect(store.getState().game.loc).toBe("item7");
    const money = store.getState().game.money;
    store.getState().doAction("jollof", 0);
    const sv = store.getState().service!;
    expect(sv.stage).toBe("queue");
    expect(sv.waitMs).toBeGreaterThanOrEqual(30_000);
    expect(store.getState().game.inside).toBe(true);
    expect(store.getState().activity).toBeNull();
    // Busy: nothing else starts while you wait.
    store.getState().doAction("shawarma", 1);
    expect(store.getState().service?.actionId).toBe("jollof");

    store.getState().fastForward(1000);
    expect(store.getState().service!.startedAt + store.getState().service!.waitMs - 1000).toBeCloseTo(FAST_FORWARD_MS, 5);
    store.getState().serviceCalled(5000);
    expect(store.getState().service!.stage).toBe("steps");
    // Order, receipt, pay, collect.
    expect(store.getState().service!.service.steps.map((s) => s.do)).toEqual(["tap", "receipt", "pay", "tap"]);
    expect(store.getState().service!.price).toBe(2200);
    for (let i = 0; i < 4; i++) store.getState().serviceStep(6000 + i);
    expect(store.getState().service).toBeNull();
    const a = store.getState().activity;
    expect(a?.kind === "action" && a.plan.action.id).toBe("jollof");
    store.getState().progress(10 * 60_000);
    expect(store.getState().game.money).toBeLessThan(money);
    expect(store.getState().game.flags.takeaway).toEqual([55]);
  });

  it("leaving the queue costs nothing", () => {
    const store = atItem7();
    const money = store.getState().game.money;
    store.getState().doAction("jollof", 0);
    store.getState().leaveService();
    expect(store.getState().service).toBeNull();
    expect(store.getState().game.money).toBe(money);
  });

  it("a free chat has no queue", () => {
    const store = atItem7();
    store.getState().doAction("aisha2", 0);
    expect(store.getState().service).toBeNull();
  });
});
