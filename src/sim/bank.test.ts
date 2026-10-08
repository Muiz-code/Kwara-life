import { describe, expect, it } from "vitest";
import { STOCKS, bankDaily, bankOp, book, breakdown, cleanBank, moodOf, netWorth, payout, reconcile, resolveStock, sharePrice, type BankOp } from "./bank";
import { freshState, type GameState } from "./state";
import { sanitizeGame } from "./sanitize";
import { MIN_PER_DAY, dayNum } from "./time";

const rich = (): GameState => ({ ...freshState(), money: 1_000_000 });
const ok = (s: GameState, op: BankOp) => {
  const r = bankOp(s, op);
  if ("error" in r) throw new Error(r.error);
  return r.state;
};

describe("the Klario statement", () => {
  it("records money in and out with what it was for, and keeps the totals", () => {
    const s = freshState();
    book(s, 5000, "Pay for today's work", "salary");
    book(s, -1200, "Rice and stew", "food");
    expect(s.money).toBe(20000 + 5000 - 1200);
    expect(s.bank.earned).toBe(5000);
    expect(s.bank.spent).toBe(1200);
    expect(s.bank.txns.map((x) => x.label)).toEqual(["Rice and stew", "Pay for today's work"]);
    expect(breakdown(s.bank)).toEqual({ income: [["salary", 5000]], spending: [["food", 1200]] });
  });

  it("puts a wallet change nobody labelled on the statement as Other", () => {
    const prev = freshState();
    const next = { ...prev, money: prev.money - 700, bank: { ...prev.bank } };
    const r = reconcile(prev, next);
    expect(r.bank.txns[0]).toMatchObject({ amt: -700, cat: "other" });
    expect(r.bank.spent).toBe(700);
    // Labelled changes are left alone.
    const labelled = structuredClone(prev);
    book(labelled, -300, "CV printing", "bills");
    expect(reconcile(prev, labelled).bank.txns).toHaveLength(1);
  });
});

describe("saving and investing", () => {
  it("moves money to Klario Save and back, without counting it as spending", () => {
    let s = ok(rich(), { op: "save", amt: 400_000 });
    expect(s.money).toBe(600_000);
    expect(s.bank.savings).toBe(400_000);
    expect(s.bank.spent).toBe(0);
    s = ok(s, { op: "unsave", amt: 100_000 });
    expect(s.bank.savings).toBe(300_000);
    expect(netWorth(s)).toBe(1_000_000);
    expect(bankOp(s, { op: "unsave", amt: 999_999 })).toEqual({ error: "You don't have that much saved." });
    expect(bankOp(s, { op: "save", amt: -5 })).toEqual({ error: "Enter an amount." });
  });

  it("pays savings interest every morning and pays out a matured deposit with interest", () => {
    let s = ok(rich(), { op: "save", amt: 365_000 });
    s = ok(s, { op: "deposit", amt: 100_000, plan: "week" });
    bankDaily(s);
    expect(s.bank.savings).toBe(365_000 + 150);
    s.t += 7 * MIN_PER_DAY;
    const before = s.money;
    bankDaily(s);
    expect(s.bank.deposits).toHaveLength(0);
    expect(s.money - before).toBe(payout({ id: 1, amt: 100_000, plan: "week", start: 0 }));
    expect(s.money - before).toBeGreaterThan(100_000);
  });

  it("gives a broken deposit back without interest", () => {
    let s = ok(rich(), { op: "deposit", amt: 60_000, plan: "fortnight" });
    s = ok(s, { op: "break", id: s.bank.deposits[0].id });
    expect(s.money).toBe(1_000_000);
    expect(bankOp(rich(), { op: "deposit", amt: 5000, plan: "fortnight" })).toHaveProperty("error");
  });

  it("buys and sells shares at the day's price, with the fee, and tracks the profit", () => {
    let s = ok(rich(), { op: "buy", id: "OGUNCEM", qty: 100 });
    const day = dayNum(s.t);
    expect(s.bank.shares.OGUNCEM.qty).toBe(100);
    expect(1_000_000 - s.money).toBe(Math.round(100 * sharePrice("OGUNCEM", day) * 1.01));
    s.t += 5 * MIN_PER_DAY;
    s = ok(s, { op: "sell", id: "OGUNCEM", qty: 100 });
    expect(s.bank.shares.OGUNCEM).toBeUndefined();
    expect(s.bank.realized).toBe(s.money - 1_000_000);
    expect(bankOp(s, { op: "sell", id: "OGUNCEM", qty: 1 })).toHaveProperty("error");
    expect(bankOp(s, { op: "buy", id: "NOTREAL", qty: 1 })).toHaveProperty("error");
  });

  it("prices shares the same for everyone on the same day, and they move", () => {
    expect(sharePrice("RAAVON", 12)).toBe(sharePrice("RAAVON", 12));
    const days = Array.from({ length: 30 }, (_, i) => sharePrice("RAAVON", i + 1));
    expect(new Set(days).size).toBeGreaterThan(20);
    expect(Math.min(...days)).toBeGreaterThan(0);
  });
});

