"use client";
// Overlays on the map: top bar, news ticker, objectives, needs dock, bottom tabs, toasts and notes.
import { useEffect, useMemo, useState } from "react";
import { AVATAR_ART } from "@/data/character";
import { PRESIDENTIAL_2027 as CAL, civicPhase } from "@/data/calendar";
import { NEWS } from "@/data/media";
import { NEEDS, type NeedKey } from "@/data/needs";
import { DAYS, dayOfWeek, fmtTime, mood } from "@/sim";
import { getGameStore, useGame } from "@/store";
import { Button, DISCLAIMER, Glass, Modal, cx, naira, useNow } from "./ui";

const NEED_ICON: Record<NeedKey, string> = {
  food: "🍲",
  energy: "⚡",
  fun: "🎉",
  social: "💬",
  hygiene: "🚿",
};
const NEED_BAR: Record<NeedKey, string> = {
  food: "bg-[#E0884F]",
  energy: "bg-[#E0A800]",
  fun: "bg-[#C2578A]",
  social: "bg-[#4F6AAE]",
  hygiene: "bg-[#5FB3AE]",
};

function countdown(ms: number) {
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

export function TopBar() {
  const t = useGame((s) => s.game.t);
  const money = useGame((s) => s.game.money);
  const light = useGame((s) => s.game.light);
  const paused = useGame((s) => s.paused);
  const feel = useGame((s) => mood(s.game));
  const now = useNow(10_000);
  const left = countdown(Date.parse(CAL.pollsOpen) - now);
  const phase = civicPhase(CAL, now);
  const [menu, setMenu] = useState(false);
  return (
    <>
      {/* The menu sits outside the glass: its backdrop blur would trap a fixed dialog. */}
      {menu && <GameMenu onClose={() => setMenu(false)} />}
      <Glass className="pointer-events-auto flex items-center gap-2 px-2 py-2 text-sm font-semibold whitespace-nowrap md:gap-4 md:px-5 md:text-base">
        <button type="button" aria-label="Menu" onClick={() => setMenu(true)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel-2 text-lg leading-none">
          ☰
        </button>
        <span className="shrink-0">
          {DAYS[dayOfWeek(t)]} · {fmtTime(t)}
        </span>
        <span className="hidden text-leaf sm:inline">{feel}</span>
        <span className="shrink-0 rounded-full bg-[#0E7A4B]/10 px-2 py-0.5 text-[#0E7A4B]">
          {phase === "polls-open" ? (
            "Polls are open"
          ) : phase === "results" ? (
            "Results"
          ) : left ? (
            <>
              <span className="hidden min-[440px]:inline">Election in </span>
              <span aria-hidden className="min-[440px]:hidden">
                🗳️{" "}
              </span>
              {left}
            </>
          ) : (
            ""
          )}
        </span>
        {!light && <span className="rounded-full bg-[#3B2A1A] px-2 py-0.5 text-[#FFD66B]">No light</span>}
        <span className="ml-auto font-bold">{naira(money)}</span>
        <button type="button" onClick={() => getGameStore().getState().togglePause()} className="hidden shrink-0 rounded-full min-[380px]:inline-block bg-panel-2 px-3 py-1 text-xs font-bold">
          {paused ? "Play" : "Pause"}
        </button>
      </Glass>
    </>
  );
}

const HOW_TO_PLAY = [
  "Tap a place on the map, then pick what to do there. Keep your needs bars up.",
  "Work to earn money. No job? Check the openings on your phone.",
  "Register at the INEC office before 30 October, then collect your PVC from 31 October.",
  "Campaign with support cards and flyers. No chat, and no campaigning in the last 24 hours.",
  "On 14 November, go to your own polling unit between 8am and 4pm and vote. If you travelled, come home first.",
];

/** Options: pause, how to play, about, start again. */
function GameMenu({ onClose }: { onClose: () => void }) {
  const paused = useGame((s) => s.paused);
  const [view, setView] = useState<"main" | "help" | "about" | "reset">("main");
  const store = getGameStore().getState();
  return (
    <Modal title={view === "help" ? "How to play" : view === "about" ? "About" : view === "reset" ? "Start a new life?" : "Menu"}>
      <div className="flex flex-col gap-2 whitespace-normal">
        {view === "main" && (
          <>
            <Button
              onClick={() => {
                store.togglePause();
                onClose();
              }}
            >
              {paused ? "Resume" : "Pause the clock"}
            </Button>
            <Button tone="ghost" onClick={() => setView("help")}>
              How to play
            </Button>
            <Button tone="ghost" onClick={() => setView("about")}>
              About and disclaimer
            </Button>
            <Button tone="danger" onClick={() => setView("reset")}>
              Start a new life
            </Button>
            <Button tone="ghost" onClick={onClose}>
              Close
            </Button>
          </>
        )}
        {view === "help" && (
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {HOW_TO_PLAY.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
        )}
        {view === "about" && (
          <div className="space-y-2 text-sm">
            <p>Naija Votes 2027 is a free and fair election game. Every citizen lives one life, gets one PVC and casts one vote.</p>
            <p className="font-semibold">{DISCLAIMER}</p>
            <p>Collect your real PVC, vote in real elections and choose wisely.</p>
          </div>
        )}
        {view === "reset" && (
          <>
            <p className="text-sm">Your citizen, money and progress on this device will be gone. You cannot undo this.</p>
            <Button
              tone="danger"
              onClick={() => {
                store.reset();
                onClose();
              }}
            >
              Yes, start again
            </Button>
          </>
        )}
        {view !== "main" && (
          <Button tone="ghost" onClick={() => setView("main")}>
            Back
          </Button>
        )}
      </div>
    </Modal>
  );
}

/** Scrolling headlines: the game's local news, then civic news. */
export function NewsTicker({ sponsored }: { sponsored?: string }) {
  const local = useGame((s) => s.game.localNews);
  const items = useMemo(() => [...(sponsored ? [`Sponsored: ${sponsored}`] : []), ...local.slice(0, 6), ...NEWS], [local, sponsored]);
  return (
    <div className="pointer-events-auto overflow-hidden rounded-full bg-indigo/90 text-[#F7E7C1] shadow">
      <div className="flex w-max animate-[ticker_60s_linear_infinite] gap-10 px-4 py-1.5 text-sm font-semibold whitespace-nowrap motion-reduce:animate-none">
        {[...items, ...items].map((n, i) => (
          <span key={i}>● {n}</span>
        ))}
      </div>
    </div>
  );
}

/** What to do next, following the election calendar. */
export function Objectives() {
  const c = useGame((s) => s.game.citizen);
  const voted = useGame((s) => s.game.voted.includes(CAL.id));
  const away = useGame((s) => !!s.game.at);
  const food = useGame((s) => s.game.needs.food);
  const now = useNow(15_000);
  if (!c) return null;
  const phase = civicPhase(CAL, now);
  const goals: { title: string; hint: string }[] = [];
  if (food < 30) goals.push({ title: "Eat something", hint: "Cook at home or buy food" });
  if (c.pvc === "none" && phase === "registration")
    goals.push({
      title: "Register to vote",
      hint: "Go to the INEC office in your LGA",
    });
  if (c.pvc === "registered" && (phase === "pvc-collection" || phase === "blackout"))
    goals.push({
      title: "Collect your PVC",
      hint: "INEC office, before 7:50am on election day",
    });
  if (c.pvc === "registered" && (phase === "registration" || phase === "waiting-for-pvc"))
    goals.push({
      title: "Wait for PVC collection",
      hint: "Collection opens 31 October",
    });
  if (!c.employed)
    goals.push({
      title: "Find a job",
      hint: "Check the openings on your phone",
    });
  if (phase === "polls-open" && !voted && c.pvc === "have")
    goals.push({
      title: away ? "Travel home to vote" : "Go and vote",
      hint: "Your polling unit, 8am to 4pm",
    });
  if (c.pvc === "seized")
    goals.push({
      title: "Your PVC was seized",
      hint: "You cannot vote this election",
    });
  if (!goals.length) return null;
  return (
    <div className="pointer-events-auto flex max-w-[280px] flex-col gap-2">
      {goals.slice(0, 2).map((g) => (
        <Glass key={g.title} className="px-3 py-2">
          <div className="text-sm font-bold">{g.title}</div>
          <div className="text-xs text-ink-soft">{g.hint}</div>
        </Glass>
      ))}
    </div>
  );
}

export function NeedsDock() {
  const needs = useGame((s) => s.game.needs);
  const g = useGame((s) => s.game.citizen?.look.g ?? "m");
  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <div className="h-16 w-16 overflow-hidden rounded-full border-4 border-[#0E7A4B] bg-[#E9D5AE] shadow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={AVATAR_ART[g]} alt="You" className="h-28 w-full object-cover object-top" />
      </div>
      <Glass className="grid grid-cols-3 gap-x-3 gap-y-1.5 px-3 py-2">
        {NEEDS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1.5" title={`${label} ${Math.round(needs[key])}`}>
            <span aria-hidden className="text-sm">
              {NEED_ICON[key]}
            </span>
            <div className="h-2 w-12 overflow-hidden rounded-full bg-panel-2" role="progressbar" aria-label={label} aria-valuenow={Math.round(needs[key])} aria-valuemin={0} aria-valuemax={100}>
              <div className={cx("h-full rounded-full transition-[width]", needs[key] < 25 ? "bg-danger" : NEED_BAR[key])} style={{ width: `${needs[key]}%` }} />
            </div>
          </div>
        ))}
      </Glass>
    </div>
  );
}

