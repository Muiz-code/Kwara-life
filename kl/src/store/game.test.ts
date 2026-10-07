import { describe, expect, it } from "vitest";
import type { StateStorage } from "zustand/middleware";
import { sequence } from "../sim";
import { createGameStore, SAVE_KEY } from "./game";

function memoryStorage(): StateStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

const me = { name: "Muiz", g: "m" as const, skin: "#8D5524", cloth: "#F4F1EA" };

function started() {
  const storage = memoryStorage();
  const store = createGameStore({ rng: sequence(0.99), storage });
  store.getState().setCharacter(me);
  store.getState().answer("ok");
  return { store, storage };
}

describe("game store", () => {
  it("waits for a character and the welcome note before the clock runs", () => {
    const store = createGameStore({ rng: sequence(0.99), storage: memoryStorage() });
    const t0 = store.getState().game.t;
    store.getState().tick();
    expect(store.getState().game.t).toBe(t0);
    store.getState().setCharacter(me);
    expect(store.getState().game.notes[0].title).toBe("Welcome to Ilorin, Muiz");
    store.getState().tick();
    expect(store.getState().game.t).toBe(t0);
    store.getState().answer("ok");
    store.getState().tick();
    expect(store.getState().game.t).toBe(t0 + 2);
  });

  it("pauses", () => {
    const { store } = started();
    const t0 = store.getState().game.t;
    store.getState().togglePause();
    store.getState().tick();
    expect(store.getState().game.t).toBe(t0);
  });

  it("plays an action out over real time", () => {
    const { store } = started();
    const s = store.getState();
    const t0 = s.game.t;
    s.doAction("phone", 1000);
    const a = store.getState().activity!;
    expect(a.kind).toBe("action");
    store.getState().tick();
    expect(store.getState().game.t).toBe(t0);
    store.getState().progress(1000 + a.ms / 2);
    expect(store.getState().game.t).toBe(t0 + 15);
    store.getState().progress(1000 + a.ms);
    expect(store.getState().activity).toBeNull();
    expect(store.getState().game.t).toBe(t0 + 30);
    expect(store.getState().toasts).toContain("You caught up on everyone's status.");
  });

  it("toasts the reason an action is blocked", () => {
    const { store } = started();
    store.getState().doAction("cook", 0);
    store.getState().progress(10_000);
    store.getState().doAction("cook", 20_000);
    expect(store.getState().toasts.at(-1)).toMatch(/No foodstuff/);
    expect(store.getState().activity).toBeNull();
  });

  it("travels and arrives", () => {
    const { store } = started();
    store.getState().select("item7");
    store.getState().travel("item7", "keke", 0);
    expect(store.getState().activity?.kind).toBe("trip");
    store.getState().progress(60_000);
    expect(store.getState().game.loc).toBe("item7");
    expect(store.getState().selected).toBe("item7");
  });

  it("tapping your own place twice goes inside", () => {
    const { store } = started();
    store.getState().select("home");
    expect(store.getState().game.inside).toBe(true);
    store.getState().setInside(false);
    expect(store.getState().game.inside).toBe(false);
  });

  it("saves the game and loads it back", async () => {
    const { store, storage } = started();
    store.getState().travel("item7", "keke", 0);
    store.getState().progress(60_000);
    expect(storage.data.get(SAVE_KEY)).toContain('"loc":"item7"');
    const again = createGameStore({ rng: sequence(0.99), storage });
    await again.persist.rehydrate();
    expect(again.getState().game.loc).toBe("item7");
    expect(again.getState().game.char?.name).toBe("Muiz");
  });

  it("ignores a broken save", async () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ state: { game: { loc: "lagos" } }, version: 1 }));
    const store = createGameStore({ storage });
    await store.persist.rehydrate();
    expect(store.getState().game.loc).toBe("home");
  });
});

describe("citizens across Nigeria", () => {
  const NOW = Date.parse("2026-10-15T10:00:00+01:00");
  function made(lgaCode = "kano/fagge", stateCode = "kano") {
    const store = createGameStore({ rng: sequence(0.4), storage: memoryStorage(), realNow: () => NOW });
    expect(store.getState().createCitizen({ name: "Hauwa", look: { g: "h", skin: "#6B3E26", cloth: "#2F7D7A" }, stateCode, lgaCode })).toBeNull();
    return store;
  }

  it("rolls a citizen and starts them at home", () => {
    const g = made().getState().game;
    expect(g.citizen?.lgaCode).toBe("kano/fagge");
    expect(g.loc).toBe("home");
    expect(g.money).toBeGreaterThan(0);
    expect(g.log[0].msg).toBe("Hauwa started life in Fagge, Kano.");
  });

  it("uses the LGA's own places and actions, not Ilorin's", () => {
    const store = made();
    store.getState().doAction("sleep", 0);
    expect(store.getState().activity?.kind).toBe("action");
  });

  it("travels to another state behind a loading screen sized by server distance", () => {
    const store = made();
    store.setState({ game: { ...store.getState().game, loc: "park", money: 500000 } });
    expect(store.getState().journeyTo("lagos/ikeja", "bus")).toBeNull();
    const st = store.getState();
    expect(st.game.at).toBe("lagos/ikeja");
    expect(st.journey?.seconds).toBeGreaterThan(0);
    expect(st.journey!.seconds).toBeLessThanOrEqual(30);
    expect(st.world).toBeNull();
  });

  it("refuses a made-up LGA", () => {
    const store = createGameStore({ storage: memoryStorage(), realNow: () => NOW });
    expect(store.getState().createCitizen({ name: "A", look: { g: "m", skin: "#8D5524", cloth: "#F4F1EA" }, stateCode: "kano", lgaCode: "lagos/ikeja" })).toBe(
      "Pick a real state and one of its LGAs",
    );
  });
});
