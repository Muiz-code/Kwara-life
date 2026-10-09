// Playing together on the server (docs/DECISIONS.md, "Playing together"): presence at a place, switches, invites
// checked with the game's own rules (src/sim/together.ts inviteProblem), answers, reactions, blocks and reports.
// Players are known to each other by their citizen's id and game name only. Pure apart from the database.
import { LGA } from "../data/geography";
import { EMOTES, INVITE_LIMITS, TOGETHER_BY_ID, type EmoteId, type TogetherId } from "../data/together";
import { inviteProblem, type Invite, type Player } from "../sim/together";
import type { Reply } from "./game";

/** A player's row: who they are, where they were last seen, their switches. */
export interface TogetherRow {
  user_id: string;
  citizen_id: string;
  nickname: string;
  look: Player["look"];
  lga_code: string;
  place_id: string;
  place_kind: string;
  busy: boolean;
  open_invites: boolean;
  open_dates: boolean;
  /** Real ms. */
  seen_at: number;
}

export interface InviteRow {
  id: string;
  from_user: string;
  to_user: string;
  activity: TogetherId;
  place_id: string;
  /** Real ms. */
  sent_at: number;
  answered_at: number | null;
  accepted: boolean | null;
}

export interface TogetherDb {
  /** I am at this place (creates my row from my citizen the first time). */
  hereNow(user: string, lga: string, place: string, kind: string, busy: boolean): Promise<void>;
  me(user: string): Promise<TogetherRow | null>;
  byCitizen(citizenId: string): Promise<TogetherRow | null>;
  /** Everyone seen at a place since a moment. */
  at(lga: string, place: string, since: number): Promise<TogetherRow[]>;
  /** Users I blocked, and users who blocked me. */
  blocks(user: string): Promise<Set<string>>;
  setSwitches(user: string, openInvites: boolean, openDates: boolean): Promise<void>;
  /** Invites I sent since a moment, all of them (answered or not). */
  sentSince(user: string, since: number): Promise<InviteRow[]>;
  /** The money in my save, to check I can pay for both. */
  money(user: string): Promise<number>;
  addInvite(inv: Omit<InviteRow, "id" | "answered_at" | "accepted">): Promise<InviteRow>;
  /** Invites to me, not answered, sent since a moment. */
  waitingFor(user: string, since: number): Promise<InviteRow[]>;
  /** Answers to my invites that haven't reached me yet; marks them delivered. */
  takeAnswers(user: string): Promise<InviteRow[]>;
  invite(id: string): Promise<InviteRow | null>;
  answer(id: string, accepted: boolean): Promise<boolean>;
  reactions(lga: string, place: string, since: number): Promise<{ id: number; from_user: string; nickname: string; emote: EmoteId; at: number }[]>;
  lastReaction(user: string): Promise<number | null>;
  react(user: string, nickname: string, lga: string, place: string, emote: EmoteId): Promise<void>;
  block(user: string, other: string): Promise<void>;
  report(user: string, other: string, reason: string): Promise<void>;
}

/** Someone seen at a place this recently is still there (the game checks in every 30 seconds while looking). */
export const HERE_FOR_MS = 75_000;
/** Reactions show for this long. */
export const REACTION_FOR_MS = 40_000;
export const REPORT_REASONS = ["Following me around", "Too many invites", "Offensive nickname", "Something else not right"];

const ok = (body: Record<string, unknown>): Reply => ({ status: 200, body });
const no = (status: number, error: string): Reply => ({ status, body: { error } });
const PLACE = /^[a-z0-9_-]{1,60}$/i;
const ID = /^[0-9a-f-]{36}$/i;
const obj = (b: unknown) => (typeof b === "object" && b ? (b as Record<string, unknown>) : {});
/** The hour in Nigeria now. */
const watHour = (now: number) => new Date(now + 3600_000).getUTCHours();

