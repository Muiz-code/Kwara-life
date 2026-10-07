"use client";

import { useStore } from "zustand";
import { createGameStore, type GameStore, type GameStoreApi } from "./game";

export * from "./game";
export { startGameLoop } from "./loop";

let store: GameStoreApi | null = null;

/** The one game store for the browser. */
export function getGameStore(): GameStoreApi {
  return (store ??= createGameStore());
}

export function useGame<T>(selector: (s: GameStore) => T): T {
  return useStore(getGameStore(), selector);
}
