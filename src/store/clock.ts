// Real time for the game. The election calendar runs on it, so it must not follow the device clock:
// a player could set their phone to election day and vote early. Instead the time comes from the
// server once (/api/time) and then moves on with performance.now(), which the player can't set.
//
// Testers can jump it forward with ?debug (see the menu), but only in dev builds or builds made with
// NEXT_PUBLIC_ALLOW_DEBUG=1. A production build ignores ?debug entirely.

/** Debug tools are compiled in. Next inlines both values at build time. */
export const DEBUG_ALLOWED = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ALLOW_DEBUG === "1";

/** Server time minus performance.now() at the moment we synced. Until then, the device clock. */
let base = typeof performance !== "undefined" ? Date.now() - performance.now() : 0;
let offsetMs = 0;
let synced = false;

const monotonic = () => (typeof performance !== "undefined" ? base + performance.now() : Date.now());

export const clockNow = () => monotonic() + offsetMs;

/** True once the clock has been set from the server. */
export const clockSynced = () => synced;

/** Fetch the server's time once and run the game clock from it. Safe to call more than once. */
export async function syncClock(url = "/api/time"): Promise<boolean> {
  if (typeof performance === "undefined" || typeof fetch === "undefined") return false;
  try {
    const sent = performance.now();
    const res = await fetch(url, { cache: "no-store" });
    const { now } = (await res.json()) as { now: unknown };
    const got = performance.now();
    if (typeof now !== "number" || !Number.isFinite(now)) return false;
    // The server read its clock roughly halfway through the round trip.
    base = now + (got - sent) / 2 - got;
    synced = true;
    return true;
  } catch {
    return false;
  }
}

/** Debug only: make the game believe it is this moment, or null for the real time. A no-op in production. */
export function jumpClockTo(at: number | null) {
  if (!debugMode()) return;
  offsetMs = at === null ? 0 : at - monotonic();
}

export const clockJumped = () => offsetMs !== 0;

export const debugMode = () =>
  DEBUG_ALLOWED && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");
