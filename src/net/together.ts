"use client";
// Playing together, on the client: who is at your place, your switches, invites in and out, blocks and the
// quick reactions. The server holds the truth (docs/DECISIONS.md, "Playing together"); in dev builds, until
// it is connected, a simulated town fills each place with players who answer invites and wave back, so the
// screens can be tried. Production never uses the simulation.
import { createStore, useStore } from "zustand";
import type { EmoteId, TogetherId } from "@/data/together";
import { INVITE_LIMITS } from "@/data/together";
import type { Invite, Player } from "@/sim/together";
import { activitiesAt, inviteExpired } from "@/sim/together";
import { DEBUG_ALLOWED } from "@/store/clock";
import { supabase } from "./supabase";

export interface Reaction {
  id: string;
  from: string;
  emote: EmoteId;
  at: number;
}

export interface TogetherState {
  openInvites: boolean;
  openDates: boolean;
  /** Other players at the same place. */
  here: Player[];
  /** Invites waiting for my answer. */
  inbox: Invite[];
  /** Invites I sent that have not been answered, by player id. */
  sent: Record<string, Invite>;
  /** When I sent each invite (real ms), for the hourly limit. */
  sentTimes: number[];
  /** "Not today" answers I got today, by player id. */
  declines: Record<string, number>;
  blocked: string[];
  reactions: Reaction[];
  /** Answers to my invites, waiting to be acted on. */
  answers: { invite: Invite; accepted: boolean; nickname: string }[];
  /** Invites whose activity this player has already done, so each is applied once. */
  applied: string[];
}

export const togetherStore = createStore<TogetherState>(() => ({
  openInvites: false,
  openDates: false,
  here: [],
  inbox: [],
  sent: {},
  sentTimes: [],
  declines: {},
  blocked: [],
  reactions: [],
  answers: [],
  applied: [],
}));

export const useTogether = <T,>(pick: (s: TogetherState) => T) => useStore(togetherStore, pick);

/** What the game needs from a server (or the simulation). */
export interface TogetherTransport {
  here(lgaCode: string, placeId: string, placeKind: string, me: { busy: boolean }): Promise<Player[]>;
  settings(s: { openInvites: boolean; openDates: boolean }): Promise<void>;
  invite(to: Player, activity: TogetherId, placeId: string): Promise<{ invite: Invite } | { error: string }>;
  inbox(): Promise<{ invites: Invite[]; answers: { inviteId: string; accepted: boolean }[]; reactions: Reaction[] }>;
  answer(inviteId: string, accept: boolean): Promise<string | null>;
  emote(emote: EmoteId, placeId: string): Promise<void>;
  block(playerId: string): Promise<void>;
  report(playerId: string, reason: ReportReason): Promise<void>;
}

/** Reports pick from a fixed list. There is no free text anywhere in playing together. */
export const REPORT_REASONS = ["Following me around", "Too many invites", "Offensive nickname", "Something else not right"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

// ---- The server ----

/** The signed-in player's token: every together call is made as them (src/app/api/together). */
const auth = async (): Promise<Record<string, string>> => {
  const token = (await supabase()?.auth.getSession())?.data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const get = async (path: string) => fetch(path, { headers: await auth() });

const post = async (path: string, body: unknown) => {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...(await auth()) }, body: JSON.stringify(body) });
  return r.ok ? r.json().catch(() => ({})) : { error: (await r.json().catch(() => ({})))?.error ?? "Try again" };
};

export const serverTransport: TogetherTransport = {
  async here(lgaCode, placeId, placeKind, me) {
    await post("/api/together/presence", { lgaCode, placeId, placeKind, busy: me.busy }).catch(() => {});
    const r = await get("/api/together/here").catch(() => null);
    return r?.ok ? ((await r.json()).players ?? []) : [];
  },
  async settings(s) {
    await post("/api/together/settings", s);
  },
  async invite(to, activity) {
    const r = await post("/api/together/invite", { to: to.id, activity });
    return r.invite ? { invite: r.invite } : { error: r.error ?? "Try again" };
  },
  async inbox() {
    const r = await get("/api/together/inbox").catch(() => null);
    const j = r?.ok ? await r.json() : {};
    return { invites: j.invites ?? [], answers: j.answers ?? [], reactions: j.reactions ?? [] };
  },
  async answer(inviteId, accept) {
    const r = await post("/api/together/answer", { inviteId, accept });
    return r.error ?? null;
  },
  async emote(emote, placeId) {
    await post("/api/together/emote", { emote, placeId });
  },
  async block(player) {
    await post("/api/together/block", { player });
  },
  async report(player, reason) {
    await post("/api/together/report", { player, reason });
  },
};

