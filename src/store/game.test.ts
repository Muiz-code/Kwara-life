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

  it("lets you walk into a place on foot, with the walk's time and tiredness", () => {
    const { store } = started();
    const before = store.getState().game;
    const dest = before.loc === "taiwo" ? "palace" : "taiwo";
    expect(store.getState().arrive(dest)).toBeNull();
    const after = store.getState().game;
    expect(after.loc).toBe(dest);
    expect(store.getState().selected).toBe(dest);
    expect(after.t).toBeGreaterThan(before.t);
    expect(after.needs.energy).toBeLessThan(before.needs.energy);
    expect(after.money).toBe(before.money);
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

  it("drops a save that was edited outside the game", async () => {
    const { store, storage } = started();
    store.getState().travel("item7", "keke", 0);
    store.getState().progress(60_000);
    const saved = storage.data.get(SAVE_KEY)!;
    // The classic DevTools cheat: give yourself money.
    storage.data.set(SAVE_KEY, saved.replace(/"money":\d+/, '"money":999999999'));
    const again = createGameStore({ rng: sequence(0.99), storage });
    await again.persist.rehydrate();
    expect(again.getState().game.money).toBe(20000);
    expect(again.getState().game.char).toBeNull();
    // Stripping the signature doesn't help either.
    storage.data.set(SAVE_KEY, saved.slice(saved.indexOf(".") + 1).replace(/"money":\d+/, '"money":999999999'));
    const third = createGameStore({ rng: sequence(0.99), storage });
    await third.persist.rehydrate();
    expect(third.getState().game.char).toBeNull();
  });
});

describe("citizens across Nigeria", () => {
  const NOW = Date.parse("2026-10-15T10:00:00+01:00");
  function made(lgaCode = "kano/fagge", stateCode = "kano") {
    const store = createGameStore({ rng: sequence(0.4), storage: memoryStorage(), realNow: () => NOW });
    expect(store.getState().createCitizen({ name: "Hauwa", look: { g: "h", skin: "#6B3E26", cloth: "#2F7D7A" }, stateCode, lgaCode })).toBeNull();
    return store;
  }

  it("runs a side hustle from the phone, and keeps online gigs for smartphones", () => {
    const store = made();
    const st = store.getState();
    store.setState({ game: { ...st.game, phone: "kpakpa", needs: { food: 90, energy: 90, fun: 90, social: 90, hygiene: 90 } } });
    expect(store.getState().doHustle("h-design", 0)).toBe("You need a smartphone for this gig");
    const before = store.getState().game.money;
    expect(store.getState().doHustle("h-data", 0)).toBeNull();
    store.getState().progress(1e9);
    expect(store.getState().game.money).toBe(before + 2500);
  });

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
