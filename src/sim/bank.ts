// Klario: your bank. Every naira in or out of your wallet goes on your statement with what it was for, so
// you can see what you made, what you spent and where it went. On top of the wallet: Klario Save (interest
// every morning, take it out any time), fixed deposits (locked for a week or two at a better rate) and the
// Lagos stock market (prices move once a day, the same for every player, from the date alone).
import { log, note, type GameState } from "./state";
import { dayNum } from "./time";

/** What a transaction was for. Income and spending are counted in your totals; moves between your own accounts are not. */
export type TxnCat =
  | "salary" | "hustle" | "gift" | "investor" | "interest" | "opening"
  | "food" | "transport" | "shopping" | "home" | "bills" | "fun" | "family" | "fines" | "campaign"
  | "savings" | "deposit" | "stocks"
  | "other";

export const CAT_LABEL: Record<TxnCat, string> = {
  salary: "Salary", hustle: "Hustle", gift: "Gifts", investor: "Investors", interest: "Interest", opening: "Opening balance",
  food: "Food", transport: "Transport", shopping: "Shopping", home: "Home", bills: "Bills and fees", fun: "Enjoyment",
  family: "Family", fines: "Fines and losses", campaign: "Campaign", savings: "Klario Save", deposit: "Fixed deposit", stocks: "Stocks", other: "Other",
};
export const CATS = Object.keys(CAT_LABEL) as TxnCat[];
/** Moves between your own accounts: not income, not spending. */
const TRANSFER = new Set<TxnCat>(["savings", "deposit", "stocks", "opening"]);

export interface Txn {
  /** Running number, to tell new entries from old. */
  n: number;
  /** Game time. */
  t: number;
  /** Change to the wallet in naira (positive in, negative out). Interest goes to Klario Save instead (acct "save"). */
  amt: number;
  label: string;
  cat: TxnCat;
  acct?: "save";
}

export interface Deposit {
  id: number;
  amt: number;
  plan: DepositPlanId;
  /** Game time it was opened. */
  start: number;
}

export interface Holding {
  qty: number;
  /** What you paid for the shares you still hold, fees included. */
  cost: number;
}

export interface Bank {
  txns: Txn[];
  seq: number;
  /** Lifetime income and spending (transfers between your own accounts left out). */
  earned: number;
  spent: number;
  savings: number;
  deposits: Deposit[];
  shares: Record<string, Holding>;
  /** Profit (or loss) from shares you have sold. */
  realized: number;
  /** Savings goals, Klario style: a name, a target, what is in it so far. */
  goals: Goal[];
  /** The biggest gain (times what you paid) each holding has already been flagged at, so alerts don't repeat. */
  alerts: Record<string, number>;
}

export interface Goal {
  id: number;
  name: string;
  target: number;
  saved: number;
}

export const MAX_GOALS = 5;

export const TXN_LIMIT = 150;
export const SAVE_RATE = 0.15;
export const DEPOSIT_PLANS = {
  week: { label: "7-day fixed deposit", days: 7, rate: 0.2, min: 10_000 },
  fortnight: { label: "14-day fixed deposit", days: 14, rate: 0.24, min: 50_000 },
} as const;
export type DepositPlanId = keyof typeof DEPOSIT_PLANS;
export const MAX_DEPOSITS = 6;
/** Broker's commission on every trade. */
export const TRADE_FEE = 0.01;

/** Companies on the board. All made up. */
export const STOCKS = [
  { id: "KLARIO", name: "Klario Bank", base: 48 },
  { id: "RAAVON", name: "Raavon Technologies", base: 120 },
  { id: "OGUNCEM", name: "Ogun Cement", base: 310 },
  { id: "SAHELAGRO", name: "Sahel Agro", base: 22 },
  { id: "NAIJATEL", name: "NaijaTel", base: 205 },
  { id: "DELTAOIL", name: "Delta Oil & Gas", base: 640 },
] as const;
export const STOCK = Object.fromEntries(STOCKS.map((s) => [s.id, s])) as Record<string, (typeof STOCKS)[number]>;

