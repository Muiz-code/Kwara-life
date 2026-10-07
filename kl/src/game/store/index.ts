"use client";

import { useStore } from "zustand";
import { createGameStore, type GameStore, type GameStoreApi } from "./game";

export * from "./game";
export { startGameLoop } from "./loop";

let store: GameStoreApi | null = null;

/** The one game store for the browser. */
export function getGameStore(): GameStoreApi {
  if (!store) {
    store = createGameStore();
    // Open the game with ?debug to poke the store from the browser console (window.kwara).
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { kwara: GameStoreApi }).kwara = store;
    }
  }
  return store;
}

export function useGame<T>(selector: (s: GameStore) => T): T {
  return useStore(getGameStore(), selector);
}
