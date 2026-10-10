"use client";
// The admin panel (docs/DECISIONS.md, "Admin panel"): the live dashboard, reports, players' notes, sponsored news,
// the announcement and the log. It signs in with the game's own account; the server decides who is an admin.
// Results are watch-only: the panel links to the public board and has no way to change a vote.
import { BarChart3, Bell, CalendarClock, Flag, LayoutDashboard, Megaphone, MessageSquareText, ScrollText, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { electionDayLabel, pollHoursLabel } from "@/data/calendar";
import { STATE } from "@/data/states";
import { ZONES, type ZoneCode } from "@/data/zones";
import { supabase } from "@/net/supabase";
import { Button, cx } from "../game/ui";

type Role = "owner" | "moderator";
type Tab = "dashboard" | "reports" | "notes" | "sponsored" | "announce" | "election" | "team" | "log";

async function token(): Promise<string | null> {
  return (await supabase()?.auth.getSession())?.data.session?.access_token ?? null;
}

async function call<T>(path: string, body?: unknown): Promise<{ data?: T; error?: string; status: number }> {
  const t = await token();
  const r = await fetch(`/api/admin/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  }).catch(() => null);
  if (!r) return { error: "No connection", status: 0 };
  const j = await r.json().catch(() => ({}));
  return r.ok ? { data: j as T, status: r.status } : { error: j.error ?? "Try again", status: r.status };
}

/** Load something from the admin API, and again every `every` ms (0 = once). */
function useAdmin<T>(path: string, every = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await call<T>(path);
    if (r.data) setData(r.data);
    setError(r.error ?? null);
  }, [path]);
  useEffect(() => {
    void load(); // eslint-disable-line react-hooks/set-state-in-effect -- loading data on mount
    if (!every) return;
    const id = setInterval(() => void load(), every);
    return () => clearInterval(id);
  }, [load, every]);
  return { data, error, reload: load };
}

export function AdminPanel() {
  const [role, setRole] = useState<Role | null | "none" | "signed-out">(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  useEffect(() => {
    void (async () => {
      if (!(await token())) return setRole("signed-out");
      const r = await call<{ role: Role }>("me");
      setRole(r.data?.role ?? "none");
    })();
  }, []);

  if (role === null) return <Shell>Loading…</Shell>;
  if (role === "signed-out")
    return (
      <Shell>
        <p className="mb-3">Sign in to the game first, then come back here.</p>
        <Link href="/" className="font-bold underline">
          Go to the game
        </Link>
      </Shell>
    );
  if (role === "none") return <Shell>Not found.</Shell>;

  const tabs: [Tab, string, LucideIcon, boolean][] = [
    ["dashboard", "Dashboard", LayoutDashboard, true],
    ["reports", "Reports", Flag, true],
    ["notes", "Player notes", MessageSquareText, true],
    ["sponsored", "Sponsored news", Megaphone, true],
    ["announce", "Announcement", Bell, role === "owner"],
    ["election", "Election", CalendarClock, role === "owner"],
    ["team", "Team", Users, role === "owner"],
    ["log", "Log", ScrollText, role === "owner"],
  ];
  const item = "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold whitespace-nowrap";
  return (
    <div className="flex min-h-dvh flex-col bg-page text-ink md:flex-row">
      {/* The sidebar: down the left on a computer, a scrolling bar along the top on a phone. */}
      <aside className="sticky top-0 z-10 flex shrink-0 flex-col gap-1 bg-[#141B33] p-2 text-[#F7E7C1] md:h-dvh md:w-60 md:p-4">
        <div className="mb-1 hidden md:block">
          <div className="font-sign text-2xl leading-none">Naija Votes</div>
          <div className="mt-1 flex items-center gap-2 text-xs opacity-80">
            Admin <span className="rounded-full bg-[#F2B705] px-2 py-0.5 font-bold text-[#141B33] capitalize">{role}</span>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto md:mt-3 md:flex-col md:overflow-visible" aria-label="Admin sections">
          {tabs
            .filter(([, , , show]) => show)
            .map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={cx(item, tab === id ? "bg-[#F2B705] text-[#141B33]" : "hover:bg-white/10")}
              >
                <Icon aria-hidden className="h-4 w-4" />
                {label}
              </button>
            ))}
          <a href="/results" target="_blank" rel="noopener" className={cx(item, "hover:bg-white/10 md:mt-3")}>
            <BarChart3 aria-hidden className="h-4 w-4" />
            Live results ↗
          </a>
        </nav>
        <p className="mt-auto hidden text-[11px] leading-snug opacity-60 md:block">
          Results are watch-only for every role. Nothing here can change a vote. Every action is logged.
        </p>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-4 font-sign text-3xl">{tabs.find(([id]) => id === tab)?.[1]}</h1>
          {tab === "dashboard" && <Dashboard />}
          {tab === "reports" && <Reports />}
          {tab === "notes" && <Notes />}
          {tab === "sponsored" && <Sponsored />}
          {tab === "announce" && <Announce />}
          {tab === "election" && <Election />}
          {tab === "team" && <Team />}
          {tab === "log" && <Log />}
          <p className="mt-8 text-xs text-ink-soft md:hidden">
            Results are watch-only for every role. Nothing here can change a vote. Every action is logged.
          </p>
        </div>
      </main>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-page p-6 text-ink">
      <div className="max-w-sm rounded-3xl bg-panel p-6 text-center shadow">{children}</div>
    </main>
  );
}

interface Stats {
  accounts: number;
  confirmed: number;
  signups_today: number;
  citizens: number;
  active_15m: number;
  active_24h: number;
  pvcs: number;
  voted: number;
  by_zone: Record<string, number>;
  by_state: Record<string, number>;
  votes_by_hour: Record<string, number>;
  reports_week: number;
  banned: number;
  cards_today: number;
  promos_today: number;
}

const fmt = (n: number | undefined) => (n ?? 0).toLocaleString("en-NG");

function Dashboard() {
  const { data: s, error } = useAdmin<Stats>("stats", 30_000);
  if (!s) return <p>{error ?? "Loading…"}</p>;
  const tiles: [string, number, string?][] = [
    ["Accounts", s.accounts, `${fmt(s.confirmed)} confirmed`],
    ["Signed up today", s.signups_today],
    ["Citizens", s.citizens],
    ["Playing now", s.active_15m, "saved in the last 15 minutes"],
    ["Played today", s.active_24h, "in the last 24 hours"],
    ["PVCs collected", s.pvcs],
    ["Voted", s.voted, "counts only, never who for"],
    ["Reports this week", s.reports_week, `${fmt(s.banned)} banned`],
    ["Cards and promos today", s.cards_today + s.promos_today, `${fmt(s.cards_today)} cards, ${fmt(s.promos_today)} promos`],
  ];
  const zones = Object.entries(s.by_zone).sort((a, b) => b[1] - a[1]);
  const zoneMax = Math.max(1, ...zones.map(([, n]) => n));
  const states = Object.entries(s.by_state).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const hours = Object.entries(s.votes_by_hour).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  const hourMax = Math.max(1, ...hours.map(([, n]) => n));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map(([label, n, sub]) => (
          <div key={label} className="rounded-2xl bg-panel p-3">
            <div className="text-xs font-bold tracking-wide text-ink-soft uppercase">{label}</div>
            <div className="font-sign text-3xl tabular-nums">{fmt(n)}</div>
            {sub && <div className="text-xs text-ink-soft">{sub}</div>}
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl bg-panel p-3">
          <h2 className="mb-2 font-bold">Citizens by zone</h2>
          {zones.length ? (
            zones.map(([z, n]) => (
              <div key={z} className="mb-1.5 grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-sm">
                <span>{ZONES[z as ZoneCode] ?? z}</span>
                <span className="h-2.5 rounded-full bg-panel-2">
                  <span className="block h-full rounded-full bg-[#0E7A4B]" style={{ width: `${(n / zoneMax) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">{fmt(n)}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink-soft">No citizens yet.</p>
          )}
        </section>
        <section className="rounded-2xl bg-panel p-3">
          <h2 className="mb-2 font-bold">Top states</h2>
          {states.length ? (
            <ol className="text-sm">
              {states.map(([st, n]) => (
                <li key={st} className="flex justify-between border-b border-line py-1 last:border-0">
                  <span>{STATE[st]?.name ?? st}</span>
                  <span className="tabular-nums">{fmt(n)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ink-soft">No citizens yet.</p>
          )}
        </section>
      </div>
      <section className="rounded-2xl bg-panel p-3">
        <h2 className="mb-2 font-bold">Votes by hour (WAT)</h2>
        {hours.length ? (
          <div className="flex h-32 items-end gap-1">
            {hours.map(([h, n]) => (
              <div key={h} className="flex flex-1 flex-col items-center gap-1" title={`${h}: ${fmt(n)}`}>
                <span className="text-[10px] tabular-nums">{fmt(n)}</span>
                <span className="w-full rounded-t bg-indigo" style={{ height: `${(n / hourMax) * 90}px` }} />
                <span className="text-[10px] text-ink-soft">{h.slice(11, 13)}h</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">No votes yet. Polls open {pollHoursLabel().split(" to ")[0]} on {electionDayLabel().replace(/ d{4}$/, "")}.</p>
        )}
      </section>
      <p className="text-xs text-ink-soft">Refreshes every 30 seconds.</p>
    </div>
  );
}

interface Report {
  id: number;
  reason: string;
  at: string;
  reporter: { id: string; name: string };
  reported: { id: string; name: string; banned: boolean; reports: number };
}

const when = (iso: string) => new Date(iso).toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });

function BanButton({ user, name, banned, onDone }: { user: string; name: string; banned: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <Button
        tone={banned ? "ghost" : undefined}
        className={cx("!px-3 !py-1 text-xs", !banned && "!bg-danger !text-white")}
        disabled={busy}
        onClick={async () => {
          if (!banned && !window.confirm(`Ban ${name}? They will not be able to sign in again.`)) return;
          setBusy(true);
          const r = await call(banned ? "unban" : "ban", { user, reason: "From the admin panel" });
          setBusy(false);
          setMsg(r.error ?? null);
          if (!r.error) onDone();
        }}
      >
        {banned ? "Lift ban" : "Ban"}
      </Button>
      {msg && <span className="text-xs text-danger">{msg}</span>}
    </span>
  );
}

function Reports() {
  const { data, error, reload } = useAdmin<Report[]>("reports");
  if (!data) return <p>{error ?? "Loading…"}</p>;
  if (!data.length) return <p className="rounded-2xl bg-panel p-4">No reports. All quiet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {data.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-panel p-3 text-sm">
          <div>
            <b>{r.reported.name}</b> reported by {r.reporter.name}: <i>{r.reason}</i>
            <div className="text-xs text-ink-soft">
              {when(r.at)} · reported {r.reported.reports} time{r.reported.reports === 1 ? "" : "s"} recently
            </div>
          </div>
          <BanButton user={r.reported.id} name={r.reported.name} banned={r.reported.banned} onDone={reload} />
        </li>
      ))}
    </ul>
  );
}

function HideButton({ kind, id, hidden, onDone }: { kind: "card" | "promo"; id: number; hidden: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      tone="ghost"
      className="!px-3 !py-1 text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await call("hide", { kind, id, hidden: !hidden });
        setBusy(false);
        onDone();
      }}
    >
      {hidden ? "Show again" : "Hide"}
    </Button>
  );
}