describe("saves", () => {
  it("keeps a real account and refuses a doctored one", () => {
    const s = ok(rich(), { op: "buy", id: "KLARIO", qty: 10 });
    expect(sanitizeGame(s)?.bank.shares.KLARIO.qty).toBe(10);
    expect(cleanBank(undefined, 1e10)).toMatchObject({ savings: 0, txns: [] });
    expect(sanitizeGame({ ...s, bank: { ...s.bank, savings: -1 } })).toBeNull();
    expect(sanitizeGame({ ...s, bank: { ...s.bank, shares: { FAKE: { qty: 1, cost: 1 } } } })).toBeNull();
    expect(sanitizeGame({ ...s, bank: { ...s.bank, deposits: [{ id: 1, amt: 5, plan: "decade", start: 0 }] } })).toBeNull();
  });
});

describe("the market's booms and busts", () => {
  const days = Array.from({ length: 120 }, (_, i) => i + 1);
  it("now and then booms a share by thousands of percent, and every boom crashes", () => {
    const booms = STOCKS.flatMap((st) => days.filter((d) => moodOf(st.id, d) === "boom" && moodOf(st.id, d - 1) !== "boom").map((d) => ({ id: st.id, d })));
    expect(booms.length).toBeGreaterThan(0);
    for (const { id, d } of booms) {
      let end = d;
      while (moodOf(id, end + 1) === "boom") end++;
      expect(sharePrice(id, end) / sharePrice(id, d - 1)).toBeGreaterThan(8);
      expect(moodOf(id, end + 1)).toBe("crash");
    }
  });

  it("tells you when your shares multiply, once per level, and sells all or half on your word", () => {
    const { id, d } = STOCKS.flatMap((st) => days.filter((x) => moodOf(st.id, x) === "boom" && moodOf(st.id, x - 1) !== "boom").map((x) => ({ id: st.id, d: x })))[0];
    let s: GameState = { ...rich(), t: (d - 2) * MIN_PER_DAY + 7 * 60 };
    s = ok(s, { op: "buy", id, qty: 1000 });
    let end = d;
    while (moodOf(id, end + 1) === "boom") end++;
    s.t = (end - 1) * MIN_PER_DAY + 7 * 60;
    bankDaily(s);
    const alert = s.notes.at(-1)!;
    expect(alert.title.startsWith(`${id} is up `)).toBe(true);
    expect(alert.title).toMatch(/[\d,]+%$/);
    expect(alert.choices!.map((c) => c.id)).toEqual([`stock-sell:${id}`, `stock-half:${id}`, "ok"]);
    const notes = s.notes.length;
    bankDaily(s);
    expect(s.notes.length).toBe(notes);
    resolveStock(s, `stock-half:${id}`);
    expect(s.bank.shares[id].qty).toBe(500);
    resolveStock(s, `stock-sell:${id}`);
    expect(s.bank.shares[id]).toBeUndefined();
    expect(s.bank.realized).toBeGreaterThan(0);
  });
});

describe("savings goals", () => {
  it("saves towards a named target, earns interest, and pays out", () => {
    let s = ok(rich(), { op: "goal", name: "Rent", target: 200_000 });
    const id = s.bank.goals[0].id;
    s = ok(s, { op: "fund", id, amt: 365_000 });
    expect(s.toasts).toContain("Goal reached: Rent!");
    bankDaily(s);
    expect(s.bank.goals[0].saved).toBe(365_150);
    expect(netWorth(s)).toBe(1_000_150);
    s = ok(s, { op: "cashout", id });
    expect(s.bank.goals).toHaveLength(0);
    expect(s.money).toBe(1_000_150);
    expect(bankOp(s, { op: "goal", name: "x", target: 5 })).toHaveProperty("error");
  });
});
