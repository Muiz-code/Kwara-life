import { describe, expect, it } from "vitest";
import { sequence } from "../sim";
import type { GameState } from "../sim/state";
import { DEVICE_STALE_MINUTES, ON_ANOTHER_DEVICE, device, getGame, newCitizen, putSave, type CitizenRow, type GameDb } from "./game";

/** The database in memory, with the same rules as save_game and claim_device (minutes on a fake clock). */
function memoryDb(): GameDb & { rows: Map<string, { citizen: CitizenRow; game: unknown; version: number }>; clock: { min: number } } {
  const rows = new Map<string, { citizen: CitizenRow; game: unknown; version: number }>();
  const held = new Map<string, { device: string; at: number }>();
  const clock = { min: 0 };
  return {
    rows,
    clock,
    claim: async (u, d, stale) => {
      const h = held.get(u);
      if (h && h.device !== d && h.at >= clock.min - stale) return false;
      held.set(u, { device: d, at: clock.min });
      return true;
    },
    release: async (u, d) => {
      if (held.get(u)?.device === d) held.delete(u);
    },
    load: async (u) => rows.get(u) ?? null,
    create: async (u, citizen, game) => {
      const had = rows.get(u);
      if (had) return { created: false, game: had.game, version: had.version };
      rows.set(u, { citizen, game: structuredClone(game), version: 1 });
      return { created: true, game, version: 1 };
    },
    save: async (u, game, version) => {
      const r = rows.get(u);
      if (!r || r.version !== version) return null;
      r.game = structuredClone(game);
      r.version++;
      return r.version;
    },
  };
}

const input = { name: "Tunde", look: { g: "m", skin: "#8D5524", cloth: "#2F7D7A" }, stateCode: "kwara", lgaCode: "kwara/ilorin-west" };
const PHONE = "phone-aaaaaaaaaaaaaaaa";
const LAPTOP = "laptop-bbbbbbbbbbbbbbbb";
const roll = (db: GameDb, user = "u1") => newCitizen(db, user, { input, device: PHONE }, Date.UTC(2026, 9, 9), sequence(0.4));

describe("the game on the server", () => {
  it("rolls a citizen on the server and keeps one per account", async () => {
    const db = memoryDb();
    const a = await roll(db);
    expect(a.status).toBe(200);
    expect(a.body.created).toBe(true);
    const g = a.body.game as GameState;
    expect(g.citizen?.lgaCode).toBe("kwara/ilorin-west");
    expect(db.rows.get("u1")!.citizen.zone).toBe("NC");
    // A second roll for the same account gets the first life back.
    const b = await newCitizen(db, "u1", { input: { ...input, name: "Other" }, device: PHONE }, 0, sequence(0.9));
    expect(b.body.created).toBe(false);
    expect((b.body.game as GameState).citizen?.name).toBe("Tunde");
  });

  it("refuses a made-up place or look", async () => {
    const db = memoryDb();
    expect((await newCitizen(db, "u1", { input: { ...input, lgaCode: "lagos/ikeja" }, device: PHONE }, 0, sequence(0.4))).status).toBe(400);
    expect((await newCitizen(db, "u1", { input: { ...input, look: { g: "x", skin: "red", cloth: "#000000" } }, device: PHONE }, 0, sequence(0.4))).status).toBe(400);
  });

  it("takes over an old save once, without its votes", async () => {
    const db = memoryDb();
    const g = (await roll(memoryDb())).body.game as GameState;
    const r = await newCitizen(db, "u2", { adopt: { ...g, voted: ["presidential-2027"] }, device: PHONE }, 0, Math.random);
    expect(r.status).toBe(200);
    expect((r.body.game as GameState).voted).toEqual([]);
  });

  it("stores saves in order and refuses one from an older version", async () => {
    const db = memoryDb();
    const g = (await roll(db)).body.game as GameState;
    expect((await putSave(db, "u1", { game: { ...g, money: 5000 }, version: 1, device: PHONE })).body.version).toBe(2);
    const stale = await putSave(db, "u1", { game: { ...g, money: 9 }, version: 1, device: PHONE });
    expect(stale.status).toBe(409);
    expect((stale.body.game as GameState).money).toBe(5000);
    expect((await getGame(db, "u1", PHONE)).body.version).toBe(2);
  });

  it("never lets a save change who the citizen is, or add a vote", async () => {
    const db = memoryDb();
    const g = (await roll(db)).body.game as GameState;
    const moved = { ...g, citizen: { ...g.citizen!, lgaCode: "kwara/ilorin-east", puCode: "kwara/ilorin-east/1" } };
    expect((await putSave(db, "u1", { game: moved, version: 1, device: PHONE })).status).toBe(400);
    expect((await putSave(db, "u1", { game: { ...g, voted: ["presidential-2027"] }, version: 1, device: PHONE })).status).toBe(200);
    expect((db.rows.get("u1")!.game as GameState).voted).toEqual([]);
  });

  it("refuses a broken save", async () => {
    const db = memoryDb();
    await roll(db);
    expect((await putSave(db, "u1", { game: { money: "lots" }, version: 1, device: PHONE })).status).toBe(400);
    expect((await putSave(db, "nobody", { game: {}, version: 1, device: PHONE })).status).toBe(404);
  });

  it("plays on one device at a time", async () => {
    const db = memoryDb();
    const g = (await roll(db)).body.game as GameState;
    // The laptop is turned away while the phone plays, for loading and for saving.
    const busy = await getGame(db, "u1", LAPTOP);
    expect(busy.status).toBe(423);
    expect(busy.body.error).toBe(ON_ANOTHER_DEVICE);
    expect((await putSave(db, "u1", { game: g, version: 1, device: LAPTOP })).status).toBe(423);
    // Logging out on the phone frees it at once.
    expect((await device(db, "u1", { device: PHONE, release: true })).status).toBe(200);
    expect((await getGame(db, "u1", LAPTOP)).status).toBe(200);
    // Now the phone is the one turned away.
    expect((await device(db, "u1", { device: PHONE })).status).toBe(423);
  });

  it("frees a device that stopped checking in", async () => {
    const db = memoryDb();
    await roll(db);
    db.clock.min = DEVICE_STALE_MINUTES - 1;
    expect((await getGame(db, "u1", LAPTOP)).status).toBe(423);
    db.clock.min = DEVICE_STALE_MINUTES * 2 + 1;
    expect((await getGame(db, "u1", LAPTOP)).status).toBe(200);
  });

  it("needs a device id", async () => {
    expect((await getGame(memoryDb(), "u1", null)).status).toBe(400);
  });
});
