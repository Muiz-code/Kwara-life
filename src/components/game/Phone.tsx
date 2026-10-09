"use client";
// Your phone, as the phone you can afford. The Ìfẹ́ (the flagship) has the island at the top and a home
// screen of apps; the Tekna and Orisun are everyday smartphones; the Kpakpa is a keypad phone with menus,
// calls and USSD banking. Better phones are sold at the phone stalls (the market, or Taiwo Oke in Ilorin).
import { useEffect, useMemo, useState } from "react";
import {
  BatteryFull, BookOpen, Briefcase, Coins, IdCard, PhoneOff, ChevronLeft, Circle, Image as ImageIcon, Landmark, Newspaper, Phone as PhoneIcon,
  Flame, Layers, Settings, Signal, Square, User, Wifi, X, type LucideIcon,
} from "lucide-react";
import { CAREERS, EDUCATION_LABEL } from "@/data/careers";
import { LGA } from "@/data/geography";
import { PLACES } from "@/data/ilorin/places";
import { CLASS_LABEL } from "@/data/jobs";
import { FALL_DAYS, RISE_DAYS } from "@/sim/standing";
import { NEWS } from "@/data/media";
import { PHONES, phoneOf, type PhoneModel } from "@/data/phones";
import { HUSTLES } from "@/data/hustles";
import { EDUCATION_RANK } from "@/data/careers";
import { dayNum, fmtTime, modeBlockReason, openings, questionsFor, quoteTrip, worldT } from "@/sim";
import { getGameStore, useGame } from "@/store";
import { tripWorldFor } from "@/store/world";
import { Button, cx, naira } from "./ui";
import KlarioApp, { KlarioUssd } from "./KlarioApp";
import { JourneyPicker } from "./PlaceSheet";
import SyncApp from "./SyncApp";
import DailyApp from "./DailyApp";

type App = "journal" | "calls" | "gallery" | "ride" | "sync" | "daily" | "bank" | "news" | "jobs" | "me" | "about" | "hustle" | "vinec";

const APPS: { id: App; label: string; icon: LucideIcon; tint: string }[] = [
  { id: "journal", label: "Journal", icon: BookOpen, tint: "from-[#F2B705] to-[#E67E22]" },
  { id: "calls", label: "Phone", icon: PhoneIcon, tint: "from-[#2ECC71] to-[#1E9E55]" },
  { id: "gallery", label: "Gallery", icon: ImageIcon, tint: "from-[#FF7AA2] to-[#C2578A]" },
  { id: "sync", label: "Sync", icon: Layers, tint: "from-[#2B2F36] to-[#111418]" },
  { id: "daily", label: "Daily", icon: Flame, tint: "from-[#E67E22] to-[#C0392B]" },
  { id: "bank", label: "Klario", icon: Landmark, tint: "from-[#14B8B8] to-[#0B7F7F]" },
  { id: "news", label: "News", icon: Newspaper, tint: "from-[#C0392B] to-[#8E2219]" },
  { id: "jobs", label: "Jobs", icon: Briefcase, tint: "from-[#6C3CE1] to-[#4A23A8]" },
  { id: "hustle", label: "Hustle", icon: Coins, tint: "from-[#F2B705] to-[#B5791A]" },
  { id: "vinec", label: "VINEC", icon: IdCard, tint: "from-[#118A4F] to-[#0B5E36]" },
  { id: "me", label: "Me", icon: User, tint: "from-[#2B5C9A] to-[#1F3F6E]" },
  { id: "about", label: "Settings", icon: Settings, tint: "from-[#8E979F] to-[#5E6B73]" },
];
const TITLE: Record<App, string> = { hustle: "Hustle", vinec: "VINEC", journal: "Journal", calls: "Phone", gallery: "Gallery", ride: "Call a keke", sync: "Sync", daily: "Daily", bank: "Klario", news: "News", jobs: "Jobs", me: "Me", about: "About phone" };