/** A row as other players see it. */
const asPlayer = (r: TogetherRow): Player => ({
  id: r.citizen_id, nickname: r.nickname, look: r.look, lgaCode: r.lga_code, placeId: r.place_id,
  openInvites: r.open_invites, openDates: r.open_dates, busy: r.busy,
});

/** I am here (and maybe busy). */
export async function presence(db: TogetherDb, user: string, body: unknown): Promise<Reply> {
  const b = obj(body);
  const lga = typeof b.lgaCode === "string" ? b.lgaCode : "";
  const place = typeof b.placeId === "string" ? b.placeId : "";
  const kind = typeof b.placeKind === "string" && PLACE.test(b.placeKind) ? b.placeKind : "";
  if (!LGA[lga] || !PLACE.test(place)) return no(400, "Where are you?");
  await db.hereNow(user, lga, place, kind, b.busy === true);
  return ok({ ok: true });
}

/** Who else is at my place: not me, not anyone blocked either way, nicknames only. */
export async function here(db: TogetherDb, user: string, now: number): Promise<Reply> {
  const me = await db.me(user);
  if (!me || !me.place_id) return ok({ players: [] });
  const [rows, blocked] = await Promise.all([db.at(me.lga_code, me.place_id, now - HERE_FOR_MS), db.blocks(user)]);
  return ok({ players: rows.filter((r) => r.user_id !== user && !blocked.has(r.user_id)).map(asPlayer) });
}

export async function settings(db: TogetherDb, user: string, body: unknown): Promise<Reply> {
  const b = obj(body);
  if (typeof b.openInvites !== "boolean" || typeof b.openDates !== "boolean") return no(400, "Pick on or off");
  // Switched on before the game has said where you are: start your row, nowhere yet.
  if (!(await db.me(user))) await db.hereNow(user, "", "", "", false);
  await db.setSwitches(user, b.openInvites, b.openDates && b.openInvites);
  return ok({ ok: true });
}

/** Invite someone here: the game's own checks, with counts from the server, and the host must be able to pay. */
export async function invite(db: TogetherDb, user: string, body: unknown, now: number): Promise<Reply> {
  const b = obj(body);
  const activity = b.activity as TogetherId;
  if (typeof b.to !== "string" || !ID.test(b.to) || !Object.hasOwn(TOGETHER_BY_ID, activity)) return no(400, "Pick someone and something to do");
  const [me, them] = await Promise.all([db.me(user), db.byCitizen(b.to)]);
  if (!me) return no(404, "Open the game first");
  if (!them || now - them.seen_at > HERE_FOR_MS) return no(400, "They are not here any more");
  const [blocked, sent] = await Promise.all([db.blocks(user), db.sentSince(user, now - 24 * 3600_000)]);
  const toThem = sent.filter((i) => i.to_user === them.user_id);
  const today = new Date(now + 3600_000).toISOString().slice(0, 10);
  const why = inviteProblem({
    me: { id: me.citizen_id, openDates: me.open_dates },
    them: { ...asPlayer(them), id: them.citizen_id },
    activity,
    placeId: me.place_id,
    placeKind: me.place_kind,
    hour: watHour(now),
    blocked: new Set([...blocked].map((u) => (u === them.user_id ? them.citizen_id : u))),
    sentLastHour: sent.filter((i) => now - i.sent_at < 3600_000).length,
    declinesToday: toThem.filter((i) => i.accepted === false && new Date((i.answered_at ?? 0) + 3600_000).toISOString().slice(0, 10) === today).length,
    pending: toThem.some((i) => i.answered_at === null && now - i.sent_at <= INVITE_LIMITS.expireS * 1000),
  });
  if (why) return no(400, why);
  const cost = TOGETHER_BY_ID[activity].cost;
  if (cost && (await db.money(user)) < cost) return no(400, "You don't have enough money to pay for both of you");
  const row = await db.addInvite({ from_user: user, to_user: them.user_id, activity, place_id: me.place_id, sent_at: now });
  const out: Invite = { id: row.id, from: { id: me.citizen_id, nickname: me.nickname }, to: them.citizen_id, activity, placeId: me.place_id, sentAt: now };
  return ok({ invite: out });
}