export const freshBank = (): Bank => ({ txns: [], seq: 0, earned: 0, spent: 0, savings: 0, deposits: [], shares: {}, realized: 0, goals: [], alerts: {} });

/** Mutates s: money in (positive) or out (negative) of the wallet, on the statement. */
export function book(s: GameState, amt: number, label: string, cat: TxnCat) {
  amt = Math.round(amt);
  if (!amt) return;
  s.money += amt;
  record(s, amt, label, cat);
}

/** Mutates s: a statement line for money that has already moved. */
export function record(s: GameState, amt: number, label: string, cat: TxnCat, acct?: "save") {
  const b = s.bank;
  b.seq++;
  b.txns = [{ n: b.seq, t: s.t, amt, label, cat, ...(acct ? { acct } : {}) }, ...b.txns].slice(0, TXN_LIMIT);
  if (!TRANSFER.has(cat)) {
    if (amt > 0) b.earned += amt;
    else b.spent -= amt;
  }
}

/**
 * The store's safety net: wallet changes no statement line explains (a cost added somewhere without a label)
 * still go on the statement, as "Other".
 */
export function reconcile(prev: GameState, next: GameState): GameState {
  if (next.money === prev.money && next.bank.seq === prev.bank.seq) return next;
  // A new citizen starts a new account: nothing to reconcile against the old one.
  if (next.bank.seq < prev.bank.seq || next.bank.txns.some((x) => x.n > prev.bank.seq && x.cat === "opening")) return next;
  const explained = next.bank.txns.filter((x) => x.n > prev.bank.seq && x.acct !== "save").reduce((sum, x) => sum + x.amt, 0);
  const gap = Math.round(next.money - prev.money - explained);
  if (!gap) return next;
  const s = { ...next, bank: { ...next.bank } };
  record(s, gap, gap > 0 ? "Money received" : "Payment", "other");
  return s;
}

// ---- Prices ----

