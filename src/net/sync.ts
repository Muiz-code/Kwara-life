"use client";
// Keeps the game on this phone and the copy on the server in step (Phase E1).
// - On sign-in: load the server's save if it is newer (played on another phone), or hand the server a save
//   made here before it existed (once).
// - While playing: upload every few minutes if anything changed, and when the app is hidden or closed.
//   Not every second: a million players saving that often would be billions of calls a month.
// - Without a connection the game keeps playing here and catches up on the next upload.
// A build without Supabase settings never calls any of this (the game plays offline).
import type { RollInput } from "../sim/roll";
import type { GameStoreApi } from "../store/game";
import { supabase } from "./supabase";

/** How often a changed game is uploaded while playing. */
export const UPLOAD_EVERY_MS = 3 * 60_000;
/** Browsers only keep a request alive past page close up to 64 KB. */
const KEEPALIVE_MAX = 60_000;

let current: { user: string; store: GameStoreApi } | null = null;

const versionKey = (user: string) => `nv-sync-v1:${user}`;
function savedVersion(user: string): number {
  try {
    return Number(localStorage.getItem(versionKey(user))) || 0;
  } catch {
    return 0;
  }
}
function setVersion(user: string, v: number) {
  try {
    localStorage.setItem(versionKey(user), String(v));
  } catch {
    // Storage blocked: the next upload will meet a 409 and load the server's copy, which is fine.
  }
}

/** A call to the game server as the signed-in player: the status and the JSON body (empty on no connection). */
async function api(path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const sb = supabase();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  if (!token) return { status: 401, body: {} };
  try {
    const res = await fetch(path, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { status: 0, body: {} };
  }
}

/** The game as it is saved (no toasts). */
const saveOf = (store: GameStoreApi) => ({ ...store.getState().game, toasts: [] });

/** Take the server's copy of the game. */
function take(store: GameStoreApi, user: string, body: Record<string, unknown>) {
  if (typeof body.version === "number" && store.getState().loadSave(body.game)) setVersion(user, body.version);
}

let dirty = false;
let pushing = false;

/** Upload the game if it changed. keepalive: the page is closing, so the request must outlive it. */
async function push(keepalive = false) {
  const c = current;
  if (!c || !dirty || pushing || !c.store.getState().game.citizen) return;
  const version = savedVersion(c.user);
  if (!version) return;
  const text = JSON.stringify({ game: saveOf(c.store), version });
  pushing = true;
  dirty = false;
  const r = await api("/api/game", { method: "PUT", body: text, keepalive: keepalive && text.length < KEEPALIVE_MAX });
  pushing = false;
  if (current !== c) return;
  if (r.status === 200 && typeof r.body.version === "number") setVersion(c.user, r.body.version);
  // Played on another phone since: theirs is the life that counts now.
  else if (r.status === 409) take(c.store, c.user, r.body);
  // No connection or the server is busy: try again on the next round.
  else dirty = true;
}

/** Start keeping this account's game in step with the server. Returns a stop function. */
export function startSync(store: GameStoreApi, user: string): () => void {
  current = { user, store };
  // Whatever was played here since the last upload goes up on the first round.
  dirty = !!store.getState().game.citizen;
  let alive = true;
  const unsub = store.subscribe((s, prev) => {
    if (s.game !== prev.game) dirty = true;
  });
  void (async () => {
    const r = await api("/api/game");
    if (!alive || r.status !== 200) return;
    const local = store.getState().game;
    if (r.body.game) {
      // The server's copy is newer than the one this phone last saw: another phone played since.
      if (r.body.version !== savedVersion(user) || !local.citizen) take(store, user, r.body);
    } else if (local.citizen) {
      // A life made here before the server existed: hand it over once.
      const a = await api("/api/game/citizen", { method: "POST", body: JSON.stringify({ adopt: saveOf(store) }) });
      if (alive && a.status === 200) take(store, user, a.body);
    }
  })();
  const every = setInterval(() => void push(), UPLOAD_EVERY_MS);
  const hidden = () => document.visibilityState === "hidden" && void push(true);
  const leaving = () => void push(true);
  document.addEventListener("visibilitychange", hidden);
  window.addEventListener("pagehide", leaving);
  return () => {
    alive = false;
    void push(true);
    unsub();
    clearInterval(every);
    document.removeEventListener("visibilitychange", hidden);
    window.removeEventListener("pagehide", leaving);
    if (current?.user === user) current = null;
  };
}

/** True when this game is kept on the server (signed in, with Supabase in this build). */
export const syncing = () => current !== null;

/** Roll a new citizen on the server. Null when done, or a reason to show the player. */
export async function createCitizenOnline(input: RollInput): Promise<string | null> {
  const c = current;
  if (!c) return "Sign in again";
  const r = await api("/api/game/citizen", { method: "POST", body: JSON.stringify({ input }) });
  if (r.status === 0) return "No connection. Check your data and try again";
  if (r.status !== 200) return typeof r.body.error === "string" ? r.body.error : "Try again in a moment";
  take(c.store, c.user, r.body);
  return null;
}
