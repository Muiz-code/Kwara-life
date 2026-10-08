import { describe, expect, it } from "vitest";
import type { StateStorage } from "zustand/middleware";
import { airportTown, sequence } from "../sim";
import { createGameStore } from "./game";

function memoryStorage(): StateStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

const NOW = Date.parse("2026-10-15T10:00:00+01:00");

/** A citizen of Ilorin West standing at the airport, of the given class. */
function atIlorinAirport(cls: "poor" | "middle" | "rich") {
  const store = createGameStore({ rng: sequence(0.4), storage: memoryStorage(), realNow: () => NOW });
  expect(store.getState().createCitizen({ name: "Bisi", look: { g: "f", skin: "#6B3E26", cloth: "#2F7D7A" }, stateCode: "kwara", lgaCode: "kwara/ilorin-west" })).toBeNull();
  const g = store.getState().game;
  store.setState({ game: { ...g, citizen: { ...g.citizen!, cls }, money: 2_000_000, loc: "airport", inside: false } });
  return store;
}

describe("Fly to Lagos", () => {
  it("is a real flight: you land at Lagos's airport town and pay the real fare", () => {
    const store = atIlorinAirport("middle");
    store.getState().doAction("fly", 0);
    const s = store.getState();
    expect(s.game.at).toBe(airportTown("lagos"));
    expect(s.game.loc).toBe("airport");
    expect(s.game.money).toBeLessThan(2_000_000);
    expect(s.journey?.to).toBe(airportTown("lagos"));
    expect(s.game.goals.fly).toBe(true);
  });

  it("is refused, with the reason, when you can't fly", () => {
    const store = atIlorinAirport("poor");
    store.getState().doAction("fly", 0);
    expect(store.getState().game.at).toBeNull();
    expect(store.getState().toasts.at(-1)).toBe("Flights are out of your budget");
  });
});
