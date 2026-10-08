import { describe, expect, it } from "vitest";
import { STATES } from "../data/states";
import { lgaActions, type LgaContext } from "./lga";
import { gestureFor } from "./gestures";

describe("action gestures", () => {
  it("lies on the bed to sleep and sits facing a switched-on TV to watch it", () => {
    expect(gestureFor("sleep")).toEqual({ pose: "lie", prop: "bed" });
    expect(gestureFor("tv")).toEqual({ pose: "sit", prop: "sofa", faces: "tv", switchOn: true });
    expect(gestureFor("cook").switchOn).toBe(true);
    expect(gestureFor("pray").prop).toBe("prayermat");
  });

  it("works the way the job looks", () => {
    expect(gestureFor("work", "office")).toMatchObject({ pose: "type", prop: "desk" });
    expect(gestureFor("work", "market")).toMatchObject({ pose: "talk", prop: "counter" });
  });

  it("gives every action in every kind of town something to do", () => {
    const ctx: LgaContext = { state: STATES.find((s) => s.code === "kwara")!, lgaName: "Offa", cls: "middle", job: "Banker", home: "Mini flat", underFlyover: false, career: "worker" };
    const idle: string[] = [];
    for (const actions of Object.values(lgaActions(ctx)))
      for (const a of actions) if (gestureFor(a.id, undefined, a.label).pose === "stand" && !gestureFor(a.id, undefined, a.label).prop) idle.push(a.id);
    // Only work (which needs the place kind) may fall back to standing still without its place.
    expect(idle.filter((id) => id !== "work")).toEqual([]);
  });

  it("never mistakes an object built-in for an action", () => {
    expect(gestureFor("constructor")).toEqual({ pose: "stand", prop: null });
  });
});
