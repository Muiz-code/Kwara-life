import { describe, expect, it } from "vitest";
import { sequence } from "../sim";
import type { GameState } from "../sim/state";
import { getGame, newCitizen, putSave, type CitizenRow, type GameDb } from "./game";

/** The database in memory, with the same version rule as save_game. */
function memoryDb(): GameDb & { rows: Map<string, { citizen: CitizenRow; game: unknown; version: number }> } {
  const rows = new Map<string, { citizen: CitizenRow; game: unknown; version: number }>();
  return {
    rows,
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
const roll = (db: GameDb, user = "u1") => newCitizen(db, user, { input }, Date.UTC(2026, 9, 9), sequence(0.4));

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
    const b = await newCitizen(db, "u1", { input: { ...input, name: "Other" } }, 0, sequence(0.9));
    expect(b.body.created).toBe(false);
    expect((b.body.game as GameState).citizen?.name).toBe("Tunde");
  });

  it("refuses a made-up place or look", async () => {
    const db = memoryDb();
    expect((await newCitizen(db, "u1", { input: { ...input, lgaCode: "lagos/ikeja" } }, 0, sequence(0.4))).status).toBe(400);
    expect((await newCitizen(db, "u1", { input: { ...input, look: { g: "x", skin: "red", cloth: "#000000" } } }, 0, sequence(0.4))).status).toBe(400);
  });

  it("takes over an old save once, without its votes", async () => {
    const db = memoryDb();
    const g = (await roll(memoryDb())).body.game as GameState;
    const r = await newCitizen(db, "u2", { adopt: { ...g, voted: ["presidential-2027"] } }, 0, Math.random);
    expect(r.status).toBe(200);
    expect((r.body.game as GameState).voted).toEqual([]);
  });

  it("stores saves in order and refuses one from an older version", async () => {
    const db = memoryDb();
    const g = (await roll(db)).body.game as GameState;
    expect((await putSave(db, "u1", { game: { ...g, money: 5000 }, version: 1 })).body.version).toBe(2);
    const stale = await putSave(db, "u1", { game: { ...g, money: 9 }, version: 1 });
    expect(stale.status).toBe(409);
    expect((stale.body.game as GameState).money).toBe(5000);
    expect((await getGame(db, "u1")).body.version).toBe(2);
  });

  it("never lets a save change who the citizen is, or add a vote", async () => {
    const db = memoryDb();
    const g = (await roll(db)).body.game as GameState;
    const moved = { ...g, citizen: { ...g.citizen!, lgaCode: "kwara/ilorin-east", puCode: "kwara/ilorin-east/1" } };
    expect((await putSave(db, "u1", { game: moved, version: 1 })).status).toBe(400);
    expect((await putSave(db, "u1", { game: { ...g, voted: ["presidential-2027"] }, version: 1 })).status).toBe(200);
    expect((db.rows.get("u1")!.game as GameState).voted).toEqual([]);
  });

  it("refuses a broken save", async () => {
    const db = memoryDb();
    await roll(db);
    expect((await putSave(db, "u1", { game: { money: "lots" }, version: 1 })).status).toBe(400);
    expect((await putSave(db, "nobody", { game: {}, version: 1 })).status).toBe(404);
  });
});
