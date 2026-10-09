import { describe, expect, it } from "vitest";
import type { StateStorage } from "zustand/middleware";
import { blockReason, freshState, performAction, sequence, type GameState } from "../sim";
import { createGameStore, FAST_FORWARD_MS } from "./game";
import { actionsAt } from "./world";

function memoryStorage(): StateStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

const never = sequence(0.99);
const at = (loc: string, patch: Partial<GameState> = {}): GameState => ({ ...freshState(), loc, t: 12 * 60, money: 20000, ...patch });
const ok = (r: ReturnType<typeof performAction>): GameState => {
  if ("blocked" in r || "flow" in r) throw new Error(JSON.stringify(r));
  return r;
};

describe("Item 7 take-away", () => {
  it("packs the meal to take home instead of eating it at the counter", () => {
    const jollof = actionsAt(at("item7"), null, "item7").find((a) => a.id === "jollof")!;
    expect(jollof.label).toMatch(/take-away/);
    expect(jollof.fx.food).toBeUndefined();
    expect(jollof.takeaway).toBe(55);
    const s = at("item7");
    s.needs.food = 20;
    const after = ok(performAction(s, jollof, never));
    expect(after.flags.takeaway).toEqual([55]);
    expect(after.needs.food).toBeLessThan(21);
  });

  it("eats the pack at home, and only when there is one", () => {
    const home = at("home", { flags: { takeaway: [55] } });
    home.needs.food = 20;
    const eat = actionsAt(home, null, "home").find((a) => a.id === "eat-takeaway")!;
    expect(eat).toBeDefined();
    const fed = ok(performAction(home, eat, never));
    expect(fed.needs.food).toBeGreaterThan(70);
    expect(fed.flags.takeaway).toEqual([]);
    expect(actionsAt(fed, null, "home").some((a) => a.id === "eat-takeaway")).toBe(false);
  });

  it("you can only carry three packs", () => {
    const full = at("item7", { flags: { takeaway: [55, 40, 55] } });
    const jollof = actionsAt(full, null, "item7").find((a) => a.id === "jollof")!;
    expect(blockReason(full, jollof)).toMatch(/hands are full/);
  });
});

describe("fast-forward", () => {
  it("plays the rest of a trip in about two seconds without jumping", () => {
    const store = createGameStore({ rng: never, storage: memoryStorage() });
    store.getState().setCharacter({ name: "Muiz", g: "m", skin: "#8D5524", cloth: "#F4F1EA" });
    store.getState().answer("ok");
    store.getState().travel("item7", "keke", 0);
    const a = store.getState().activity!;
    const half = a.ms / 2;
    store.getState().fastForward(half);
    const b = store.getState().activity!;
    expect(b.kind).toBe("trip");
    // Same point in the trip, the rest squeezed into FAST_FORWARD_MS.
    expect((half - b.startedAt) / b.ms).toBeCloseTo(0.5, 5);
    expect(b.startedAt + b.ms - half).toBeCloseTo(FAST_FORWARD_MS, 5);
    expect(store.getState().game.loc).toBe("home");
    store.getState().progress(half + FAST_FORWARD_MS + 1);
    expect(store.getState().game.loc).toBe("item7");
  });
});
