import { describe, expect, it } from "vitest";
import type { Action } from "./action";
import { ACTIONS } from "./ilorin/actions";
import { ROADSIDE_MAX, receiptItem, serviceFor } from "./services";

const act = (a: Partial<Action>): Action => ({ id: "x", label: "Buy something", dur: 30, fx: {}, done: "Done.", ...a });
const kinds = (a: Action, room: Parameters<typeof serviceFor>[1] = "shop") => serviceFor(a, room)?.steps.map((s) => s.do);

describe("paying for things", () => {
  it("goods: order, receipt, pay, collect", () => {
    expect(kinds(act({ cost: 60000, goal: "phone" }))).toEqual(["tap", "receipt", "pay", "tap"]);
    expect(kinds(act({ cost: 2000, groc: 3 }))).toEqual(["tap", "receipt", "pay", "tap"]);
  });

  it("roadside snacks: two quick taps, no queue, no receipt", () => {
    const s = serviceFor(act({ cost: ROADSIDE_MAX, fx: { food: 10 } }), "shop")!;
    expect(s.queue).toBeNull();
    expect(s.steps.map((x) => x.do)).toEqual(["tap", "pay"]);
  });

  it("tickets and sessions: receipt and pay, and a ticket for match days", () => {
    expect(kinds(act({ cost: 1500, fx: { fun: 10 } }))).toEqual(["receipt", "pay"]);
    expect(kinds(act({ cost: 1500, days: [5, 6], fx: { fun: 10 } }), "stadium")).toEqual(["receipt", "pay", "tap"]);
  });

  it("queues only at proper counters or for big buys", () => {
    expect(serviceFor(act({ cost: 2000, groc: 3 }), "shop")!.queue).toBeNull();
    expect(serviceFor(act({ cost: 2000, outfit: "x" }), "boutique")!.queue).not.toBeNull();
    expect(serviceFor(act({ cost: 50000, phone: "x" }), "shop")!.queue).not.toBeNull();
  });

  it("free things, rent, shifts and things at home have no counter", () => {
    expect(serviceFor(act({}), "shop")).toBeNull();
    expect(serviceFor(act({ cost: 250000, rent: true }), "shop")).toBeNull();
    expect(serviceFor(act({ cost: 500 }), "home")).toBeNull();
  });

  it("every paid action in Ilorin pays through a pay step", () => {
    for (const list of Object.values(ACTIONS))
      for (const a of list) {
        const s = serviceFor(a, "shop");
        if (s && a.cost) expect(s.steps.some((x) => x.do === "pay"), a.id).toBe(true);
      }
  });

  it("writes the receipt line without the verb", () => {
    expect(receiptItem("Buy a new phone")).toBe("New phone");
    expect(receiptItem("Jollof rice and chicken")).toBe("Jollof rice and chicken");
  });
});
