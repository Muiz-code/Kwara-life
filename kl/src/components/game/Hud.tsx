"use client";
// Overlays on the map: top bar, news ticker, objectives, needs dock, bottom tabs, toasts and notes.
import { useEffect, useMemo } from "react";
import { AVATAR_ART } from "@/data/character";
import { PRESIDENTIAL_2027 as CAL, civicPhase } from "@/data/calendar";
import { NEWS } from "@/data/media";
import { NEEDS, type NeedKey } from "@/data/needs";
import { DAYS, dayOfWeek, fmtTime, mood } from "@/sim";
import { getGameStore, useGame } from "@/store";
import { Button, Glass, Modal, cx, naira, useNow } from "./ui";

const NEED_ICON: Record<NeedKey, string> = { food: "🍲", energy: "⚡", fun: "🎉", social: "💬", hygiene: "🚿" };
const NEED_BAR: Record<NeedKey, string> = { food: "bg-[#E0884F]", energy: "bg-[#E0A800]", fun: "bg-[#C2578A]", social: "bg-[#4F6AAE]", hygiene: "bg-[#5FB3AE]" };

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
  return (
    <Glass className="pointer-events-auto flex items-center gap-2 overflow-x-auto px-3 py-2 text-sm font-semibold whitespace-nowrap md:gap-4 md:px-5 md:text-base">
      <span>
        {DAYS[dayOfWeek(t)]} · {fmtTime(t)}
      </span>
      <span className="hidden text-leaf sm:inline">{feel}</span>
      <span className="rounded-full bg-[#0E7A4B]/10 px-2 py-0.5 text-[#0E7A4B]">
        {phase === "polls-open" ? "Polls are open" : phase === "results" ? "Results" : left ? `Election in ${left}` : ""}
      </span>
      {!light && <span className="rounded-full bg-[#3B2A1A] px-2 py-0.5 text-[#FFD66B]">No light</span>}
      <span className="ml-auto font-bold">{naira(money)}</span>
      <button type="button" onClick={() => getGameStore().getState().togglePause()} className="rounded-full bg-panel-2 px-3 py-1 text-xs font-bold">
        {paused ? "Play" : "Pause"}
      </button>
    </Glass>
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
  if (c.pvc === "none" && phase === "registration") goals.push({ title: "Register to vote", hint: "Go to the INEC office in your LGA" });
  if (c.pvc === "registered" && (phase === "pvc-collection" || phase === "blackout")) goals.push({ title: "Collect your PVC", hint: "INEC office, before 7:50am on election day" });
  if (c.pvc === "registered" && (phase === "registration" || phase === "waiting-for-pvc")) goals.push({ title: "Wait for PVC collection", hint: "Collection opens 31 October" });
  if (!c.employed) goals.push({ title: "Find a job", hint: "Check the openings on your phone" });
  if (phase === "polls-open" && !voted && c.pvc === "have") goals.push({ title: away ? "Travel home to vote" : "Go and vote", hint: "Your polling unit, 8am to 4pm" });
  if (c.pvc === "seized") goals.push({ title: "Your PVC was seized", hint: "You cannot vote this election" });
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
            <span aria-hidden className="text-sm">{NEED_ICON[key]}</span>
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
          <span aria-hidden className="text-lg">{t.icon}</span>
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
