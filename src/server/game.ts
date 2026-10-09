// The server's side of a player's game (Phase E1): roll a new citizen, take over a save made before the
// server existed, and store saves. Nothing a browser sends is trusted: every save goes through the game's
// own checks (sanitizeGame), and who the citizen is (name, state, LGA, polling unit) can never change.
// One device plays an account at a time: the others are told to log out there first.
// The PVC and votes are the server's (Phase E2): a save can only move the PVC along the real steps, and only the
// voter roll can say someone voted.
// Pure apart from the database, which is passed in, so the rules are tested without one.
import { LGA, POLLING_UNITS_PER_LGA } from "../data/geography";
import { STATE } from "../data/states";
import { sanitizeGame } from "../sim/sanitize";
import { startLife } from "../sim/start";
import { freshState, type GameState } from "../sim/state";
import type { Rng } from "../sim/rng";
import type { PvcStatus, RollInput } from "../sim/roll";
import { PRESIDENTIAL_2027, type ElectionCalendar } from "../data/calendar";
import { PARTY } from "../data/parties";
import { VOTE_REASON, reachPvc, type VoteAnswer } from "./civic";
import { playedOn } from "../sim/daily";
import { watDate } from "../sim/civic";

export interface CitizenRow {
  name: string;
  state_code: string;
  lga_code: string;
  pu_code: string;
  zone: string;
  /** The PVC status that counts (citizens.pvc). */
  pvc?: PvcStatus;
  /** The last real day (WAT) counted as a play, and whether they agreed to be named in the credits. */
  last_play?: string | null;
  credits_ok?: boolean;
}

export interface GameDb {
  /** The account's citizen and save, or null if it has none yet. */
  load(user: string): Promise<{ citizen: CitizenRow; game: unknown; version: number; voted: string[] } | null>;
  /** A new citizen and their first save; if the account already has one, that one comes back instead. */
  create(user: string, citizen: CitizenRow, game: GameState): Promise<{ created: boolean; game: unknown; version: number }>;
  /** Store a save made from `version`; the new version, or null if another save came in between. */
  save(user: string, game: GameState, version: number): Promise<number | null>;
  /** Take or keep the account for this device; false when another device has it and checked in recently. */
  claim(user: string, device: string, staleMinutes: number): Promise<boolean>;
  /** Free the account (logging out on this device). */
  release(user: string, device: string): Promise<void>;
  /** Move the PVC status, only if it is still at the status given as from. */
  setPvc(user: string, from: PvcStatus, to: PvcStatus): Promise<void>;
  /** Cast a vote (cast_vote): THAT they voted on the roll, one more for their unit and party in the count. */
  castVote(user: string, election: string, party: string, opens: string, closes: string): Promise<VoteAnswer>;
  /** Votes cast so far in an election. */
  turnout(election: string): Promise<number>;
  /** One more play for this real day, at most once a day. */
  notePlay(user: string, day: string): Promise<void>;
  /** Agree (or stop agreeing) to be named in the closing credits. */
  setCredits(user: string, ok: boolean): Promise<void>;
  /** The most-played citizens who agreed to be named. */
  topPlayers(limit: number): Promise<{ name: string; state_code: string; lga_code: string; plays: number }[]>;
}

/** What a route answers: an HTTP status and a body. */
export type Reply = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>): Reply => ({ status: 200, body });
const no = (status: number, error: string): Reply => ({ status, body: { error } });

/** A device that stops checking in loses the account after this long (the game checks in every 3 minutes). */
export const DEVICE_STALE_MINUTES = 10;
export const ON_ANOTHER_DEVICE = "You are already playing on another device. Log out there to continue here.";

const DEVICE = /^[A-Za-z0-9_-]{16,64}$/;
const deviceOf = (body: unknown) => {
  const d = typeof body === "object" && body ? (body as { device?: unknown }).device : undefined;
  return typeof d === "string" && DEVICE.test(d) ? d : null;
};

