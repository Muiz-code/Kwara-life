import { describe, expect, it } from "vitest";
import { sequence } from "../sim";
import { finishAction, startAction } from "../sim/actions";
import { sanitizeGame } from "../sim/sanitize";
import { freshState } from "../sim/state";
import { FURNITURE_ACTIONS } from "./furniture";

describe("furniture", () => {
  const bed = FURNITURE_ACTIONS.find((a) => a.furnish === "bed")!;
  const shop = { name: "Market", open: [0, 24] as [number, number], gen: false };

  it("buys a piece once, pays for it and keeps it", () => {
    const s = { ...freshState(), money: 200000 };
    const r = startAction(s, bed, sequence(0.5), { place: shop });
    if (!("plan" in r)) throw new Error("blocked");
    const after = finishAction(r.state, r.plan, sequence(0.5), { place: shop });
    expect(after.furniture).toEqual(["bed"]);
    expect(after.money).toBe(200000 - 85000);
    expect(startAction(after, bed, sequence(0.5), { place: shop })).toEqual({ blocked: "You already have one at home" });
  });

  it("rejects a save with furniture the game does not sell", () => {
    expect(sanitizeGame({ ...freshState(), furniture: ["bed"] })?.furniture).toEqual(["bed"]);
    expect(sanitizeGame({ ...freshState(), furniture: ["golden-throne"] })).toBeNull();
  });
});
