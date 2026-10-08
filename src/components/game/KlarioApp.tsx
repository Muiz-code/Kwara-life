"use client";
// Klario, your bank, dressed like the real Klario app (noir and caramel gold): what you have (wallet,
// savings, goals, deposits, shares), what you made and spent and on what, your full statement, savings
// goals, and a portfolio on the Lagos board with each holding's share of it. Kai, the money assistant,
// has one tip at a time. Opened from the phone app or at a branch.
import { useMemo, useState } from "react";
import { Flame, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import {
  CAT_LABEL, DEPOSIT_PLANS, MAX_GOALS, STOCK, STOCKS, TRADE_FEE, SAVE_RATE, breakdown, changeOver, depositValue, goalsValue, kaiTip, matures, moodOf, netWorth,
  payout, quote, sharePrice, sharesValue, type BankOp, type DepositPlanId, type Mood, type TxnCat,
} from "@/sim/bank";
import { dayNum, fmtTime, MIN_PER_DAY } from "@/sim/time";
import { getGameStore, useGame } from "@/store";
import { cx, naira } from "./ui";

// The real Klario's palette (kairo src/constants/colors.ts).
const K = {
  bg: "#08080A", sheet: "#0F0F13", card: "#131017", card2: "#1b1720", line: "rgba(193,154,107,0.16)",
  gold: "#C19A6B", goldLight: "#E6C989", cream: "#ECE6D8", dim: "#8b8071", green: "#4caf82", red: "#d9534f",
};
/** Allocation bar colours, one per holding. */
const SLICE = ["#C19A6B", "#4caf82", "#4a90d9", "#E6C989", "#d9534f", "#9b7fd1"];

type Tab = "home" | "history" | "save" | "invest";
const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "history", label: "History" },
  { id: "save", label: "Save" },
  { id: "invest", label: "Invest" },
];