export type Tab = "life" | "campaign" | "vote" | "phone";

export function BottomNav({ tab, onTab }: { tab: Tab | null; onTab: (t: Tab | null) => void }) {
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "life", label: "Life", icon: "🏠" },
    { id: "campaign", label: "Campaign", icon: "📣" },
    { id: "vote", label: "Vote", icon: "🗳️" },
    { id: "phone", label: "Phone", icon: "📱" },
  ];
  return (
    <Glass className="pointer-events-auto flex gap-1 p-1.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onTab(tab === t.id ? null : t.id)}
          aria-pressed={tab === t.id}
          className={cx("flex min-w-16 flex-col items-center rounded-xl px-3 py-1.5 text-xs font-bold md:min-w-24", tab === t.id ? "bg-indigo text-[#F7E7C1]" : "text-ink-soft")}
        >
          <span aria-hidden className="text-lg">
            {t.icon}
          </span>
          {t.label}
        </button>
      ))}
    </Glass>
  );
}

export function Toasts() {
  const first = useGame((s) => s.toasts[0]);
  useEffect(() => {
    if (!first) return;
    const id = setTimeout(() => getGameStore().getState().shiftToast(), 2400);
    return () => clearTimeout(id);
  }, [first]);
  if (!first) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4">
      <div className="rounded-2xl bg-indigo px-4 py-2.5 text-center font-semibold text-[#F7E7C1] shadow-lg">{first}</div>
    </div>
  );
}

/** The note at the front of the queue, with its choices. */
export function Notes() {
  const n = useGame((s) => s.game.notes[0]);
  const busy = useGame((s) => s.activity !== null);
  if (!n || busy) return null;
  const choices = n.choices ?? [{ label: "Okay", id: "ok" as const }];
  return (
    <Modal title={n.title}>
      <p className="mb-4 whitespace-pre-line">{n.body}</p>
      <div className="flex flex-col gap-2">
        {choices.map((c, i) => (
          <Button key={c.id} tone={i === 0 ? "primary" : "ghost"} onClick={() => getGameStore().getState().answer(c.id)}>
            {c.label}
          </Button>
        ))}
      </div>
    </Modal>
  );
}