// ---- The simulated town (dev builds only) ----

const NICKS = ["Tolu_99", "BigAde", "Chiamaka", "Musa_K", "Ebuka", "Zainab", "Kemi_B", "Uche4real", "Halima", "Segun", "Ngozi", "DJ_Femi", "Amaka", "Sani", "Bisola", "Obinna"];
const SKINS = ["#4A2A18", "#6B3E26", "#8D5524", "#A86B3C"];
const CLOTHS = ["#8C2F5A", "#26355E", "#B5532E", "#2F7D7A", "#C9A227", "#3F6B3A", "#C0392B"];

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Who is at a place in the simulation: changes every ten minutes, the same for everyone in that window. */
function simulatedHere(lgaCode: string, placeId: string, now: number): Player[] {
  const window = Math.floor(now / 600_000);
  let h = hash(`${lgaCode}|${placeId}|${window}`);
  const r = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1000) / 1000;
  const n = 2 + Math.floor(r() * 4);
  const out: Player[] = [];
  for (let i = 0; i < n; i++) {
    const nickname = NICKS[Math.floor(r() * NICKS.length)];
    if (out.some((p) => p.nickname === nickname)) continue;
    out.push({
      id: `sim-${nickname}`,
      nickname,
      look: { g: r() < 0.5 ? "f" : "m", skin: SKINS[Math.floor(r() * SKINS.length)], cloth: CLOTHS[Math.floor(r() * CLOTHS.length)] },
      lgaCode,
      placeId,
      openInvites: r() < 0.8,
      openDates: r() < 0.5,
      busy: r() < 0.15,
    });
  }
  return out;
}

function simulatedTransport(): TogetherTransport {
  let last: { lga: string; place: string } = { lga: "", place: "" };
  const pending: { invites: Invite[]; answers: { inviteId: string; accepted: boolean }[]; reactions: Reaction[] } = { invites: [], answers: [], reactions: [] };
  let nextInviteAt = Date.now() + 45_000;
  return {
    async here(lga, place, kind) {
      last = { lga, place };
      const now = Date.now();
      const players = simulatedHere(lga, place, now);
      const s = togetherStore.getState();
      // Now and then someone here waves, or (if you are open to it) invites you.
      if (players.length && Math.random() < 0.25) {
        const p = players[Math.floor(Math.random() * players.length)];
        pending.reactions.push({ id: `r${now}`, from: p.nickname, emote: (["wave", "laugh", "clap", "dance", "respect"] as const)[Math.floor(Math.random() * 5)], at: now });
      }
      if (s.openInvites && now > nextInviteAt && players.length) {
        nextInviteAt = now + 60_000 + Math.random() * 60_000;
        const p = players.find((x) => !x.busy) ?? players[0];
        const choices = activitiesAt(kind).filter((t) => !t.date || s.openDates);
        const activity = choices.length ? choices[Math.floor(Math.random() * choices.length)].id : null;
        if (activity) pending.invites.push({ id: `in${now}`, from: { id: p.id, nickname: p.nickname }, to: "me", activity, placeId: place, sentAt: now });
      }
      return players;
    },
    async settings() {},
    async invite(to, activity, placeId) {
      const invite: Invite = { id: `out${Date.now()}`, from: { id: "me", nickname: "You" }, to: to.id, activity, placeId, sentAt: Date.now() };
      // They answer in a few seconds: most say yes.
      setTimeout(() => pending.answers.push({ inviteId: invite.id, accepted: Math.random() < 0.7 }), 2500 + Math.random() * 4000);
      return { invite };
    },
    async inbox() {
      const out = { invites: [...pending.invites], answers: [...pending.answers], reactions: [...pending.reactions] };
      pending.invites = [];
      pending.answers = [];
      pending.reactions = [];
      return out;
    },
    async answer() {
      return null;
    },
    async emote(emote, placeId) {
      // Someone here might wave back.
      if (placeId === last.place && Math.random() < 0.6) {
        const p = simulatedHere(last.lga, last.place, Date.now())[0];
        if (p) setTimeout(() => pending.reactions.push({ id: `r${Date.now()}`, from: p.nickname, emote, at: Date.now() }), 1500);
      }
    },
    async block() {},
    async report() {},
  };
}