/** Null when this device may play the account (it now holds it), or the reply refusing it. */
async function holds(db: GameDb, user: string, body: unknown): Promise<Reply | null> {
  const device = deviceOf(body);
  if (!device) return no(400, "Reload the game");
  return (await db.claim(user, device, DEVICE_STALE_MINUTES)) ? null : { status: 423, body: { error: ON_ANOTHER_DEVICE, busy: true } };
}

/** A save without what lives only in this browser session (toasts). */
const stored = (g: GameState): GameState => ({ ...g, toasts: [] });

/** The database row for a game's citizen, or a reason it can't be one. */
function citizenRow(g: GameState): CitizenRow | string {
  const c = g.citizen;
  if (!c) return "Create your citizen first";
  const lga = LGA[c.lgaCode];
  if (!lga || lga.stateCode !== c.stateCode || !STATE[c.stateCode]) return "Pick a real state and one of its LGAs";
  const pu = Number(c.puCode.slice(c.lgaCode.length + 1));
  if (!c.puCode.startsWith(`${c.lgaCode}/`) || !Number.isInteger(pu) || pu < 1 || pu > POLLING_UNITS_PER_LGA) return "That polling unit doesn't exist";
  const name = c.name.trim();
  if (!name || name.length > 16) return "Enter your name";
  return { name, state_code: c.stateCode, lga_code: c.lgaCode, pu_code: c.puCode, zone: STATE[c.stateCode].zone };
}

/** The player's game as the server has it. */
export async function getGame(db: GameDb, user: string, device: string | null): Promise<Reply> {
  const busy = await holds(db, user, { device });
  if (busy) return busy;
  const row = await db.load(user);
  return ok(row ? { game: row.game, version: row.version } : { game: null });
}

/**
 * A new citizen. Either the server rolls one from the player's choices (`input`), or it takes over a save
 * the player made on this device before the server existed (`adopt`), once, after checking it.
 */