export function PhonePanel({ onClose }: { onClose: () => void }) {
  const owned = useGame((s) => s.game.phone);
  const cls = useGame((s) => s.game.citizen?.cls);
  const model = phoneOf(owned, cls);
  const [app, setApp] = useState<App | null>(null);
  return (
    <div className="pointer-events-auto fixed bottom-24 left-1/2 z-40 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0" role="dialog" aria-label={`Your phone: ${model.name}`}>
      <button type="button" aria-label="Put the phone away" onClick={onClose} className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-panel text-ink shadow-lg">
        <X aria-hidden className="h-4 w-4" />
      </button>
      {model.kind === "keypad" ? <Keypad model={model} /> : <Smartphone model={model} app={app} setApp={setApp} />}
    </div>
  );
}

// ---- Smartphones ----

function StatusBar({ dark }: { dark?: boolean }) {
  const t = useGame((s) => s.game.t);
  return (
    <div className={cx("flex items-center justify-between px-6 pt-2.5 text-[11px] font-bold", dark ? "text-ink" : "text-white")}>
      <span>{fmtTime(worldT({ t }))}</span>
      <span className="flex items-center gap-1">
        <Signal aria-hidden className="h-3 w-3" />
        <Wifi aria-hidden className="h-3 w-3" />
        <BatteryFull aria-hidden className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

function Smartphone({ model, app, setApp }: { model: PhoneModel; app: App | null; setApp: (a: App | null) => void }) {
  const island = model.kind === "island";
  return (
    <div className={cx("relative h-[600px] w-[290px] p-[7px] shadow-2xl", island ? "rounded-[46px]" : "rounded-[30px]")} style={{ background: model.colour }}>
      <div className={cx("relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-[#1F3F6E] via-[#26355E] to-[#0F1730]", island ? "rounded-[40px]" : "rounded-[24px]")}>
        {/* The island on the flagship, a punch-hole camera on the others. */}
        {island ? (
          <div className="absolute top-2 left-1/2 z-10 h-7 w-24 -translate-x-1/2 rounded-full bg-black" aria-hidden />
        ) : (
          <div className="absolute top-2.5 left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-black" aria-hidden />
        )}
        <StatusBar dark={!!app} />
        {app ? (
          <div className="absolute inset-0 flex flex-col bg-panel pt-9 text-ink">
            <div className="flex items-center gap-1 px-3 pb-2">
              <button type="button" aria-label="Back" onClick={() => setApp(null)} className="rounded-full p-1 hover:bg-panel-2">
                <ChevronLeft aria-hidden className="h-5 w-5" />
              </button>
              <h2 className="font-sign text-lg">{TITLE[app]}</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-10">
              <AppScreen app={app} model={model} />
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-4 gap-x-2 gap-y-4 px-4">
            {APPS.map((a) => (
              <button key={a.id} type="button" onClick={() => setApp(a.id)} className="flex flex-col items-center gap-1 text-[10px] font-semibold text-white">
                <span className={cx("flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-md", a.tint)}>
                  <a.icon aria-hidden className="h-6 w-6" strokeWidth={2} />
                </span>
                {a.label}
              </button>
            ))}
          </div>
        )}
        {/* Home bar (flagship) or the three buttons (others). */}
        {island ? (
          <button type="button" aria-label="Home" onClick={() => setApp(null)} className="absolute bottom-2 left-1/2 z-10 h-1.5 w-28 -translate-x-1/2 rounded-full bg-white/70" />
        ) : (
          <div className={cx("absolute inset-x-0 bottom-0 z-10 flex justify-around py-2", app ? "bg-panel text-ink-soft" : "text-white/80")}>
            <button type="button" aria-label="Back" onClick={() => setApp(null)}><ChevronLeft aria-hidden className="h-4 w-4" /></button>
            <button type="button" aria-label="Home" onClick={() => setApp(null)}><Circle aria-hidden className="h-4 w-4" /></button>
            <button type="button" aria-label="Recent apps" onClick={() => setApp(null)}><Square aria-hidden className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function AppScreen({ app, model }: { app: App; model: PhoneModel }) {
  switch (app) {
    case "journal": return <Journal />;
    case "calls": return <Calls />;
    case "gallery": return <Gallery />;
    case "ride": return <Ride />;
    case "sync": return <SyncApp ride={<Ride />} />;
    case "daily": return <DailyApp />;
    case "bank": return <Bank />;
    case "news": return <News />;
    case "jobs": return <Jobs />;
    case "me": return <Me />;
    case "about": return <About model={model} />;
    case "hustle": return <HustleApp />;
    case "vinec": return <Vinec model={model} />;
  }
}

// ---- Keypad phone ----

const KEYPAD_MENU: { id: App; label: string }[] = [
  { id: "journal", label: "Messages" },
  { id: "calls", label: "Contacts" },
  { id: "bank", label: "Klario *901#" },
  { id: "ride", label: "Call a keke" },
  { id: "daily", label: "Daily missions" },
  { id: "vinec", label: "*VINEC#" },
  { id: "hustle", label: "Hustle" },
  { id: "news", label: "FM radio news" },
  { id: "about", label: "Phone info" },
];

function Keypad({ model }: { model: PhoneModel }) {
  const [open, setOpen] = useState<App | null>(null);
  const [sel, setSel] = useState(0);
  return (
    <div className="flex w-[230px] flex-col items-center gap-3 rounded-[30px] p-4 shadow-2xl" style={{ background: model.colour }}>
      <div className="text-[10px] font-bold tracking-widest text-white/60">KPAKPA</div>
      <div className="h-56 w-full overflow-y-auto rounded-md border-4 border-black/60 bg-[#B9C8A4] p-2 font-mono text-[11px] text-[#1E2A16]">
        {open ? (
          <div>
            <div className="mb-1 border-b border-[#1E2A16]/40 font-bold">{KEYPAD_MENU.find((m) => m.id === open)?.label}</div>
            <AppScreen app={open} model={model} />
          </div>
        ) : (
          <ul>
            {KEYPAD_MENU.map((m, i) => (
              <li key={m.id}>
                <button type="button" onClick={() => setOpen(m.id)} onMouseEnter={() => setSel(i)} className={cx("block w-full px-1 text-left", sel === i && "bg-[#1E2A16] text-[#B9C8A4]")}>
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex w-full justify-between px-2 text-[10px] font-bold text-white/80">
        <button type="button" onClick={() => setOpen(KEYPAD_MENU[sel].id)}>Select</button>
        <button type="button" onClick={() => setOpen(null)}>Back</button>
      </div>
      <div className="grid w-full grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
          <span key={k} className="flex h-7 items-center justify-center rounded-full bg-black/35 text-xs font-bold text-white/90" aria-hidden>
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- Apps ----

function Journal() {
  const log = useGame((s) => s.game.log);
  if (!log.length) return <p className="text-sm text-ink-soft">Nothing yet. Tap a place on the map to start your day.</p>;
  return (
    <ul className="divide-y divide-line text-sm">
      {log.slice(0, 30).map((e, i) => (
        <li key={i} className="py-2">
          <time className="block text-xs font-bold text-ink-soft">
            Day {dayNum(e.t)}, {fmtTime(e.t)}
          </time>
          {e.msg}
        </li>
      ))}
    </ul>
  );
}

const CONTACTS = ["Mama", "Oyin", "Tommy", "Danny", "Tao", "Blogger", "Damilola", "Chibuzor Chinemerem", "Tunde", "Basira", "Kayode", "Landlord", "Klario support"];

function Calls() {
  const [calling, setCalling] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  useEffect(() => {
    if (!calling) return;
    const t = setTimeout(() => {
      setResult(calling === "Klario support" ? "Klario support: your account is fine. Anything else?" : calling.length % 2 ? `${calling} did not pick up. Network wahala.` : `You gisted with ${calling} for a while.`);
      setCalling(null);
    }, 1800);
    return () => clearTimeout(t);
  }, [calling]);
  return (
    <div className="text-sm">
      {calling && <p className="mb-2 animate-pulse font-bold">Calling {calling}…</p>}
      {result && !calling && <p className="mb-2 font-semibold">{result}</p>}
      <ul className="divide-y divide-line">
        {CONTACTS.map((c) => (
          <li key={c} className="flex items-center justify-between py-2">
            <span>{c}</span>
            <button type="button" aria-label={`Call ${c}`} disabled={!!calling} onClick={() => { setResult(null); setCalling(c); }} className="rounded-full bg-[#1E9E55] p-1.5 text-white disabled:opacity-50">
              <PhoneIcon aria-hidden className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PHOTOS = ["interiors/interior-home.webp", "interiors/interior-amala.webp", "interiors/interior-mall.webp", "interiors/interior-hotel.webp", "tiles/lm-kwara.webp", "tiles/lm-lagos.webp", "interiors/interior-unilorin.webp", "interiors/interior-mosque.webp", "tiles/lm-fct.webp"];

function Gallery() {
  const kind = phoneOf(useGame((s) => s.game.phone), useGame((s) => s.game.citizen?.cls)).kind;
  const [big, setBig] = useState<string | null>(null);
  if (kind === "keypad") return <p>No camera on this phone. Upgrade at the phone stalls.</p>;
  if (big)
    return (
      <button type="button" onClick={() => setBig(null)} className="block w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/assets/${big}`} alt="" className="w-full rounded-xl" />
      </button>
    );
  return (
    <div className="grid grid-cols-3 gap-1">
      {PHOTOS.map((p) => (
        <button key={p} type="button" onClick={() => setBig(p)} className="aspect-square overflow-hidden rounded-md bg-panel-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/assets/${p}`} alt="" className="h-full w-full object-cover" loading="lazy" />
        </button>
      ))}
    </div>
  );
}

/** Book a ride: pick where to, then how, with the real fares and times for this town. */
function Ride() {
  const game = useGame((s) => s.game);
  const [far, setFar] = useState(false);
  const world = useGame((s) => s.world);
  const busy = useGame((s) => s.activity !== null);
  const [to, setTo] = useState<string | null>(null);
  const places = useMemo(() => (world ? world.places : PLACES).filter((p) => p.id !== game.loc).map((p) => ({ id: p.id, name: p.name })), [world, game.loc]);
  const w = tripWorldFor(game, world);
  if (!to)
    return (
      <div className="text-sm">
        {game.citizen && (
          <Button small tone="keke" className="mb-2 w-full" onClick={() => setFar(true)}>
            Travel to another state
          </Button>
        )}
        {far && <JourneyPicker onClose={() => setFar(false)} />}
        <p className="mb-2 text-ink-soft">Where are you going?</p>
        <ul className="divide-y divide-line">
          {places.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setTo(p.id)} className="block w-full py-2 text-left font-semibold">{p.name}</button>
            </li>
          ))}
        </ul>
      </div>
    );
  const q = quoteTrip(game.loc, to, w);
  return (
    <div className="space-y-2 text-sm">
      <button type="button" onClick={() => setTo(null)} className="text-xs font-bold text-ink-soft">Change destination</button>
      <p className="font-bold">To {w.placeName(to)}</p>
      {w.modeIds.map((m) => {
        const why = busy ? "You are busy" : modeBlockReason(game, m, q);
        return (
          <div key={m} className="flex items-center justify-between rounded-xl bg-panel-2 p-2">
            <span>
              <span className="block font-bold">{w.modes[m].label}</span>
              <span className="text-xs text-ink-soft">{q.modes[m].minutes} min · {q.modes[m].fare ? naira(q.modes[m].fare) : "free"}</span>
              {why && <span className="block text-xs text-danger">{why}</span>}
            </span>
            <Button small disabled={!!why} onClick={() => getGameStore().getState().travel(to, m, performance.now())}>Book</Button>
          </div>
        );
      })}
    </div>
  );
}

function Bank() {
  const kind = phoneOf(useGame((s) => s.game.phone), useGame((s) => s.game.citizen?.cls)).kind;
  return kind === "keypad" ? <KlarioUssd /> : <KlarioApp />;
}

function News() {
  const local = useGame((s) => s.game.localNews);
  return (
    <ul className="divide-y divide-line text-sm">
      {[...local, ...NEWS].map((n, i) => (
        <li key={i} className="py-2 font-semibold">{n}</li>
      ))}
    </ul>
  );
}

function Jobs() {
  const game = useGame((s) => s.game);
  const [msg, setMsg] = useState<string | null>(null);
  const c = game.citizen;
  if (!c) return <p className="text-sm text-ink-soft">Create your citizen to see job openings.</p>;
  const list = openings(game.at ?? c.lgaCode, dayNum(game.t));
  return (
    <div>
      <p className="mb-2 text-sm text-ink-soft">
        Openings in {LGA[game.at ?? c.lgaCode].name} this week. Printing your CV costs ₦500. Employers reply in a few days.
      </p>
      <InterviewCard />
      {game.applications.length > 0 && <p className="mb-2 rounded-xl bg-panel-2 p-2 text-sm font-semibold">Waiting to hear back: {game.applications.map((a) => a.title).join(", ")}</p>}
      <ul className="space-y-2">
        {list.map((o) => (
          <li key={o.id} className="rounded-2xl bg-panel-2 p-3 text-sm">
            <b className="block">{o.title}</b>
            {naira(o.monthly)} a month · {o.minEducation === "none" ? "no certificate needed" : `needs ${EDUCATION_LABEL[o.minEducation]}`} · {o.applicants} applicants
            <Button small className="mt-2 block" onClick={() => setMsg(getGameStore().getState().applyJob(o) ?? "Applied. Wait for their call.")}>Apply</Button>
          </li>
        ))}
      </ul>
      {msg && <p className="mt-2 text-sm font-bold">{msg}</p>}
    </div>
  );
}

/** How close a class change is: "(moving up: 2 of 3 days)". */
function standingText(game: { citizen: { cls: string } | null; standing: { toward: string | null; days: number } }): string {
  const { toward, days } = game.standing;
  if (!toward || !game.citizen || toward === game.citizen.cls) return "";
  const up = ["poor", "middle", "rich"].indexOf(toward) > ["poor", "middle", "rich"].indexOf(game.citizen.cls);
  return up ? ` (moving up: ${days} of ${RISE_DAYS} days)` : ` (money is tight: ${days} of ${FALL_DAYS} days)`;
}

function Me() {
  const game = useGame((s) => s.game);
  const c = game.citizen;
  if (!c) return <p className="text-sm text-ink-soft">Create your citizen first.</p>;
  const rows: [string, string][] = [
    ["Name", c.name],
    ["Class", CLASS_LABEL[c.cls] + standingText(game)],
    ["Job", `${c.job}${c.employed ? "" : " (looking for work)"}`],
    ["Career", CAREERS[c.career].label],
    ["Pay", c.monthlyPay ? `${naira(c.monthlyPay)} a month` : "Depends on the day"],
    ["School", EDUCATION_LABEL[c.education]],
    ["Home", c.home],
    ["Registered in", LGA[c.lgaCode].name],
    ["Now in", LGA[game.at ?? c.lgaCode].name],
    ["PVC", c.pvc === "have" ? "Collected" : c.pvc === "registered" ? "Registered, not collected" : c.pvc === "seized" ? "Seized" : "Not registered"],
    ["Informed", String(game.informed)],
    ["Civic", String(game.civic)],
    ["Connections", `${game.connections} of 100`],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-bold text-ink-soft">{k}</dt>
          <dd className="font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function About({ model }: { model: PhoneModel }) {
  return (
    <div className="space-y-2 text-sm">
      <p>
        <b>{model.name}</b>. {model.blurb}
      </p>
      <p className="text-ink-soft">Want a different phone? The phone stalls at the market (Taiwo Oke in Ilorin) sell:</p>
      <ul className="space-y-1">
        {PHONES.map((p) => (
          <li key={p.id} className={cx("flex justify-between rounded-lg px-2 py-1", p.id === model.id ? "bg-panel-2 font-bold" : "")}>
            <span>{p.name}</span>
            <span>{naira(p.price)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Hustle ----

function HustleApp() {
  const game = useGame((s) => s.game);
  const busy = useGame((s) => s.activity !== null);
  const kind = phoneOf(game.phone, game.citizen?.cls).kind;
  const [msg, setMsg] = useState<string | null>(null);
  const c = game.citizen;
  if (!c) return <p className="text-sm">Create your citizen to find gigs.</p>;
  return (
    <div className="space-y-2 text-sm">
      <p className="text-ink-soft">Side gigs you can do today. They pay on the spot.</p>
      {HUSTLES.map((h) => {
        const why = busy
          ? "You are busy"
          : h.phones && !h.phones.includes(kind)
            ? "Needs a smartphone"
            : h.minEducation && EDUCATION_RANK[c.education] < EDUCATION_RANK[h.minEducation]
              ? "Needs more schooling"
              : null;
        return (
          <div key={h.id} className="rounded-xl bg-panel-2 p-2">
            <div className="flex items-start justify-between gap-2">
              <span>
                <span className="block font-bold">{h.label}</span>
                <span className="text-xs text-ink-soft">{h.blurb}</span>
              </span>
              <span className="shrink-0 font-bold text-[#0E7A4B]">+{naira(h.earn ?? 0)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-ink-soft">
                {Math.round(h.dur / 60)}h{h.cost ? ` · costs ${naira(h.cost)}` : ""}
              </span>
              <Button small disabled={!!why} onClick={() => setMsg(getGameStore().getState().doHustle(h.id, performance.now()))}>
                {why ?? "Do it"}
              </Button>
            </div>
          </div>
        );
      })}
      {msg && <p className="font-bold text-danger">{msg}</p>}
    </div>
  );
}

// ---- VINEC ----

function Vinec({ model }: { model: PhoneModel }) {
  const c = useGame((s) => s.game.citizen);
  if (!c) return <p className="text-sm">Create your citizen first.</p>;
  const lga = LGA[c.lgaCode];
  const pu = c.puCode.split("/").pop();
  const vin = (c.name + c.lgaCode)
    .split("")
    .reduce((h, ch) => (h * 33 + ch.charCodeAt(0)) % 1e9, 11)
    .toString(36)
    .toUpperCase()
    .padStart(6, "0");
  const status =
    c.pvc === "have"
      ? "Your PVC is collected. You can vote."
      : c.pvc === "registered"
        ? "Registered. Collect your PVC at the VINEC office when collection opens."
        : c.pvc === "seized"
          ? "Your PVC was seized. You cannot vote this election."
          : "Not registered yet. Register at the VINEC office in your LGA.";
  if (model.kind === "keypad")
    return (
      <div>
        <p>VIN {vin}</p>
        <p>
          {lga.name} PU {pu}
        </p>
        <p className="mt-1">{status}</p>
      </div>
    );
  return (
    <div className="space-y-3 text-sm">
      {c.pvc === "have" ? (
        <div className="rounded-2xl bg-gradient-to-br from-[#118A4F] to-[#0B5E36] p-4 text-white shadow">
          <div className="flex justify-between text-[10px] font-bold tracking-widest opacity-80">
            <span>VINEC</span>
            <span>PERMANENT VOTER CARD</span>
          </div>
          <div className="mt-3 font-sign text-xl">{c.name}</div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
            <span className="opacity-70">VIN</span>
            <span className="font-mono font-bold">{vin}</span>
            <span className="opacity-70">LGA</span>
            <span>{lga.name}</span>
            <span className="opacity-70">Polling unit</span>
            <span>{pu}</span>
          </div>
          <div className="mt-2 text-[10px] opacity-70">Shown in the game only. Not a real voter card.</div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-line p-4 text-center text-ink-soft">Your PVC appears here once you collect it.</div>
      )}
      <p className="font-semibold">{status}</p>
      <p className="text-ink-soft">
        Polling unit {pu}, {lga.name}. You can only vote there.
      </p>
    </div>
  );
}

// ---- Interviews and recruiters' calls ----

function InterviewCard() {
  const iv = useGame((s) => s.game.interview);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<string | null>(null);
  if (result) return <p className="mb-2 rounded-xl bg-panel-2 p-2 text-sm font-bold">{result}</p>;
  if (!iv) return null;
  if (!iv.accepted)
    return (
      <div className="mb-2 rounded-xl border-2 border-[#1E9E55] p-2 text-sm">
        <b>{iv.company}</b> called about the {iv.title.toLowerCase()} role.
        <div className="mt-2 flex gap-2">
          <Button small onClick={() => getGameStore().getState().answerCall(true)}>
            Book the interview
          </Button>
          <Button small tone="ghost" onClick={() => getGameStore().getState().answerCall(false)}>
            Decline
          </Button>
        </div>
      </div>
    );
  const qs = questionsFor(iv.id, iv.career);
  return (
    <div className="mb-3 space-y-2 rounded-xl border-2 border-[#6C3CE1] p-3 text-sm">
      <p className="font-bold">
        Interview: {iv.title} at {iv.company}
      </p>
      <p className="text-xs text-ink-soft">{naira(iv.monthly)} a month. The panel has three questions.</p>
      {qs.map((q, i) => (
        <fieldset key={q.q} className="space-y-1">
          <legend className="font-semibold">
            {i + 1}. {q.q}
          </legend>
          {q.a.map(([text], k) => (
            <label key={text} className={cx("flex gap-2 rounded-lg p-1.5", answers[i] === k && "bg-panel-2")}>
              <input type="radio" name={`q${i}`} checked={answers[i] === k} onChange={() => setAnswers((a) => Object.assign([...a], { [i]: k }))} />
              <span>{text}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <Button
        className="w-full"
        disabled={qs.some((_, i) => answers[i] === undefined)}
        onClick={() => {
          const r = getGameStore().getState().sitInterview(answers);
          setResult(typeof r === "string" ? r : r.hired ? "They offered you the job! Check your notes." : "Not this time. Check your notes for their feedback.");
        }}
      >
        Finish the interview
      </Button>
    </div>
  );
}

/** A recruiter ringing: shown over the game until you pick up or decline. */
export function IncomingCall() {
  const iv = useGame((s) => s.game.interview);
  const notes = useGame((s) => s.game.notes.length);
  if (!iv || iv.accepted || notes > 0) return null;
  return (
    <div
      className="pointer-events-auto fixed inset-x-0 top-4 z-50 mx-auto flex w-[min(92vw,360px)] items-center gap-3 rounded-3xl bg-[#111418] p-3 text-white shadow-2xl"
      role="alertdialog"
      aria-label="Incoming call"
    >
      <span className="flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-full bg-[#6C3CE1] font-bold">{iv.company[0]}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{iv.company}</span>
        <span className="block truncate text-xs opacity-70">Calling about {iv.title.toLowerCase()}</span>
      </span>
      <button type="button" aria-label="Decline" onClick={() => getGameStore().getState().answerCall(false)} className="rounded-full bg-[#C0392B] p-2.5">
        <PhoneOff aria-hidden className="h-4 w-4" />
      </button>
      <button type="button" aria-label="Answer" onClick={() => getGameStore().getState().answerCall(true)} className="rounded-full bg-[#1E9E55] p-2.5">
        <PhoneIcon aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