/** What has come in: invites waiting for me, answers to mine, and reactions at my place. */
export async function inbox(db: TogetherDb, user: string, now: number): Promise<Reply> {
  const me = await db.me(user);
  if (!me) return ok({ invites: [], answers: [], reactions: [] });
  const [waiting, answers, blocked, reacts] = await Promise.all([
    db.waitingFor(user, now - INVITE_LIMITS.expireS * 1000),
    db.takeAnswers(user),
    db.blocks(user),
    me.place_id ? db.reactions(me.lga_code, me.place_id, now - REACTION_FOR_MS) : Promise.resolve([]),
  ]);
  const invites: Invite[] = [];
  for (const i of waiting) {
    if (blocked.has(i.from_user)) continue;
    const from = await db.me(i.from_user);
    if (from) invites.push({ id: i.id, from: { id: from.citizen_id, nickname: from.nickname }, to: me.citizen_id, activity: i.activity, placeId: i.place_id, sentAt: i.sent_at });
  }
  return ok({
    invites,
    answers: answers.map((a) => ({ inviteId: a.id, accepted: a.accepted === true })),
    reactions: reacts.filter((r) => r.from_user !== user && !blocked.has(r.from_user)).map((r) => ({ id: `r${r.id}`, from: r.nickname, emote: r.emote, at: r.at })),
  });
}

/** Accept or say Not today, while the invite is still open. */
export async function answer(db: TogetherDb, user: string, body: unknown, now: number): Promise<Reply> {
  const b = obj(body);
  if (typeof b.inviteId !== "string" || !ID.test(b.inviteId) || typeof b.accept !== "boolean") return no(400, "Answer the invite");
  const inv = await db.invite(b.inviteId);
  if (!inv || inv.to_user !== user) return no(404, "That invite is gone");
  if (inv.answered_at !== null) return no(400, "You already answered");
  if (now - inv.sent_at > INVITE_LIMITS.expireS * 1000) return no(400, "That invite has lapsed");
  return (await db.answer(inv.id, b.accept)) ? ok({ ok: true }) : no(400, "You already answered");
}

/** A quick reaction to everyone at my place, at most one every few seconds. */
export async function emote(db: TogetherDb, user: string, body: unknown, now: number): Promise<Reply> {
  const e = obj(body).emote as EmoteId;
  if (!EMOTES.some((x) => x.id === e)) return no(400, "Pick a reaction");
  const me = await db.me(user);
  if (!me || !me.place_id) return no(400, "Where are you?");
  const last = await db.lastReaction(user);
  if (last !== null && now - last < INVITE_LIMITS.emoteGapS * 1000) return no(429, "Slow down small");
  await db.react(user, me.nickname, me.lga_code, me.place_id, e);
  return ok({ ok: true });
}

export async function block(db: TogetherDb, user: string, body: unknown): Promise<Reply> {
  const p = obj(body).player;
  if (typeof p !== "string" || !ID.test(p)) return no(400, "Pick a player");
  const them = await db.byCitizen(p);
  if (!them || them.user_id === user) return no(404, "Player not found");
  await db.block(user, them.user_id);
  return ok({ ok: true });
}

export async function report(db: TogetherDb, user: string, body: unknown): Promise<Reply> {
  const b = obj(body);
  if (typeof b.player !== "string" || !ID.test(b.player) || typeof b.reason !== "string" || !REPORT_REASONS.includes(b.reason)) return no(400, "Pick a reason");
  const them = await db.byCitizen(b.player);
  if (!them || them.user_id === user) return no(404, "Player not found");
  await db.report(user, them.user_id, b.reason);
  return ok({ ok: true });
}