interface Card {
  id: number;
  note: string;
  party: string;
  issues: string[];
  lga_code: string;
  created_at: string;
  hidden: boolean;
  by: string;
  user: string | null;
  banned: boolean;
}

function Notes() {
  const { data, error, reload } = useAdmin<Card[]>("cards");
  if (!data) return <p>{error ?? "Loading…"}</p>;
  if (!data.length) return <p className="rounded-2xl bg-panel p-4">No notes on support cards yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {data.map((c) => (
        <li key={c.id} className={cx("flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-panel p-3 text-sm", c.hidden && "opacity-55")}>
          <div className="min-w-0">
            <p className="font-semibold">&ldquo;{c.note}&rdquo;</p>
            <div className="text-xs text-ink-soft">
              {c.by} · {c.party} · {c.lga_code} · {when(c.created_at)}
              {c.hidden && " · hidden"}
            </div>
          </div>
          <span className="flex gap-2">
            <HideButton kind="card" id={c.id} hidden={c.hidden} onDone={reload} />
            {c.user && <BanButton user={c.user} name={c.by} banned={c.banned} onDone={reload} />}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface Promo {
  id: number;
  kind: string;
  option: number;
  party: string;
  lga_code: string;
  price: number;
  day: string;
  created_at: string;
  hidden: boolean;
  by: string;
}

function Sponsored() {
  const { data, error, reload } = useAdmin<Promo[]>("promos");
  if (!data) return <p>{error ?? "Loading…"}</p>;
  if (!data.length) return <p className="rounded-2xl bg-panel p-4">No flyers or sponsored news yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {data.map((p) => (
        <li key={p.id} className={cx("flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-panel p-3 text-sm", p.hidden && "opacity-55")}>
          <div>
            <b className="capitalize">{p.kind}</b> for {p.party} by {p.by}
            <div className="text-xs text-ink-soft">
              {p.lga_code} · ₦{p.price.toLocaleString("en-NG")} in-game · {when(p.created_at)}
              {p.hidden && " · hidden"}
            </div>
          </div>
          <HideButton kind="promo" id={p.id} hidden={p.hidden} onDone={reload} />
        </li>
      ))}
    </ul>
  );
}

function Announce() {
  const [text, setText] = useState("");
  const [hours, setHours] = useState("24");
  const [msg, setMsg] = useState<string | null>(null);
  const post = async (clear: boolean) => {
    const r = clear ? await call("unannounce", {}) : await call("announce", { text, hours: Number(hours) });
    setMsg(r.error ?? (clear ? "Announcement removed." : "Posted. Players see it within a few minutes."));
    if (!r.error && !clear) setText("");
  };
  return (
    <section className="max-w-xl rounded-2xl bg-panel p-4">
      <h2 className="mb-1 font-bold">Announcement for every player</h2>
      <p className="mb-3 text-sm text-ink-soft">One line at the front of the news ticker, up to 80 characters. Same filter as players&apos; notes: no links.</p>
      <input
        value={text}
        maxLength={80}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. PVC collection closes Friday at 6pm. Don't miss it!"
        className="w-full rounded-xl border border-line bg-panel-2 px-3 py-2.5"
      />
      <div className="mt-1 text-right text-xs text-ink-soft">{text.length}/80</div>
      <label className="mt-2 flex items-center gap-2 text-sm">
        Show for
        <select value={hours} onChange={(e) => setHours(e.target.value)} className="rounded-lg border border-line bg-panel-2 px-2 py-1">
          <option value="6">6 hours</option>
          <option value="24">1 day</option>
          <option value="72">3 days</option>
          <option value="0">until removed</option>
        </select>
      </label>
      <div className="mt-3 flex gap-2">
        <Button disabled={!text.trim()} onClick={() => void post(false)}>
          Post
        </Button>
        <Button tone="ghost" onClick={() => void post(true)}>
          Remove current
        </Button>
      </div>
      {msg && <p className="mt-2 text-sm font-semibold">{msg}</p>}
    </section>
  );
}

interface LogRow {
  id: number;
  admin: string;
  action: string;
  target: string;
  at: string;
}

function Log() {
  const { data, error } = useAdmin<LogRow[]>("log");
  if (!data) return <p>{error ?? "Loading…"}</p>;
  if (!data.length) return <p className="rounded-2xl bg-panel p-4">Nothing yet.</p>;
  return (
    <table className="w-full rounded-2xl bg-panel text-sm">
      <tbody>
        {data.map((r) => (
          <tr key={r.id} className="border-b border-line last:border-0">
            <td className="p-2 whitespace-nowrap text-ink-soft">{when(r.at)}</td>
            <td className="p-2">{r.admin}</td>
            <td className="p-2 font-bold">{r.action}</td>
            <td className="max-w-xs truncate p-2 text-ink-soft">{r.target}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface SettingsView {
  paused: boolean;
  pauseMessage: string;
  calendar: { registrationClose: string; pvcAnnouncement: string; pvcCollectionClose: string; pollsOpen: string; pollsClose: string };
  updatedAt: string | null;
}

/** "2026-11-14" and "08:00" in WAT, for the date and time inputs. */
const watParts = (iso: string) => {
  const d = new Date(Date.parse(iso) + 3_600_000).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
};

function Election() {
  const { data, error, reload } = useAdmin<SettingsView>("settings");
  const [date, setDate] = useState("");
  const [open, setOpen] = useState("08:00");
  const [close, setClose] = useState("16:00");
  const [pauseMsg, setPauseMsg] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  // Fill the form from the dates in force, once they arrive (and again after a change).
  if (data && seen !== data.calendar.pollsOpen + data.calendar.pollsClose) {
    setSeen(data.calendar.pollsOpen + data.calendar.pollsClose);
    setDate(watParts(data.calendar.pollsOpen).date);
    setOpen(watParts(data.calendar.pollsOpen).time);
    setClose(watParts(data.calendar.pollsClose).time);
  }
  if (!data) return <p>{error ?? "Loading…"}</p>;
  const c = data.calendar;
  const at = (iso: string) => new Date(iso).toLocaleString("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const move = async () => {
    const pollsOpen = `${date}T${open}:00+01:00`;
    const pollsClose = `${date}T${close}:00+01:00`;
    const label = new Date(pollsOpen).toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "full", timeStyle: "short" });
    if (!window.confirm(`Move election day to ${label}? Every player's calendar follows within a minute.`)) return;
    setBusy(true);
    const r = await call("calendar", { pollsOpen, pollsClose });
    setBusy(false);
    setMsg(r.error ?? "Moved. Players see the new dates within a minute.");
    if (!r.error) void reload();
  };
  const togglePause = async () => {
    if (!data.paused && !window.confirm("Pause the game for every player? Nobody can do anything until you resume.")) return;
    setBusy(true);
    const r = await call(data.paused ? "unpause" : "pause", { message: pauseMsg });
    setBusy(false);
    setMsg(r.error ?? (data.paused ? "Resumed. Players can play again within a minute." : "Paused. Players see the pause screen within a minute."));
    if (!r.error) void reload();
  };
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <section className="rounded-2xl bg-panel p-4">
        <h2 className="mb-2 font-bold">Dates in force</h2>
        <dl className="grid grid-cols-[11rem_1fr] gap-y-1 text-sm">
          <dt className="text-ink-soft">Registration closes</dt>
          <dd>{at(c.registrationClose)}</dd>
          <dt className="text-ink-soft">PVC collection</dt>
          <dd>
            {at(c.pvcAnnouncement)} to {at(c.pvcCollectionClose)}
          </dd>
          <dt className="text-ink-soft">Polls</dt>
          <dd className="font-bold">
            {at(c.pollsOpen)} to {at(c.pollsClose)}
          </dd>
        </dl>
      </section>
      <section className="rounded-2xl bg-panel p-4">
        <h2 className="mb-1 font-bold">Move election day</h2>
        <p className="mb-3 text-sm text-ink-soft">
          Only before polls open, and at least a day ahead. PVC collection closes 10 minutes before polls; registration and PVC collection move
          by the same amount unless they have passed. Words written into some screens (the welcome card, the share picture) keep the old date
          until they are updated.
        </p>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-line bg-panel-2 px-2 py-1.5" />
          </label>
          <label className="flex flex-col gap-1">
            Polls open
            <input type="time" value={open} onChange={(e) => setOpen(e.target.value)} className="rounded-lg border border-line bg-panel-2 px-2 py-1.5" />
          </label>
          <label className="flex flex-col gap-1">
            Polls close
            <input type="time" value={close} onChange={(e) => setClose(e.target.value)} className="rounded-lg border border-line bg-panel-2 px-2 py-1.5" />
          </label>
          <Button disabled={busy || !date} onClick={() => void move()}>
            Move election
          </Button>
        </div>
      </section>
      <section className={cx("rounded-2xl p-4", data.paused ? "bg-danger/15" : "bg-panel")}>
        <h2 className="mb-1 font-bold">Emergency pause {data.paused && <span className="text-danger">· ON</span>}</h2>
        <p className="mb-3 text-sm text-ink-soft">
          Freezes the whole game for every player, for an outage or abuse. Players see a pause screen; nothing they do is lost. It never opens or
          closes polls and never touches a vote.
        </p>
        {!data.paused && (
          <input
            value={pauseMsg}
            maxLength={120}
            onChange={(e) => setPauseMsg(e.target.value)}
            placeholder="Optional message, e.g. We are fixing a problem. Back in 30 minutes."
            className="mb-3 w-full rounded-xl border border-line bg-panel-2 px-3 py-2"
          />
        )}
        {data.paused && data.pauseMessage && <p className="mb-3 text-sm italic">&ldquo;{data.pauseMessage}&rdquo;</p>}
        <Button className={cx(!data.paused && "!bg-danger !text-white")} disabled={busy} onClick={() => void togglePause()}>
          {data.paused ? "Resume the game" : "Pause the game"}
        </Button>
      </section>
      {msg && <p className="text-sm font-semibold">{msg}</p>}
    </div>
  );
}

interface Member {
  user_id: string;
  role: Role;
  added_at: string;
  email: string;
  name: string | null;
}

function Team() {
  const { data, error, reload } = useAdmin<Member[]>("team");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  if (!data) return <p>{error ?? "Loading…"}</p>;
  const add = async () => {
    const r = await call("add-moderator", { email });
    setMsg(r.error ?? `${email} is now a moderator. They open /admin after signing in.`);
    if (!r.error) {
      setEmail("");
      void reload();
    }
  };
  const remove = async (m: Member) => {
    if (!window.confirm(`Remove ${m.email} from the team?`)) return;
    const r = await call("remove-moderator", { user: m.user_id });
    setMsg(r.error ?? "Removed.");
    if (!r.error) void reload();
  };
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {data.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-panel p-3 text-sm">
            <div>
              <b>{m.email}</b>
              {m.name && <span className="text-ink-soft"> · in game: {m.name}</span>}
              <div className="text-xs text-ink-soft capitalize">
                {m.role} · since {when(m.added_at)}
              </div>
            </div>
            {m.role === "moderator" && (
              <Button tone="ghost" className="!px-3 !py-1 text-xs" onClick={() => void remove(m)}>
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      <section className="rounded-2xl bg-panel p-4">
        <h2 className="mb-1 font-bold">Add a moderator</h2>
        <p className="mb-3 text-sm text-ink-soft">
          They need a game account first. Moderators see the dashboard, reports, notes and sponsored news, and can hide and ban.
        </p>
        <div className="flex flex-wrap gap-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" className="min-w-0 flex-1 rounded-xl border border-line bg-panel-2 px-3 py-2" />
          <Button disabled={!email.includes("@")} onClick={() => void add()}>
            Add
          </Button>
        </div>
      </section>
      {msg && <p className="text-sm font-semibold">{msg}</p>}
    </div>
  );
}
