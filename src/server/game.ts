// The server's side of a player's game (Phase E1): roll a new citizen, take over a save made before the
// server existed, and store saves. Nothing a browser sends is trusted: every save goes through the game's
// own checks (sanitizeGame), and who the citizen is (name, state, LGA, polling unit) can never change.
// Pure apart from the database, which is passed in, so the rules are tested without one.
import { LGA, POLLING_UNITS_PER_LGA } from "../data/geography";
import { STATE } from "../data/states";
import { sanitizeGame } from "../sim/sanitize";
import { startLife } from "../sim/start";
import { freshState, type GameState } from "../sim/state";
import type { Rng } from "../sim/rng";
import type { RollInput } from "../sim/roll";

export interface CitizenRow {
  name: string;
  state_code: string;
  lga_code: string;
  pu_code: string;
  zone: string;
}

export interface GameDb {
  /** The account's citizen and save, or null if it has none yet. */
  load(user: string): Promise<{ citizen: CitizenRow; game: unknown; version: number } | null>;
  /** A new citizen and their first save; if the account already has one, that one comes back instead. */
  create(user: string, citizen: CitizenRow, game: GameState): Promise<{ created: boolean; game: unknown; version: number }>;
  /** Store a save made from `version`; the new version, or null if another save came in between. */
  save(user: string, game: GameState, version: number): Promise<number | null>;
}

/** What a route answers: an HTTP status and a body. */
export type Reply = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>): Reply => ({ status: 200, body });
const no = (status: number, error: string): Reply => ({ status, body: { error } });

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
export async function getGame(db: GameDb, user: string): Promise<Reply> {
  const row = await db.load(user);
  return ok(row ? { game: row.game, version: row.version } : { game: null });
}

/**
 * A new citizen. Either the server rolls one from the player's choices (`input`), or it takes over a save
 * the player made on this device before the server existed (`adopt`), once, after checking it.
 */
export async function newCitizen(db: GameDb, user: string, body: unknown, now: number, rng: Rng): Promise<Reply> {
  const b = (typeof body === "object" && body ? body : {}) as { input?: unknown; adopt?: unknown };
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
    // Votes only ever come from the server's own voter roll.
    game.voted = [];
  } else return no(400, "Nothing to create");
  const row = citizenRow(game);
  if (typeof row === "string") return no(400, row);
  const r = await db.create(user, row, stored(game));
  return ok({ game: r.game, version: r.version, created: r.created });
}

/** Store a save. Refused if it doesn't check out or changes who the citizen is; 409 if it is out of date. */
export async function putSave(db: GameDb, user: string, body: unknown): Promise<Reply> {
  const b = (typeof body === "object" && body ? body : {}) as { game?: unknown; version?: unknown };
  if (typeof b.version !== "number" || !Number.isInteger(b.version) || b.version < 1) return no(400, "Missing save version");
  const game = sanitizeGame(b.game);
  if (!game) return no(400, "That save can't be loaded");
  const have = await db.load(user);
  if (!have) return no(404, "Create your citizen first");
  const row = citizenRow(game);
  if (typeof row === "string") return no(400, row);
  const c = have.citizen;
  if (row.name !== c.name || row.state_code !== c.state_code || row.lga_code !== c.lga_code || row.pu_code !== c.pu_code)
    return no(400, "Your citizen can't be changed");
  // Votes only ever come from the server's own voter roll: keep what the stored save says.
  const before = sanitizeGame(have.game);
  game.voted = before?.voted ?? [];
  const version = await db.save(user, stored(game), b.version);
  if (version === null) return { status: 409, body: { error: "Your game was saved on another phone", game: have.game, version: have.version } };
  return ok({ version });
}
