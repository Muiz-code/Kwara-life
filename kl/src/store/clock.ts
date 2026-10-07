// Real time for the game. Testers can jump it forward with ?debug (see the menu), so every
// civic date (registration, PVC, blackout, polls, results) can be tried without waiting.
// Without ?debug the offset is always zero.

let offsetMs = 0;

export const clockNow = () => Date.now() + offsetMs;

/** Debug only: make the game believe it is this moment. */
export function jumpClockTo(at: number) {
  offsetMs = at - Date.now();
}

export const clockJumped = () => offsetMs !== 0;

export const debugMode = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");
