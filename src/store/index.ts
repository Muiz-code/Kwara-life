"use client";

import { useStore } from "zustand";
import { debugMode } from "./clock";
import { createGameStore, SAVE_KEY, type GameStore, type GameStoreApi } from "./game";
import { seal, unseal } from "./seal";
import { setWorldClock } from "../sim/time";
import { clockNow } from "./clock";

export * from "./game";
export { startGameLoop } from "./loop";
export { clockJumped, clockNow, clockSynced, debugMode, jumpClockTo, syncClock } from "./clock";

let store: GameStoreApi | null = null;
/** The account whose game the store holds: null when playing offline (no Supabase in this build). */
let owner: string | null = null;

/** Each account keeps its own save on this device, so a new account starts a new life. */
export const saveKeyFor = (userId: string | null) => (userId ? `${SAVE_KEY}:${userId}` : SAVE_KEY);

/**
 * Saves made before accounts existed were one per device. The first account to sign in here takes that
 * life over, re-sealed under its own name (the seal covers the name), and the old save is removed so no
 * other account can pick it up.
 */
function adoptDeviceSave(userId: string) {
  try {
    const old = localStorage.getItem(SAVE_KEY);
    if (!old) return;
    const mine = saveKeyFor(userId);
    if (!localStorage.getItem(mine)) {
      const value = unseal(SAVE_KEY, old);
      if (value) localStorage.setItem(mine, seal(mine, value));
    }
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage blocked (private mode): nothing to adopt.
  }
}

function makeStore(userId: string | null): GameStoreApi {
  if (userId) adoptDeviceSave(userId);
  const s = createGameStore({ saveKey: saveKeyFor(userId) });
  // Time of day, the day and shop hours follow real Nigeria time for every player.
  setWorldClock(clockNow);
  // Open the game with ?debug to poke the store from the browser console (window.kwara).
  // Dev and test builds only: a production build never puts the store on the window.
  if (debugMode()) (window as unknown as { kwara: GameStoreApi }).kwara = s;
  return s;
}

/**
 * Point the game at the signed-in account's own save. Called by the sign-in gate before the game mounts;
 * switching accounts swaps in a fresh store, and the gate remounts the game so nothing of the last
 * player's life carries over.
 */
export function setAccount(userId: string | null) {
  if (store && owner === userId) return;
  owner = userId;
  store = makeStore(userId);
}

/** The game store for the signed-in account (or the offline player). */
export function getGameStore(): GameStoreApi {
  store ??= makeStore(owner);
  return store;
}

export function useGame<T>(selector: (s: GameStore) => T): T {
  return useStore(getGameStore(), selector);
}
