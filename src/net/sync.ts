"use client";
// Keeps the game on this phone and the copy on the server in step (Phase E1).
// - On sign-in: load the server's save if it is newer (played on another phone), or hand the server a save
//   made here before it existed (once).
// - While playing: upload every few minutes if anything changed (or just check in), and when the app is hidden
//   or closed. Not every second: a million players saving that often would be billions of calls a month.
// - One device at a time: another device holding the account turns this one away ("blocked") until the player
//   logs out there. Logging out here uploads the game and frees the account at once.
// - Without a connection the game keeps playing here and catches up on the next upload.
// A build without Supabase settings never calls any of this (the game plays offline).
import { useSyncExternalStore } from "react";
import type { RollInput } from "../sim/roll";
import type { GameStoreApi } from "../store/game";
import { supabase } from "./supabase";

/** How often a changed game is uploaded (or the device checks in) while playing. */
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

/** This browser's own id, so the server can tell one device from another. Kept for good. */
let memoryDevice = "";
function deviceId(): string {
  const make = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`.replace(".", "")).replace(/[^A-Za-z0-9_-]/g, "");
  try {
    let id = localStorage.getItem("nv-device");
    if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) localStorage.setItem("nv-device", (id = make()));
    return id;
  } catch {
    return (memoryDevice ||= make());
  }
}

// ---- Turned away because another device is playing ----
let blocked: string | null = null;
const listeners = new Set<() => void>();
function setBlocked(msg: string | null) {
  blocked = msg;
  for (const l of listeners) l();
}
/** The message when another device is playing this account, or null. */
export function useBlocked(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => blocked,
    () => null,
  );
}

/** A call to the game server as the signed-in player: the status and the JSON body (status 0: no connection). */
async function api(path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const sb = supabase();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  if (!token) return { status: 401, body: {} };
  try {
    const res = await fetch(path, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 423) setBlocked(typeof body.error === "string" ? body.error : "You are playing on another device");
    return { status: res.status, body };
  } catch {
    return { status: 0, body: {} };
  }
}
const post = (path: string, body: object, keepalive = false) => {
  const text = JSON.stringify({ ...body, device: deviceId() });
  return api(path, { method: "POST", body: text, keepalive: keepalive && text.length < KEEPALIVE_MAX });
};

/** The game as it is saved (no toasts). */
const saveOf = (store: GameStoreApi) => ({ ...store.getState().game, toasts: [] });

/** Take the server's copy of the game. */
function take(store: GameStoreApi, user: string, body: Record<string, unknown>) {
  if (typeof body.version === "number" && store.getState().loadSave(body.game)) setVersion(user, body.version);
}

let dirty = false;
let pushing = false;

/** Upload the game if it changed, or just check in. keepalive: the page is closing, so the request must outlive it. */
async function push(keepalive = false) {
  const c = current;
  if (!c || pushing || blocked) return;
  const version = savedVersion(c.user);
  if (!dirty || !version || !c.store.getState().game.citizen) {
    // Nothing new to save: still check in, so this device keeps the account while it plays.
    if (!keepalive && document.visibilityState === "visible") await post("/api/game/device", {});
    return;
  }
  const text = JSON.stringify({ game: saveOf(c.store), version, device: deviceId() });
  pushing = true;
  dirty = false;
  const r = await api("/api/game", { method: "PUT", body: text, keepalive: keepalive && text.length < KEEPALIVE_MAX });
  pushing = false;
  if (current !== c) return;
  if (r.status === 200 && typeof r.body.version === "number") setVersion(c.user, r.body.version);
  // Played on another phone since: theirs is the life that counts now.
  else if (r.status === 409) take(c.store, c.user, r.body);
  // No connection or the server is busy: try again on the next round.
  else if (r.status !== 423) dirty = true;
}

/** Load (or hand over) the game when this device starts playing the account. */
async function begin(c: { user: string; store: GameStoreApi }): Promise<void> {
  const r = await api(`/api/game?device=${encodeURIComponent(deviceId())}`);
  if (current !== c || r.status !== 200) return;
  setBlocked(null);
  const local = c.store.getState().game;
  if (r.body.game) {
    // The server's copy is newer than the one this phone last saw: another phone played since.
    if (r.body.version !== savedVersion(c.user) || !local.citizen) take(c.store, c.user, r.body);
  } else if (local.citizen) {
    // A life made here before the server existed: hand it over once.
    const a = await post("/api/game/citizen", { adopt: saveOf(c.store) });
    if (current === c && a.status === 200) take(c.store, c.user, a.body);
  }
}

/** Start keeping this account's game in step with the server. Returns a stop function. */
export function startSync(store: GameStoreApi, user: string): () => void {
  const c = { user, store };
  current = c;
  setBlocked(null);
  // Whatever was played here since the last upload goes up on the first round.
  dirty = !!store.getState().game.citizen;
  const unsub = store.subscribe((s, prev) => {
    if (s.game !== prev.game) dirty = true;
  });
  void begin(c);
  const every = setInterval(() => void push(), UPLOAD_EVERY_MS);
  const hidden = () => document.visibilityState === "hidden" && void push(true);
  const leaving = () => void push(true);
  document.addEventListener("visibilitychange", hidden);
  window.addEventListener("pagehide", leaving);
  return () => {
    void push(true);
    unsub();
    clearInterval(every);
    document.removeEventListener("visibilitychange", hidden);
    window.removeEventListener("pagehide", leaving);
    if (current === c) current = null;
  };
}

/** Try again after logging out on the other device. */
export function retryHere() {
  if (current) void begin(current);
}

/** True when this game is kept on the server (signed in, with Supabase in this build). */
export const syncing = () => current !== null;

/** Log out: upload the game, free the account for another device, then end the session. */
export async function signOutHere() {
  if (current && !blocked) {
    await push();
    await post("/api/game/device", { release: true });
  }
  await supabase()?.auth.signOut();
}

/** Roll a new citizen on the server. Null when done, or a reason to show the player. */
export async function createCitizenOnline(input: RollInput): Promise<string | null> {
  const c = current;
  if (!c) return "Sign in again";
  const r = await post("/api/game/citizen", { input });
  if (r.status === 0) return "No connection. Check your data and try again";
  if (r.status !== 200) return typeof r.body.error === "string" ? r.body.error : "Try again in a moment";
  take(c.store, c.user, r.body);
  return null;
}