/** Dev builds use the simulated town unless ?realpeople asks for the server. Production always uses the server. */
export const simulated = DEBUG_ALLOWED && typeof window !== "undefined" && !new URLSearchParams(window.location.search).has("realpeople");
export const transport: TogetherTransport = simulated ? simulatedTransport() : serverTransport;

/**
 * How often to keep up. The simulation can be quick; against the server this is only a slow fallback while
 * the People panel is open, until Supabase Realtime carries presence, invites and reactions.
 */
export const POLL_MS = simulated ? 5_000 : 30_000;

/** Mark an invite done here, once. False if it was already applied. */
export function markApplied(inviteId: string): boolean {
  const s = togetherStore.getState();
  if (s.applied.includes(inviteId)) return false;
  togetherStore.setState({ applied: [...s.applied.slice(-200), inviteId] });
  return true;
}

// ---- Actions the screens call ----

export async function setSwitches(s: { openInvites: boolean; openDates: boolean }) {
  togetherStore.setState(s);
  await transport.settings(s).catch(() => {});
}

export async function sendInvite(to: Player, activity: TogetherId, placeId: string): Promise<string | null> {
  const r = await transport.invite(to, activity, placeId);
  if ("error" in r) return r.error;
  const s = togetherStore.getState();
  togetherStore.setState({ sent: { ...s.sent, [to.id]: r.invite }, sentTimes: [...s.sentTimes, Date.now()] });
  return null;
}

export async function answerInvite(invite: Invite, accept: boolean): Promise<string | null> {
  const e = await transport.answer(invite.id, accept);
  togetherStore.setState({ inbox: togetherStore.getState().inbox.filter((i) => i.id !== invite.id) });
  return e;
}

export async function react(emote: EmoteId, placeId: string) {
  const s = togetherStore.getState();
  const now = Date.now();
  const mine = s.reactions.filter((r) => r.from === "You");
  if (mine.length && now - mine[mine.length - 1].at < INVITE_LIMITS.emoteGapS * 1000) return;
  togetherStore.setState({ reactions: [...s.reactions.slice(-20), { id: `me${now}`, from: "You", emote, at: now }] });
  await transport.emote(emote, placeId).catch(() => {});
}

export async function blockPlayer(p: Player) {
  const s = togetherStore.getState();
  togetherStore.setState({ blocked: [...s.blocked, p.id], here: s.here.filter((x) => x.id !== p.id) });
  await transport.block(p.id).catch(() => {});
}

export async function reportPlayer(p: Player, reason: ReportReason) {
  await transport.report(p.id, reason).catch(() => {});
}

/** One round of keeping up: who is here, what has come in. Called every few seconds while the game runs. */
export async function poll(lgaCode: string, placeId: string, placeKind: string, busy: boolean) {
  const [here, box] = await Promise.all([transport.here(lgaCode, placeId, placeKind, { busy }).catch(() => [] as Player[]), transport.inbox().catch(() => null)]);
  const s = togetherStore.getState();
  const now = Date.now();
  const blocked = new Set(s.blocked);
  const answers = [...s.answers];
  const sent = { ...s.sent };
  const declines = { ...s.declines };
  for (const a of box?.answers ?? []) {
    const who = Object.keys(sent).find((id) => sent[id].id === a.inviteId);
    if (!who) continue;
    const nickname = s.here.find((p) => p.id === who)?.nickname ?? here.find((p) => p.id === who)?.nickname ?? "They";
    answers.push({ invite: sent[who], accepted: a.accepted, nickname });
    if (!a.accepted) declines[who] = (declines[who] ?? 0) + 1;
    delete sent[who];
  }
  // Drop invites nobody answered in time, both ways.
  for (const id of Object.keys(sent)) if (inviteExpired(sent[id], now)) delete sent[id];
  const inbox = [...s.inbox, ...(box?.invites ?? []).filter((i) => !blocked.has(i.from.id))].filter((i) => !inviteExpired(i, now));
  togetherStore.setState({
    here: here.filter((p) => !blocked.has(p.id)),
    inbox,
    sent,
    declines,
    answers,
    sentTimes: s.sentTimes.filter((t) => now - t < 3_600_000),
    reactions: [...s.reactions, ...(box?.reactions ?? [])].filter((r) => now - r.at < 8000).slice(-20),
  });
}