const pct = (n: number) => `${n >= 0 ? "+" : ""}${Math.abs(n) >= 10 ? Math.round(n * 100).toLocaleString("en-NG") : (n * 100).toFixed(1)}%`;
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${naira(Math.abs(n))}`;
const tone = (n: number) => ({ color: n >= 0 ? K.green : K.red });

export function accountNumber(name: string) {
  return String(Array.from(name).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 1e10, 7)).padStart(10, "3");
}

/** The full app (smartphones and the branch). */
export default function KlarioApp() {
  const [tab, setTab] = useState<Tab>("home");
  const game = useGame((s) => s.game);
  const name = game.citizen?.name ?? game.char?.name ?? "You";
  const account = useMemo(() => accountNumber(name), [name]);
  return (
    <div className="-m-1 space-y-3 rounded-2xl p-3 text-sm" style={{ background: K.bg, color: K.cream }}>
      <div className="flex items-center justify-between">
        <span className="font-sign text-lg tracking-wide" style={{ color: K.goldLight }}>Klario</span>
        <span className="text-[11px]" style={{ color: K.dim }}>{name} · {account}</span>
      </div>
      <div className="rounded-2xl p-4" style={{ background: "#000", border: `1px solid ${K.line}` }}>
        <div className="text-[11px] uppercase tracking-widest" style={{ color: K.dim }}>Wallet</div>
        <div className="mt-0.5 font-sign text-3xl" style={{ color: K.cream }}>{naira(game.money)}</div>
        <div className="mt-1 text-xs" style={{ color: K.gold }}>Net worth {naira(netWorth(game))}</div>
      </div>
      <div className="grid grid-cols-4 gap-1 rounded-xl p-1 text-xs font-bold" style={{ background: K.card }} role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className="rounded-lg py-1.5" style={tab === t.id ? { background: K.gold, color: K.bg } : { color: K.dim }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "home" && <Overview />}
      {tab === "history" && <History />}
      {tab === "save" && <Save />}
      {tab === "invest" && <Invest />}
    </div>
  );
}

function Kai() {
  const game = useGame((s) => s.game);
  return (
    <div className="flex gap-2 rounded-xl p-2.5" style={{ background: "rgba(193,154,107,0.10)", border: `1px solid ${K.line}` }}>
      <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0" style={{ color: K.goldLight }} />
      <p className="text-xs">
        <b style={{ color: K.goldLight }}>Kai: </b>
        {kaiTip(game)}
      </p>
    </div>
  );
}

function Overview() {
  const game = useGame((s) => s.game);
  const b = game.bank;
  const day = dayNum(game.t);
  const week = breakdown(b, (day - 7) * MIN_PER_DAY);
  const all = breakdown(b);
  const madeWeek = week.income.reduce((s, [, n]) => s + n, 0);
  const spentWeek = week.spending.reduce((s, [, n]) => s + n, 0);
  const shares = Math.round(sharesValue(b, day));
  const cost = Object.values(b.shares).reduce((s, h) => s + h.cost, 0);
  const rows: [string, number][] = [
    ["Wallet", game.money],
    ["Klario Save", b.savings],
    ["Goals", goalsValue(b)],
    ["Fixed deposits", depositValue(b)],
    ["Shares", shares],
  ];
  return (
    <div className="space-y-3">
      <Kai />
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Made, all time" value={naira(b.earned)} good />
        <Stat label="Spent, all time" value={naira(b.spent)} />
        <Stat label="Made, last 7 days" value={naira(madeWeek)} good />
        <Stat label="Spent, last 7 days" value={naira(spentWeek)} />
      </div>
      <Section title="Where your money is">
        {rows.map(([k, v]) => (
          <Row key={k} label={k} value={naira(v)} />
        ))}
        {(cost > 0 || b.realized !== 0) && <Row label="Profit on shares" value={signed(shares - cost + b.realized)} n={shares - cost + b.realized} />}
      </Section>
      <Bars title="Where it came from" items={all.income} good />
      <Bars title="Where it went" items={all.spending} />
    </div>
  );
}

function History() {
  const txns = useGame((s) => s.game.bank.txns);
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");
  const list = txns.filter((x) => (filter === "all" ? true : filter === "in" ? x.amt > 0 : x.amt < 0));
  return (
    <div>
      <div className="mb-2 flex gap-1 text-xs font-bold">
        {(["all", "in", "out"] as const).map((f) => (
          <Chip key={f} on={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "in" ? "Money in" : "Money out"}
          </Chip>
        ))}
      </div>
      {list.length ? (
        <ul>
          {list.map((x) => (
            <li key={x.n} className="flex items-start justify-between gap-2 py-1.5" style={{ borderBottom: `1px solid ${K.line}` }}>
              <span>
                <span className="block font-semibold">{x.label}</span>
                <span className="text-[11px]" style={{ color: K.dim }}>
                  Day {dayNum(x.t)}, {fmtTime(x.t)} · {CAT_LABEL[x.cat]}
                  {x.acct === "save" ? " · into savings" : ""}
                </span>
              </span>
              <span className="shrink-0 font-bold tabular-nums" style={tone(x.amt)}>{signed(x.amt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: K.dim }}>No transactions yet.</p>
      )}
    </div>
  );
}

function Save() {
  const game = useGame((s) => s.game);
  const b = game.bank;
  const [amt, setAmt] = useState("");
  const [plan, setPlan] = useState<DepositPlanId>("week");
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const run = useOp();
  const n = num(amt);
  return (
    <div className="space-y-3">
      <Section title={`Goals · ${Math.round(SAVE_RATE * 100)}% a year while you save`}>
        {b.goals.map((g) => {
          const done = Math.min(1, g.saved / g.target);
          return (
            <div key={g.id} className="py-1.5" style={{ borderBottom: `1px solid ${K.line}` }}>
              <div className="flex justify-between">
                <b>{g.name}</b>
                <span className="tabular-nums" style={{ color: K.dim }}>{naira(g.saved)} / {naira(g.target)}</span>
              </div>
              <div className="my-1 h-1.5 rounded-full" style={{ background: K.card2 }}>
                <div className="h-1.5 rounded-full" style={{ width: `${Math.max(3, done * 100)}%`, background: done >= 1 ? K.green : K.gold }} />
              </div>
              <div className="flex gap-1.5">
                <GoldButton small onClick={() => run.go({ op: "fund", id: g.id, amt: n })}>Add {n ? naira(n) : "amount below"}</GoldButton>
                <GhostButton small onClick={() => run.go({ op: "cashout", id: g.id })}>{done >= 1 ? "Cash out" : "Close goal"}</GhostButton>
              </div>
            </div>
          );
        })}
        {b.goals.length < MAX_GOALS && (
          <div className="mt-2 grid grid-cols-[1fr_7rem_auto] gap-1.5">
            <Input value={goalName} onChange={setGoalName} label="Goal name" placeholder="New goal: rent, a phone…" />
            <Input value={goalTarget} onChange={setGoalTarget} label="Target in naira" placeholder="Target ₦" numeric />
            <GoldButton small onClick={() => { if (!run.go({ op: "goal", name: goalName, target: num(goalTarget) })) { setGoalName(""); setGoalTarget(""); } }}>Add</GoldButton>
          </div>
        )}
      </Section>
      <Section title="Amount">
        <Input value={amt} onChange={setAmt} label="Amount in naira" placeholder="Amount (₦), for Save, goals and deposits" numeric />
      </Section>
      <Section title={`Klario Save · ${Math.round(SAVE_RATE * 100)}% a year, take it out any time`}>
        <div className="font-sign text-2xl">{naira(b.savings)}</div>
        <div className="mt-2 flex gap-2">
          <GoldButton small onClick={() => run.go({ op: "save", amt: n })}>Save</GoldButton>
          <GhostButton small onClick={() => run.go({ op: "unsave", amt: n })}>Withdraw</GhostButton>
        </div>
      </Section>
      <Section title="Fixed deposit: lock it away for a better rate">
        <div className="flex gap-2">
          {(Object.keys(DEPOSIT_PLANS) as DepositPlanId[]).map((id) => {
            const p = DEPOSIT_PLANS[id];
            return (
              <button key={id} type="button" onClick={() => setPlan(id)} aria-pressed={plan === id} className="flex-1 rounded-xl p-2 text-left text-xs" style={{ border: `2px solid ${plan === id ? K.gold : K.line}` }}>
                <span className="block font-bold">{p.days} days · {Math.round(p.rate * 100)}% a year</span>
                <span style={{ color: K.dim }}>From {naira(p.min)}</span>
              </button>
            );
          })}
        </div>
        <GoldButton small className="mt-2" onClick={() => run.go({ op: "deposit", amt: n, plan })}>Lock {n ? naira(n) : "it"} for {DEPOSIT_PLANS[plan].days} days</GoldButton>
        {b.deposits.map((d) => {
          const left = Math.max(0, Math.ceil((matures(d) - game.t) / MIN_PER_DAY));
          return (
            <div key={d.id} className="mt-2 flex items-center justify-between gap-2">
              <span>
                <span className="block font-semibold">{naira(d.amt)} → {naira(payout(d))}</span>
                <span className="text-[11px]" style={{ color: K.dim }}>{DEPOSIT_PLANS[d.plan].label} · matures in {left} day{left === 1 ? "" : "s"}</span>
              </span>
              <GhostButton small onClick={() => run.go({ op: "break", id: d.id })}>Break</GhostButton>
            </div>
          );
        })}
      </Section>
      {run.msg && <p className="text-xs font-semibold" style={{ color: K.red }} role="alert">{run.msg}</p>}
    </div>
  );
}

const MOOD: Record<Mood, { label: string; icon: typeof Flame | null; color: string }> = {
  calm: { label: "", icon: null, color: K.dim },
  rally: { label: "Rallying", icon: TrendingUp, color: K.green },
  boom: { label: "Booming", icon: Flame, color: "#FF8A3D" },
  crash: { label: "Crashing", icon: TrendingDown, color: K.red },
};

function Invest() {
  const game = useGame((s) => s.game);
  const b = game.bank;
  const day = dayNum(game.t);
  const [pick, setPick] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  const run = useOp();
  const q = num(qty);
  // The portfolio: each holding's value, its share of the whole, its gain.
  const held = Object.entries(b.shares).map(([id, h]) => {
    const value = h.qty * sharePrice(id, day);
    return { id, h, value, gain: value - h.cost, gainPct: h.cost ? value / h.cost - 1 : 0 };
  });
  const total = held.reduce((s, x) => s + x.value, 0);
  const cost = held.reduce((s, x) => s + x.h.cost, 0);
  return (
    <div className="space-y-3">
      <Kai />
      {held.length > 0 && (
        <Section title="Your portfolio">
          <div className="flex items-end justify-between">
            <span className="font-sign text-2xl">{naira(Math.round(total))}</span>
            <span className="text-xs font-bold" style={tone(total - cost)}>
              {signed(Math.round(total - cost))} ({pct(cost ? total / cost - 1 : 0)})
            </span>
          </div>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full" style={{ background: K.card2 }} aria-label="How your portfolio is split">
            {held.map((x, i) => (
              <div key={x.id} style={{ width: `${(x.value / total) * 100}%`, background: SLICE[i % SLICE.length] }} title={`${x.id} ${Math.round((x.value / total) * 100)}%`} />
            ))}
          </div>
          <ul className="mt-2">
            {held.map((x, i) => (
              <li key={x.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 py-1.5" style={{ borderBottom: `1px solid ${K.line}` }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SLICE[i % SLICE.length] }} />
                <span>
                  <b>{x.id}</b> <span style={{ color: K.dim }}>{Math.round((x.value / total) * 100)}% of portfolio</span>
                  <span className="block text-[11px]" style={{ color: K.dim }}>
                    {x.h.qty.toLocaleString("en-NG")} shares · paid {naira(x.h.cost / x.h.qty)} avg · now {naira(sharePrice(x.id, day))}
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="block font-semibold">{naira(Math.round(x.value))}</span>
                  <span className="text-[11px] font-bold" style={tone(x.gain)}>{pct(x.gainPct)}</span>
                </span>
                <span />
                <span className="col-span-2 flex gap-1.5">
                  {([[0.25, "Sell 25%"], [0.5, "Sell 50%"], [1, "Sell all"]] as const).map(([f, label]) => (
                    <GhostButton key={label} small onClick={() => run.go({ op: "sell", id: x.id, qty: f === 1 ? x.h.qty : Math.max(1, Math.floor(x.h.qty * f)) })}>{label}</GhostButton>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          {b.realized !== 0 && <Row label="Profit from shares sold" value={signed(b.realized)} n={b.realized} />}
        </Section>
      )}
      <Section title={`The Lagos board · prices move daily · ${Math.round(TRADE_FEE * 100)}% fee a trade`}>
        <ul>
          {STOCKS.map((st) => {
            const qt = quote(st.id, day);
            const week = changeOver(st.id, day, 7);
            const mood = MOOD[moodOf(st.id, day)];
            const Icon = mood.icon;
            const h = b.shares[st.id];
            const open = pick === st.id;
            return (
              <li key={st.id} className="py-1.5" style={{ borderBottom: `1px solid ${K.line}` }}>
                <button type="button" onClick={() => setPick(open ? null : st.id)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-left">
                  <span>
                    <span className="flex items-center gap-1.5 font-bold">
                      {st.id}
                      {Icon && (
                        <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 text-[10px]" style={{ color: mood.color, background: `${mood.color}22` }}>
                          <Icon aria-hidden className="h-3 w-3" /> {mood.label}
                        </span>
                      )}
                    </span>
                    <span className="text-[11px]" style={{ color: K.dim }}>{st.name}{h ? ` · you own ${h.qty.toLocaleString("en-NG")}` : ""}</span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block font-semibold">{naira(qt.now)}</span>
                    <span className="text-[11px] font-bold" style={tone(qt.change)}>{pct(qt.change)} today</span>
                    <span className="block text-[10px]" style={tone(week)}>{pct(week)} this week</span>
                  </span>
                </button>
                {open && (
                  <div className="mt-2 rounded-xl p-2" style={{ background: K.card }}>
                    <Input value={qty} onChange={setQty} label="How many shares" placeholder="How many shares" numeric />
                    {q > 0 && (
                      <p className="mt-1 text-[11px]" style={{ color: K.dim }}>
                        About {naira(Math.round(q * qt.now * (1 + TRADE_FEE)))} to buy{h ? `, ${naira(Math.round(Math.min(q, h.qty) * qt.now * (1 - TRADE_FEE)))} if you sell` : ""}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <GoldButton small onClick={() => run.go({ op: "buy", id: st.id, qty: q })}>Buy</GoldButton>
                      {h && <GhostButton small onClick={() => run.go({ op: "sell", id: st.id, qty: q })}>Sell</GhostButton>}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px]" style={{ color: K.dim }}>
          Now and then a share booms, thousands of percent in a week, and every boom crashes. Klario tells you when yours multiply. Made-up companies; not real investment advice.
        </p>
      </Section>
      {run.msg && <p className="text-xs font-semibold" style={{ color: K.red }} role="alert">{run.msg}</p>}
    </div>
  );
}

const num = (v: string) => Number(v.replace(/[^\d]/g, ""));

/** Run a banking operation; returns the error (also shown), or null when it went through. */
function useOp() {
  const [msg, setMsg] = useState<string | null>(null);
  return {
    msg,
    go: (op: BankOp) => {
      const e = getGameStore().getState().banking(op);
      setMsg(e);
      return e;
    },
  };
}

function Input({ value, onChange, label, placeholder, numeric }: { value: string; onChange: (v: string) => void; label: string; placeholder: string; numeric?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode={numeric ? "numeric" : "text"}
      placeholder={placeholder}
      aria-label={label}
      className="w-full rounded-lg px-2 py-1.5 outline-none"
      style={{ background: K.card2, color: K.cream, border: `1px solid ${K.line}` }}
    />
  );
}

function GoldButton({ children, onClick, small, className }: { children: React.ReactNode; onClick: () => void; small?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cx("rounded-lg font-bold", small ? "px-2.5 py-1 text-xs" : "px-3 py-2", className)} style={{ background: K.gold, color: K.bg }}>
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, small }: { children: React.ReactNode; onClick: () => void; small?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cx("rounded-lg font-bold", small ? "px-2.5 py-1 text-xs" : "px-3 py-2")} style={{ border: `1px solid ${K.line}`, color: K.goldLight }}>
      {children}
    </button>
  );
}

function Chip({ children, on, onClick }: { children: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className="rounded-full px-3 py-1" style={on ? { background: K.gold, color: K.bg } : { background: K.card, color: K.dim }}>
      {children}
    </button>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl p-2" style={{ background: K.card }}>
      <div className="text-[11px]" style={{ color: K.dim }}>{label}</div>
      <div className="font-bold tabular-nums" style={{ color: good ? K.green : K.red }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-2.5" style={{ background: K.sheet, border: `1px solid ${K.line}` }}>
      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: K.gold }}>{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value, n }: { label: string; value: string; n?: number }) {
  return (
    <div className="flex justify-between py-0.5">
      <span>{label}</span>
      <span className="font-semibold tabular-nums" style={n === undefined ? undefined : tone(n)}>{value}</span>
    </div>
  );
}

function Bars({ title, items, good }: { title: string; items: [TxnCat, number][]; good?: boolean }) {
  if (!items.length) return null;
  const top = items[0][1];
  return (
    <Section title={title}>
      {items.slice(0, 6).map(([cat, n]) => (
        <div key={cat} className="py-0.5">
          <div className="flex justify-between text-xs">
            <span>{CAT_LABEL[cat]}</span>
            <span className="tabular-nums">{naira(n)}</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: K.card2 }}>
            <div className="h-1.5 rounded-full" style={{ width: `${Math.max(4, (n / top) * 100)}%`, background: good ? K.green : K.gold }} />
          </div>
        </div>
      ))}
    </Section>
  );
}

/** The keypad phone's USSD menu: *901#. */
export function KlarioUssd() {
  const game = useGame((s) => s.game);
  const name = game.citizen?.name ?? game.char?.name ?? "You";
  const b = game.bank;
  const day = dayNum(game.t);
  const [screen, setScreen] = useState<"menu" | "bal" | "mini" | "save" | "shares">("menu");
  const [msg, setMsg] = useState<string | null>(null);
  const go = (op: BankOp) => setMsg(getGameStore().getState().banking(op) ?? "Done. Thank you for banking with Klario.");
  return (
    <div className="font-mono text-sm">
      <p>Klario *901#</p>
      <p>Acct {accountNumber(name)}</p>
      {screen === "menu" && (
        <div className="mt-1 space-y-0.5">
          {([["bal", "1. Balance"], ["mini", "2. Mini statement"], ["save", "3. Klario Save"], ["shares", "4. My shares"]] as const).map(([id, label]) => (
            <button key={id} type="button" className="block hover:underline" onClick={() => setScreen(id)}>{label}</button>
          ))}
        </div>
      )}
      {screen === "bal" && (
        <div className="mt-1">
          <p>Wallet: {naira(game.money)}</p>
          <p>Save: {naira(b.savings)}</p>
          <p>Made: {naira(b.earned)}</p>
          <p>Spent: {naira(b.spent)}</p>
        </div>
      )}
      {screen === "mini" && (
        <ul className="mt-1">
          {b.txns.slice(0, 5).map((x) => (
            <li key={x.n}>{signed(x.amt)} {x.label.slice(0, 22)}</li>
          ))}
          {!b.txns.length && <li>No transactions</li>}
        </ul>
      )}
      {screen === "save" && (
        <div className="mt-1 space-y-0.5">
          <p>Save bal: {naira(b.savings)}</p>
          <button type="button" className="block hover:underline" onClick={() => go({ op: "save", amt: Math.min(game.money, 5000) })}>1. Save {naira(Math.min(game.money, 5000))}</button>
          <button type="button" className="block hover:underline" onClick={() => go({ op: "unsave", amt: b.savings })}>2. Withdraw all</button>
          {msg && <p>{msg}</p>}
        </div>
      )}
      {screen === "shares" && (
        <ul className="mt-1">
          {Object.entries(b.shares).map(([id, h]) => (
            <li key={id}>
              {id} x{h.qty} {pct(h.cost ? (h.qty * sharePrice(id, day)) / h.cost - 1 : 0)}
            </li>
          ))}
          {!Object.keys(b.shares).length && <li>No shares. Buy on a smartphone or at a branch.</li>}
          {Object.keys(b.shares).map((id) => (
            <li key={`s-${id}`}>
              <button type="button" className="hover:underline" onClick={() => go({ op: "sell", id, qty: b.shares[id].qty })}>Sell all {STOCK[id].id}</button>
            </li>
          ))}
          {msg && <li>{msg}</li>}
        </ul>
      )}
      {screen !== "menu" && (
        <button type="button" className="mt-1 block hover:underline" onClick={() => { setScreen("menu"); setMsg(null); }}>0. Back</button>
      )}
    </div>
  );
}