/** A number in [0, 1) from a string and a day: the same for every player. */
function hash01(key: string, day: number) {
  let h = 2166136261 ^ day;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export type Mood = "calm" | "rally" | "boom" | "crash";

/**
 * The market, day by day, the same for every player. Most days a share drifts a few percent. Now and then
 * it rallies for a few days (+12% to +30% a day); rarely it booms (+60% to +95% a day for five to seven days,
 * thousands of percent in all). Every run ends in a crash that gives most of it back: sell in time.
 */
type Day = { price: number; mood: Mood; left: number; rate: number };
const history = new Map<string, Day[]>();
/** Every day of a share's market up to a day, worked out once and kept (days 0 and 1 are its listing). */
function walk(id: string, upTo: number): Day[] {
  const listing: Day = { price: STOCK[id].base, mood: "calm", left: 0, rate: 1 };
  let h = history.get(id);
  if (!h) history.set(id, (h = [listing, listing]));
  for (let d = h.length; d <= upTo; d++) {
    const prev = h[d - 1];
    const next = regime(id, d, prev.left, prev.rate, prev.mood);
    const noise = 1 + (hash01(`${id}~n`, d) - 0.5) * 0.04;
    const move = next.mood === "calm" ? 1 + (hash01(id, d) - 0.47) * 0.08 : next.rate * noise;
    h.push({ ...next, price: Math.max(1, prev.price * move) });
  }
  return h;
}

/** The next day's regime: carry on a run, or maybe start one. */
function regime(id: string, d: number, left: number, rate: number, mood: Mood): { left: number; rate: number; mood: Mood } {
  if (left > 0) return { left: left - 1, rate, mood };
  // A run just ended: rallies and booms always crash.
  if (mood === "rally" || mood === "boom") {
    const days = 2 + Math.floor(hash01(`${id}~c`, d) * 3);
    return { left: days - 1, rate: mood === "boom" ? 0.55 + hash01(`${id}~cr`, d) * 0.15 : 0.8 + hash01(`${id}~cr`, d) * 0.1, mood: "crash" };
  }
  const r = hash01(`${id}~r`, d);
  if (r < 0.012) return { left: 4 + Math.floor(hash01(`${id}~l`, d) * 3), rate: 1.6 + hash01(`${id}~g`, d) * 0.35, mood: "boom" };
  if (r < 0.06) return { left: 2 + Math.floor(hash01(`${id}~l`, d) * 3), rate: 1.12 + hash01(`${id}~g`, d) * 0.18, mood: "rally" };
  return { left: 0, rate: 1, mood: "calm" };
}

/** A share's price on a game day. */
export function sharePrice(id: string, day: number): number {
  if (!STOCK[id]) return 0;
  const p = walk(id, Math.max(1, day))[Math.max(1, day)].price;
  return Math.round(p * 100) / 100;
}

/** How a share is trading today: calm, rallying, booming or crashing. */
export const moodOf = (id: string, day: number): Mood => (STOCK[id] ? walk(id, Math.max(1, day))[Math.max(1, day)].mood : "calm");

/** The change over the last n days, as a fraction (+39 is up 3,900%). */
export function changeOver(id: string, day: number, n: number) {
  const from = sharePrice(id, Math.max(1, day - n));
  return from ? sharePrice(id, day) / from - 1 : 0;
}

/** Today's price, yesterday's and the change, for the board. */
export function quote(id: string, day: number) {
  const now = sharePrice(id, day);
  const before = sharePrice(id, day - 1);
  return { now, before, change: day > 1 ? (now - before) / before : 0 };
}

// ---- Totals ----

export const depositValue = (b: Bank) => b.deposits.reduce((sum, d) => sum + d.amt, 0);
export const sharesValue = (b: Bank, day: number) => Object.entries(b.shares).reduce((sum, [id, h]) => sum + h.qty * sharePrice(id, day), 0);
export const netWorth = (s: GameState) => s.money + s.bank.savings + goalsValue(s.bank) + depositValue(s.bank) + Math.round(sharesValue(s.bank, dayNum(s.t)));
export const matures = (d: Deposit) => d.start + DEPOSIT_PLANS[d.plan].days * 24 * 60;
/** What a deposit pays at the end: the amount plus its interest. */
export const payout = (d: Deposit) => Math.round(d.amt * (1 + (DEPOSIT_PLANS[d.plan].rate * DEPOSIT_PLANS[d.plan].days) / 365));

/** Income and spending since a game time, by category, largest first. */
export function breakdown(b: Bank, since = -Infinity) {
  const inn = new Map<TxnCat, number>();
  const out = new Map<TxnCat, number>();
  for (const x of b.txns) {
    if (x.t < since || TRANSFER.has(x.cat)) continue;
    const m = x.amt > 0 ? inn : out;
    m.set(x.cat, (m.get(x.cat) ?? 0) + Math.abs(x.amt));
  }
  const sorted = (m: Map<TxnCat, number>) => [...m.entries()].sort((a, c) => c[1] - a[1]);
  return { income: sorted(inn), spending: sorted(out) };
}

// ---- Banking ----

export type BankOp =
  | { op: "save"; amt: number }
  | { op: "unsave"; amt: number }
  | { op: "deposit"; amt: number; plan: DepositPlanId }
  | { op: "break"; id: number }
  | { op: "buy"; id: string; qty: number }
  | { op: "sell"; id: string; qty: number }
  | { op: "goal"; name: string; target: number }
  | { op: "fund"; id: number; amt: number }
  | { op: "cashout"; id: number };

const whole = (n: number) => Number.isFinite(n) && Number.isInteger(n) && n > 0;

/** Do a banking operation: the new state, or why not. */
export function bankOp(state: GameState, o: BankOp): { state: GameState } | { error: string } {
  const s: GameState = { ...state, bank: { ...state.bank, deposits: [...state.bank.deposits], shares: { ...state.bank.shares }, goals: [...state.bank.goals], alerts: { ...state.bank.alerts } } };
  const b = s.bank;
  const day = dayNum(s.t);
  switch (o.op) {
    case "save":
      if (!whole(o.amt)) return { error: "Enter an amount." };
      if (o.amt > s.money) return { error: "You don't have that much in your wallet." };
      b.savings += o.amt;
      book(s, -o.amt, "Moved to Klario Save", "savings");
      return { state: s };
    case "unsave":
      if (!whole(o.amt)) return { error: "Enter an amount." };
      if (o.amt > b.savings) return { error: "You don't have that much saved." };
      b.savings -= o.amt;
      book(s, o.amt, "Taken out of Klario Save", "savings");
      return { state: s };
    case "deposit": {
      const plan = DEPOSIT_PLANS[o.plan];
      if (!plan) return { error: "Pick a plan." };
      if (!whole(o.amt)) return { error: "Enter an amount." };
      if (o.amt < plan.min) return { error: `The ${plan.label} starts from ₦${plan.min.toLocaleString("en-NG")}.` };
      if (o.amt > s.money) return { error: "You don't have that much in your wallet." };
      if (b.deposits.length >= MAX_DEPOSITS) return { error: "You have too many deposits running. Wait for one to mature." };
      const id = b.deposits.reduce((m, d) => Math.max(m, d.id), 0) + 1;
      b.deposits.push({ id, amt: o.amt, plan: o.plan, start: s.t });
      book(s, -o.amt, `Opened a ${plan.label}`, "deposit");
      return { state: s };
    }
    case "break": {
      const d = b.deposits.find((x) => x.id === o.id);
      if (!d) return { error: "No such deposit." };
      // Broken early: you get your money back but no interest.
      b.deposits = b.deposits.filter((x) => x.id !== o.id);
      book(s, d.amt, `Broke a ${DEPOSIT_PLANS[d.plan].label} early (no interest)`, "deposit");
      return { state: s };
    }
    case "buy": {
      const st = STOCK[o.id];
      if (!st) return { error: "No such company." };
      if (!whole(o.qty)) return { error: "Enter how many shares." };
      const cost = Math.round(o.qty * sharePrice(o.id, day) * (1 + TRADE_FEE));
      if (cost > s.money) return { error: "You don't have enough in your wallet for that, with the 1% fee." };
      const h = b.shares[o.id] ?? { qty: 0, cost: 0 };
      b.shares[o.id] = { qty: h.qty + o.qty, cost: h.cost + cost };
      book(s, -cost, `Bought ${o.qty.toLocaleString("en-NG")} ${st.name} shares`, "stocks");
      return { state: s };
    }
    case "sell": {
      const st = STOCK[o.id];
      const h = b.shares[o.id];
      if (!st || !h) return { error: "You don't own any." };
      if (!whole(o.qty) || o.qty > h.qty) return { error: `You have ${h.qty} shares.` };
      const got = Math.round(o.qty * sharePrice(o.id, day) * (1 - TRADE_FEE));
      const basis = Math.round((h.cost * o.qty) / h.qty);
      b.realized += got - basis;
      if (o.qty === h.qty) {
        delete b.shares[o.id];
        b.alerts = { ...b.alerts };
        delete b.alerts[o.id];
      } else b.shares[o.id] = { qty: h.qty - o.qty, cost: h.cost - basis };
      book(s, got, `Sold ${o.qty.toLocaleString("en-NG")} ${st.name} shares`, "stocks");
      return { state: s };
    }
    case "goal": {
      const name = o.name.trim();
      if (name.length < 2 || name.length > 30) return { error: "Name your goal (2 to 30 letters)." };
      if (!whole(o.target) || o.target < 1000) return { error: "Set a target of at least ₦1,000." };
      if (b.goals.length >= MAX_GOALS) return { error: `You can have ${MAX_GOALS} goals at a time.` };
      const id = b.goals.reduce((m, g) => Math.max(m, g.id), 0) + 1;
      b.goals.push({ id, name, target: o.target, saved: 0 });
      return { state: s };
    }
    case "fund": {
      const g = b.goals.find((x) => x.id === o.id);
      if (!g) return { error: "No such goal." };
      if (!whole(o.amt)) return { error: "Enter an amount." };
      if (o.amt > s.money) return { error: "You don't have that much in your wallet." };
      b.goals = b.goals.map((x) => (x.id === o.id ? { ...x, saved: x.saved + o.amt } : x));
      book(s, -o.amt, `Saved towards ${g.name}`, "savings");
      if (g.saved < g.target && g.saved + o.amt >= g.target) s.toasts.push(`Goal reached: ${g.name}!`);
      return { state: s };
    }
    case "cashout": {
      const g = b.goals.find((x) => x.id === o.id);
      if (!g) return { error: "No such goal." };
      b.goals = b.goals.filter((x) => x.id !== o.id);
      if (g.saved > 0) book(s, g.saved, `${g.name}: goal ${g.saved >= g.target ? "reached and paid out" : "closed early"}`, "savings");
      return { state: s };
    }
  }
}

/** What you have in your savings goals. */
export const goalsValue = (b: Bank) => b.goals.reduce((sum, g) => sum + g.saved, 0);

/** The gains that get you a notice: double, five times, ten, twenty-five and forty times what you paid. */
export const ALERT_AT = [2, 5, 10, 25, 40];

/** Mutates s: every morning, savings earn their interest, deposits mature, and big moves on your shares get a notice. */
export function bankDaily(s: GameState) {
  const b = s.bank;
  const interest = Math.floor((b.savings * SAVE_RATE) / 365);
  if (interest > 0) {
    b.savings += interest;
    record(s, interest, "Klario Save interest", "interest", "save");
  }
  // Goals earn the Klario Save rate too.
  b.goals = b.goals.map((g) => {
    const i = Math.floor((g.saved * SAVE_RATE) / 365);
    if (i > 0) record(s, i, `Interest on ${g.name}`, "interest", "save");
    return i > 0 ? { ...g, saved: g.saved + i } : g;
  });
  stockAlerts(s);
  for (const d of [...b.deposits]) {
    if (matures(d) > s.t) continue;
    b.deposits = b.deposits.filter((x) => x.id !== d.id);
    const pay = payout(d);
    book(s, d.amt, `${DEPOSIT_PLANS[d.plan].label} matured`, "deposit");
    book(s, pay - d.amt, `Interest on your ${DEPOSIT_PLANS[d.plan].label}`, "interest");
    s.toasts.push(`Deposit matured: +₦${pay.toLocaleString("en-NG")}`);
  }
}

/** A saved bank that can be trusted, or null. */
export function cleanBank(raw: unknown, ceiling: number): Bank | null {
  if (raw === undefined) return freshBank();
  if (typeof raw !== "object" || raw === null) return null;
  const b = raw as Bank;
  const money = (n: unknown, min = 0) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= ceiling;
  if (!money(b.earned) || !money(b.spent) || !money(b.savings) || !money(b.realized, -ceiling) || !Number.isInteger(b.seq) || b.seq < 0) return null;
  if (!Array.isArray(b.txns) || b.txns.length > TXN_LIMIT) return null;
  for (const x of b.txns)
    if (!x || !Number.isInteger(x.n) || !money(x.t) || !money(x.amt, -ceiling) || typeof x.label !== "string" || x.label.length > 120 || !CATS.includes(x.cat) || (x.acct !== undefined && x.acct !== "save")) return null;
  if (!Array.isArray(b.deposits) || b.deposits.length > MAX_DEPOSITS) return null;
  for (const d of b.deposits) if (!d || !Number.isInteger(d.id) || !money(d.amt) || !Object.hasOwn(DEPOSIT_PLANS, d.plan) || !money(d.start)) return null;
  if (typeof b.shares !== "object" || b.shares === null) return null;
  for (const [id, h] of Object.entries(b.shares)) if (!STOCK[id] || !h || !Number.isInteger(h.qty) || h.qty <= 0 || h.qty > 1e8 || !money(h.cost)) return null;
  // Saves from before goals and alerts get empty ones.
  const goals = b.goals ?? [];
  if (!Array.isArray(goals) || goals.length > MAX_GOALS) return null;
  for (const g of goals) if (!g || !Number.isInteger(g.id) || typeof g.name !== "string" || g.name.length > 30 || !money(g.target) || !money(g.saved)) return null;
  const alerts = b.alerts ?? {};
  if (typeof alerts !== "object" || alerts === null || !Object.entries(alerts).every(([id, n]) => STOCK[id] && ALERT_AT.includes(n))) return null;
  return { txns: b.txns, seq: b.seq, earned: b.earned, spent: b.spent, savings: b.savings, deposits: b.deposits, shares: b.shares, realized: b.realized, goals, alerts };
}

/** Mutates s: a notice when a share you hold has multiplied, offering to sell; news when one is crashing on you. */
function stockAlerts(s: GameState) {
  const b = s.bank;
  const day = dayNum(s.t);
  for (const [id, h] of Object.entries(b.shares)) {
    const value = h.qty * sharePrice(id, day);
    const times = value / Math.max(1, h.cost);
    const level = [...ALERT_AT].reverse().find((n) => times >= n);
    if (level && level > (b.alerts[id] ?? 0)) {
      b.alerts = { ...b.alerts, [id]: level };
      const pct = Math.round((times - 1) * 100).toLocaleString("en-NG");
      note(
        s,
        `${id} is up ${pct}%`,
        `Your ${STOCK[id].name} shares are worth ₦${Math.round(value).toLocaleString("en-NG")}, ${times.toFixed(1)} times what you paid. ${moodOf(id, day) === "boom" ? "It is booming, and booms crash." : "Runs like this don't last."} Sell now?`,
        [
          { label: "Sell all now", id: `stock-sell:${id}` },
          { label: "Sell half", id: `stock-half:${id}` },
          { label: "Hold", id: "ok" },
        ],
      );
    }
  }
  // The talk of the market: a share starting a boom, held or not.
  for (const st of STOCKS)
    if (moodOf(st.id, day) === "boom" && moodOf(st.id, day - 1) !== "boom") log(s, `Market gist: everyone is talking about ${st.name}. ${st.id} jumped ${Math.round(changeOver(st.id, day, 1) * 100)}% today.`);
}

/** Mutates s: the answer to a share notice: sell all of it, or half. */
export function resolveStock(s: GameState, choice: string) {
  const [kind, id] = choice.split(":");
  const h = s.bank.shares[id];
  if (!h) return;
  const qty = kind === "stock-half" ? Math.max(1, Math.floor(h.qty / 2)) : h.qty;
  const r = bankOp(s, { op: "sell", id, qty });
  if ("error" in r) return;
  Object.assign(s, r.state);
  s.toasts.push(`Sold ${qty.toLocaleString("en-NG")} ${id}`);
}

/** Kai, Klario's money assistant: one tip for where you are now. */
export function kaiTip(s: GameState): string {
  const b = s.bank;
  const day = dayNum(s.t);
  const hot = Object.keys(b.shares).find((id) => moodOf(id, day) === "boom" || moodOf(id, day) === "rally");
  if (hot) return `${hot} is running hot. Decide now how much you'll take off the table before it turns.`;
  const falling = Object.keys(b.shares).find((id) => moodOf(id, day) === "crash");
  if (falling) return `${falling} is falling. Selling into a crash locks the loss in; holding hopes it comes back. Your call.`;
  const week = breakdown(b, (day - 7) * 24 * 60);
  const top = week.spending[0];
  const made = week.income.reduce((n, [, v]) => n + v, 0);
  const spent = week.spending.reduce((n, [, v]) => n + v, 0);
  if (top && spent > made && made > 0) return `You spent more than you made this week, mostly on ${CAT_LABEL[top[0]].toLowerCase()}. Ease off a little.`;
  if (s.money > 50_000 && b.savings + goalsValue(b) < s.money / 4) return "Most of your money is sitting in your wallet. Move some into a goal: it earns interest every morning.";
  if (!b.goals.length) return "Set a goal: rent, a new phone, japa money. Money with a name on it is harder to spend.";
  return "Steady. Pay yourself first: save a little from every pay before you spend.";
}
