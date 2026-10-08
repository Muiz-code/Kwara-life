import { describe, expect, it } from "vitest";
import { sequence } from "../sim";
import { finishAction, PITCH_INVESTMENT, startAction } from "../sim/actions";
import { sanitizeGame } from "../sim/sanitize";
import { freshState } from "../sim/state";
import { PHONE_ACTIONS, phoneOf } from "./phones";

const shop = { name: "Market", open: [0, 24] as [number, number], gen: false };
const run = (s: ReturnType<typeof freshState>, a: (typeof PHONE_ACTIONS)[number], r = 0.5) => {
  const st = startAction(s, a, sequence(r), { place: shop });
  if (!("plan" in st)) throw new Error("blocked");
  return finishAction(st.state, st.plan, sequence(r), { place: shop });
};

describe("phones", () => {
  it("gives each class the phone it can afford", () => {
    expect(phoneOf(null, "poor").kind).toBe("keypad");
    expect(phoneOf(null, "middle").kind).toBe("android");
    expect(phoneOf(null, "rich").kind).toBe("island");
  });

  it("sells a better phone at the stall, once", () => {
    const flagship = PHONE_ACTIONS.find((a) => a.phone === "ife")!;
    const s = run({ ...freshState(), money: 2_000_000 }, flagship);
    expect(s.phone).toBe("ife");
    expect(s.money).toBe(2_000_000 - 1_850_000);
    expect(startAction(s, flagship, sequence(0.5), { place: shop })).toEqual({ blocked: "You already have this phone" });
  });

  it("rejects a save with a phone the game does not sell", () => {
    expect(sanitizeGame({ ...freshState(), phone: "ife" })?.phone).toBe("ife");
    expect(sanitizeGame({ ...freshState(), phone: "golden-phone" })).toBeNull();
  });
});

describe("Raavon", () => {
  const pitch = { id: "pitch", label: "Pitch", dur: 120, pitch: true, fx: {}, done: "" };
  const site = { id: "site", label: "Site", dur: 90, cost: 350000, website: true, fx: {}, done: "Done." };

  it("sometimes invests in a pitch, and only one pitch a day", () => {
    const yes = run(freshState(), pitch as never, 0.01);
    expect(yes.money).toBe(freshState().money + PITCH_INVESTMENT);
    const no = run(freshState(), pitch as never, 0.99);
    expect(no.money).toBe(freshState().money);
    expect(startAction(no, pitch as never, sequence(0.5), { place: shop })).toEqual({ blocked: "You pitched today. Work on it and come back tomorrow" });
  });

  it("builds your website once", () => {
    const s = run({ ...freshState(), money: 500000 }, site as never);
    expect(s.flags.website).toBe(true);
    expect(startAction(s, site as never, sequence(0.5), { place: shop })).toEqual({ blocked: "Raavon already built your website" });
  });
});