export async function newCitizen(db: GameDb, user: string, body: unknown, now: number, rng: Rng): Promise<Reply> {
  const b = (typeof body === "object" && body ? body : {}) as { input?: unknown; adopt?: unknown };
  const busy = await holds(db, user, body);
  if (busy) return busy;
  let game: GameState | null = null;
  if (b.input !== undefined) {
    const i = b.input as Partial<RollInput> | null;
    const look = i?.look as Partial<RollInput["look"]> | undefined;
    if (!i || typeof i.name !== "string" || typeof i.stateCode !== "string" || typeof i.lgaCode !== "string" || !look) return no(400, "Fill in every box");
    if (!["m", "f", "h"].includes(look.g as string) || typeof look.skin !== "string" || typeof look.cloth !== "string" || !/^#[0-9a-f]{6}$/i.test(look.skin) || !/^#[0-9a-f]{6}$/i.test(look.cloth))
      return no(400, "Pick how your citizen looks");
    try {
      game = startLife(freshState(), { name: i.name, stateCode: i.stateCode, lgaCode: i.lgaCode, look: { g: look.g, skin: look.skin, cloth: look.cloth } as RollInput["look"] }, now, rng);
    } catch (e) {
      return no(400, (e as Error).message);
    }
  } else if (b.adopt !== undefined) {
    game = sanitizeGame(b.adopt);
    if (!game) return no(400, "That save can't be loaded");
    // Votes only ever come from the server's own voter roll; the PVC only moves along the real steps from none.
    game.voted = [];
    if (game.citizen) game.citizen.pvc = reachPvc("none", game.citizen.pvc, game.citizen.createdAt, now);
  } else return no(400, "Nothing to create");
  const row = citizenRow(game);
  if (typeof row === "string") return no(400, row);
  const r = await db.create(user, row, stored(game));
  const pvc = game.citizen?.pvc ?? "none";
  if (r.created && pvc !== "none") await db.setPvc(user, "none", pvc);
  return ok({ game: r.game, version: r.version, created: r.created });
}

/** Store a save. Refused if it doesn't check out or changes who the citizen is; 409 if it is out of date. */
export async function putSave(db: GameDb, user: string, body: unknown, now = Date.now()): Promise<Reply> {
  const b = (typeof body === "object" && body ? body : {}) as { game?: unknown; version?: unknown };
  if (typeof b.version !== "number" || !Number.isInteger(b.version) || b.version < 1) return no(400, "Missing save version");
  const busy = await holds(db, user, body);
  if (busy) return busy;
  const game = sanitizeGame(b.game);
  if (!game) return no(400, "That save can't be loaded");
  const have = await db.load(user);
  if (!have) return no(404, "Create your citizen first");
  const row = citizenRow(game);
  if (typeof row === "string") return no(400, row);
  const c = have.citizen;
  if (row.name !== c.name || row.state_code !== c.state_code || row.lga_code !== c.lga_code || row.pu_code !== c.pu_code)
    return no(400, "Your citizen can't be changed");
  // Votes only ever come from the voter roll, and the PVC only moves along the real steps.
  const sent = { voted: [...game.voted].sort().join(), pvc: game.citizen!.pvc };
  game.voted = [...have.voted];
  const before = sanitizeGame(have.game);
  const had = c.pvc ?? "none";
  const pvc = reachPvc(had, game.citizen!.pvc, before?.citizen?.createdAt ?? game.citizen!.createdAt, now);
  game.citizen!.pvc = pvc;
  if (pvc !== had) await db.setPvc(user, had, pvc);
  const saved = stored(game);
  const version = await db.save(user, saved, b.version);
  if (version === null) return { status: 409, body: { error: "Your game was saved on another phone", game: have.game, version: have.version } };
  // A real day signed in with enough done counts as a play (once a day), and the credits choice is kept.
  const today = watDate(now);
  if (playedOn(game, today) && c.last_play !== today) await db.notePlay(user, today);
  const credits = game.flags.credits === true;
  if (credits !== (c.credits_ok ?? false)) await db.setCredits(user, credits);
  // The server changed something (a PVC step out of time, a vote that isn't on the roll): send its copy back.
  const changed = sent.pvc !== pvc || sent.voted !== [...game.voted].sort().join();
  return ok(changed ? { version, game: saved } : { version });
}

/** Check in while playing (keeps the account on this device), or free it when logging out. */
export async function device(db: GameDb, user: string, body: unknown): Promise<Reply> {
  const d = deviceOf(body);
  if (!d) return no(400, "Reload the game");
  if ((body as { release?: unknown }).release === true) {
    await db.release(user, d);
    return ok({ released: true });
  }
  return (await holds(db, user, body)) ?? ok({ ok: true });
}

/** Cast a vote on the server. The citizen must have collected their PVC and polls must be open. */
export async function vote(db: GameDb, user: string, body: unknown, cal: ElectionCalendar = PRESIDENTIAL_2027): Promise<Reply> {
  const busy = await holds(db, user, body);
  if (busy) return busy;
  const party = (body as { party?: unknown }).party;
  if (typeof party !== "string" || !Object.hasOwn(PARTY, party)) return no(400, "Choose one party");
  const answer = await db.castVote(user, cal.id, party, cal.pollsOpen, cal.pollsClose);
  const why = VOTE_REASON[answer];
  return why ? no(403, why) : ok({ voted: true, already: answer === "already" });
}

/** Votes cast so far: turnout only, never party standings. */
export async function turnout(db: GameDb, cal: ElectionCalendar = PRESIDENTIAL_2027): Promise<Reply> {
  return ok({ votes: await db.turnout(cal.id), at: new Date().toISOString() });
}

/** How many players the closing credits name. */
export const CREDITS_PLAYERS = 10;

/**
 * The season's closing credits, once polls have closed: the most-played citizens who agreed to be named (their game
 * name and LGA only). Brands come from the ads server once ads are paid for there; until then the list is empty.
 * Null before polls close: there is nothing to publish yet.
 */
export async function seasonCredits(db: GameDb, now: number, cal: ElectionCalendar = PRESIDENTIAL_2027) {
  if (now < Date.parse(cal.pollsClose)) return null;
  const top = await db.topPlayers(CREDITS_PLAYERS);
  return {
    brands: [] as string[],
    players: top.map((p) => ({ name: p.name, place: `${LGA[p.lga_code]?.name ?? ""}, ${STATE[p.state_code]?.name ?? ""}`, plays: p.plays })),
  };
}
