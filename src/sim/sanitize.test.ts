import { describe, expect, it } from "vitest";
import { freshState, openings, rollCitizen, sanitizeGame, sequence, type GameState } from ".";

const look = { g: "f" as const, skin: "#6B3E26", cloth: "#8C2F5A" };
const citizen = rollCitizen({ name: "Bisi", look, stateCode: "kwara", lgaCode: "kwara/offa" }, Date.parse("2026-10-15T10:00:00+01:00"), sequence(0.5));
const good = (patch: Partial<GameState> = {}): GameState => ({ ...freshState(), citizen, loc: "home", homeId: "home", ...patch });

describe("save checks", () => {
  it("accepts an honest save and fills in missing fields", () => {
    const old: Partial<GameState> = good();
    delete old.heat;
    const g = sanitizeGame(old);
    expect(g?.heat).toBe(0);
    expect(g?.citizen?.name).toBe("Bisi");
  });

  it("clamps needs that drifted out of range", () => {
    expect(sanitizeGame(good({ needs: { food: 140, energy: -3, fun: 50, social: 50, hygiene: 50 } }))?.needs).toMatchObject({ food: 100, energy: 0 });
  });

  it("rejects impossible or mistyped values", () => {
    expect(sanitizeGame(null)).toBeNull();
    expect(sanitizeGame(good({ money: Infinity }))).toBeNull();
    expect(sanitizeGame(good({ money: "lots" as unknown as number }))).toBeNull();
    expect(sanitizeGame(good({ money: 1e15 }))).toBeNull();
    expect(sanitizeGame(good({ voted: [{ party: "X" }] as unknown as string[] }))).toBeNull();
    expect(sanitizeGame(good({ bribeEffects: { FAKE: 9999 } }))).toBeNull();
    expect(sanitizeGame(good({ citizen: { ...citizen, monthlyPay: 1e9 } }))).toBeNull();
    expect(sanitizeGame(good({ citizen: { ...citizen, lgaCode: "kano/fagge" } }))).toBeNull();
    expect(sanitizeGame(good({ citizen: { ...citizen, name: "x".repeat(40) } }))).toBeNull();
  });

  it("rejects a job application that was never on a board", () => {
    const o = openings("kwara/offa", 1)[0];
    const app = { ...o, decideDay: 3 };
    expect(sanitizeGame(good({ applications: [app] }))?.applications).toHaveLength(1);
    expect(sanitizeGame(good({ applications: [{ ...app, monthly: 50_000_000 }] }))).toBeNull();
    expect(sanitizeGame(good({ applications: [{ ...app, id: "kwara/offa#0#99" }] }))).toBeNull();
  });
});
