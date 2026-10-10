"use client";
// Overlays on the map: top bar, news ticker, objectives, needs dock, bottom tabs, toasts and notes.
import { useAnnouncement } from "@/net/announcement";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  House,
  Megaphone,
  Menu,
  MessageCircle,
  PartyPopper,
  ShowerHead,
  Smartphone,
  Utensils,
  Vote,
  Zap,
  ZapOff,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AVATAR_ART } from "@/data/character";
import { PRESIDENTIAL_2027 as CAL, civicPhase } from "@/data/calendar";
import { NEWS } from "@/data/media";
import { NEEDS, type NeedKey } from "@/data/needs";
import { DAYS, dayNum, dayOfWeek, fmtTime, mood, worldT } from "@/sim";
import { CAREERS } from "@/data/careers";
import { useSoundOn } from "./Vibes";
import {
  clockJumped,
  debugMode,
  getGameStore,
  jumpClockTo,
  useGame,
} from "@/store";
import { nextStep } from "@/sim/explore";
import { STATES } from "@/data/states";
import { online, supabase } from "@/net/supabase";
import { signOutHere } from "@/net/sync";
import { installed, openInstallHelp } from "../pwa/install";
import { Button, DISCLAIMER, Glass, Modal, cx, naira, useNow } from "./ui";

const NEED_ICON: Record<NeedKey, LucideIcon> = {
  food: Utensils,
  energy: Zap,
  fun: PartyPopper,
  social: MessageCircle,
  hygiene: ShowerHead,
};
const NEED_BAR: Record<NeedKey, string> = {
  food: "bg-[#E0884F]",
  energy: "bg-[#E0A800]",
  fun: "bg-[#C2578A]",
  social: "bg-[#4F6AAE]",
  hygiene: "bg-[#5FB3AE]",
};

/** ₦175k, ₦2.4m: money short enough for the top bar on a phone. */
function nairaShort(n: number) {
  const a = Math.abs(n);
  if (a < 10_000) return naira(n);
  if (a < 1_000_000) return `${n < 0 ? "-" : ""}₦${Math.floor(a / 1000)}k`;
  return `${n < 0 ? "-" : ""}₦${(Math.floor(a / 100_000) / 10).toFixed(1).replace(/.0$/, "")}m`;
}

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
        <button
          type="button"
          aria-label="Menu"
          onClick={() => setMenu(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel-2 text-lg leading-none"
        >
          <Menu aria-hidden className="h-4.5 w-4.5" />
        </button>
        <span className="shrink-0">
          {DAYS[dayOfWeek(worldT({ t }))]} · {fmtTime(worldT({ t }))}
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
              <Vote
                aria-hidden
                className="mr-1 inline h-4 w-4 align-[-2px] min-[440px]:hidden"
              />
              {left}
            </>
          ) : (
            ""
          )}
        </span>
        {!light && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-[#3B2A1A] px-1.5 py-0.5 text-[#FFD66B] sm:px-2"
            title="No light"
          >
            <ZapOff aria-hidden className="h-4 w-4 sm:hidden" />
            <span className="sr-only sm:not-sr-only">No light</span>
          </span>
        )}
        <span className="ml-auto font-bold">
          <span className="sm:hidden">{nairaShort(money)}</span>
          <span className="hidden sm:inline">{naira(money)}</span>
        </span>
        {/* On a phone, pause lives in the menu. */}
        <button
          type="button"
          onClick={() => getGameStore().getState().togglePause()}
          className="hidden shrink-0 rounded-full bg-panel-2 px-3 py-1 text-xs font-bold sm:inline-block"
        >
          {paused ? "Play" : "Pause"}
        </button>
      </Glass>
    </>
  );
}

const HOW_TO_PLAY = [
  "Tap a place on the map, then pick what to do there. Keep your needs bars up.",
  "Work to earn money. No job? Check the openings on your phone.",
  "Register at the VINEC office before 30 October, then collect your PVC from 31 October.",
  "Campaign with support cards and flyers. No chat, and no campaigning in the last 24 hours.",
  "On 14 November, go to your own polling unit between 8am and 4pm and vote. If you travelled, come home first.",
];

/** Debug only (?debug): jump the real clock to each stage of the season. */
function ClockJumps({ onDone }: { onDone: () => void }) {
  const at = (iso: string, plusMin = 0) => Date.parse(iso) + plusMin * 60_000;
  const jumps: [string, number | null][] = [
    ["Registration", null],
    ["PVC collection", at(CAL.pvcAnnouncement, 9 * 60)],
    ["Blackout", at(CAL.pollsOpen, -12 * 60)],
    ["Polls open", at(CAL.pollsOpen, 30)],
    ["Last 3 minutes", at(CAL.pollsClose, -3)],
    ["Polls closed", at(CAL.pollsClose, 1)],
  ];
  return (
    <div className="rounded-2xl border-2 border-dashed border-line p-2">
      <div className="mb-1.5 text-xs font-bold text-ink-soft">
        Test: jump the clock{clockJumped() ? " (jumped)" : ""}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {jumps.map(([label, t]) => (
          <Button
            key={label}
            small
            tone="ghost"
            onClick={() => {
              jumpClockTo(t);
              onDone();
            }}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Options: pause, how to play, about, start again. */
/**
 * Show my name in the closing credits: the season's most-played citizens are named there, but only those who agree.
 * Only the citizen's game name and LGA would show. Off until the player turns it on.
 */
function CreditsChoice() {
  const on = useGame((s) => s.game.flags.credits === true);
  const hasCitizen = useGame((s) => !!s.game.citizen);
  if (!hasCitizen) return null;
  return (
    <label className="flex items-start gap-3 rounded-2xl bg-panel-2 px-3 py-2.5 text-sm">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => getGameStore().getState().setCreditsName(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[#0E7A4B]"
      />
      <span>
        <span className="block font-bold">Show my name in the closing credits</span>
        <span className="text-ink-soft">The players who played the most are named when the season ends. Only your citizen&apos;s name and LGA, never your username or email.</span>
      </span>
    </label>
  );
}

/** "Signed in as @tunde_ib": the username given at sign-up, read from the session. */
function SignedInAs() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase()
      ?.auth.getUser()
      .then(({ data }) => {
        const u = data.user?.user_metadata?.username;
        if (alive && typeof u === "string") setName(u);
      });
    return () => {
      alive = false;
    };
  }, []);
  if (!name) return null;
  return (
    <p className="text-center text-sm text-ink-soft">
      Signed in as <span className="font-bold text-ink">@{name}</span>
    </p>
  );
}

/** Sound on or off, remembered on this device. */
function SoundToggle() {
  const [on, setOn] = useSoundOn();
  return (
    <Button tone="ghost" onClick={() => setOn(!on)}>
      {on ? "Sound: on (tap to mute)" : "Sound: off (tap to turn on)"}
    </Button>
  );
}

function GameMenu({ onClose }: { onClose: () => void }) {
  const paused = useGame((s) => s.paused);
  const [view, setView] = useState<"main" | "help" | "about" | "reset">("main");
  const store = getGameStore().getState();
  return (
    <Modal
      title={
        view === "help"
          ? "How to play"
          : view === "about"
            ? "About"
            : view === "reset"
              ? "Start a new life?"
              : "Menu"
      }
    >
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
            <SoundToggle />
            <Button tone="ghost" onClick={() => setView("help")}>
              How to play
            </Button>
            {!installed() && (
              <Button
                tone="ghost"
                onClick={() => {
                  onClose();
                  openInstallHelp();
                }}
              >
                Install the app
              </Button>
            )}
            <Button tone="ghost" onClick={() => setView("about")}>
              About and disclaimer
            </Button>
            {/* Signed in, the server keeps one citizen per account for good: no starting over. */}
            {!online() && (
              <Button tone="danger" onClick={() => setView("reset")}>
                Start a new life
              </Button>
            )}
            {debugMode() && <ClockJumps onDone={onClose} />}
            {online() && <SignedInAs />}
            {online() && <CreditsChoice />}
            {online() && (
              <Button
                tone="ghost"
                onClick={() => {
                  // Upload the game and free the account for another device; the sign-in screen comes back after.
                  void signOutHere();
                  onClose();
                }}
              >
                Sign out
              </Button>
            )}
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
            <p>
              Naija Votes is a free and fair election game. Every citizen lives
              one life, gets one PVC and casts one vote.
            </p>
            <p className="font-semibold">{DISCLAIMER}</p>
            <p>
              Collect your real PVC, vote in real elections and choose wisely.
            </p>
          </div>
        )}
        {view === "reset" && (
          <>
            <p className="text-sm">
              Your citizen, money and progress on this device will be gone. You
              cannot undo this.
            </p>
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
  const announcement = useAnnouncement();
  const items = useMemo(
    () => [
      ...(announcement ? [`Naija Votes: ${announcement}`] : []),
      ...(sponsored ? [`Sponsored: ${sponsored}`] : []),
      ...local.slice(0, 6),
      ...NEWS,
    ],
    [local, sponsored, announcement],
  );
  return (
    <div className="pointer-events-auto overflow-hidden rounded-full bg-indigo/90 text-[#F7E7C1] shadow">
      <div className="flex w-max animate-[ticker_60s_linear_infinite] gap-10 px-4 py-1 text-xs font-semibold sm:py-1.5 sm:text-sm whitespace-nowrap motion-reduce:animate-none">
        {[...items, ...items].map((n, i) => (
          <span key={i}>● {n}</span>
        ))}
      </div>
    </div>
  );
}

/** What to do next, following the election calendar. */
type Goal = { title: string; hint: string; /** Place ids to head to, first one on this map wins. */ go?: string[] };

export function Objectives() {
  const c = useGame((s) => s.game.citizen);
  const voted = useGame((s) => s.game.voted.includes(CAL.id));
  const away = useGame((s) => !!s.game.at);
  const food = useGame((s) => s.game.needs.food);
  const visited = useGame((s) => s.game.visited.length);
  const workedToday = useGame((s) => s.game.flags.shiftDay === dayNum(s.game.t));
  const now = useNow(15_000);
  if (!c) return null;
  const phase = civicPhase(CAL, now);
  const goals: Goal[] = [];
  if (food < 30) goals.push({ title: "Eat something", hint: "Cook at home or buy food", go: ["buka", "amala", "item7", "home"] });
  if (c.pvc === "none" && phase === "registration")
    goals.push({ title: "Register to vote", hint: "Go to the VINEC office in your LGA", go: away ? undefined : ["inec"] });
  if (c.pvc === "registered" && (phase === "pvc-collection" || phase === "blackout"))
    goals.push({ title: "Collect your PVC", hint: "VINEC office, before 7:50am on election day", go: away ? undefined : ["inec"] });
  if (c.pvc === "registered" && (phase === "registration" || phase === "waiting-for-pvc"))
    goals.push({ title: "Wait for PVC collection", hint: "Collection opens 31 October" });
  if (!c.employed) goals.push({ title: "Find a job", hint: "Check the openings on your phone" });
  else if (!workedToday && !away && CAREERS[c.career]) {
    const career = CAREERS[c.career];
    goals.push({
      title: "Go to work",
      hint: career.where === "anywhere" ? `${career.workLabel}. You can do it from home` : `${career.workLabel}. Not done today`,
      go: career.where === "anywhere" ? ["home"] : c.career === "sync" ? ["sync"] : ["work", "secretariat"],
    });
  }
  if (phase === "polls-open" && !voted && c.pvc === "have")
    goals.push({ title: away ? "Travel home to vote" : "Go and vote", hint: "Your polling unit, 8am to 4pm", go: away ? undefined : ["pu"] });
  if (c.pvc === "seized") goals.push({ title: "Your PVC was seized", hint: "You cannot vote this election" });
  const step = nextStep(visited);
  if (step)
    goals.push({
      title: `Explorer: ${visited} of ${STATES.length} states`,
      hint: `Visit ${step[0] - visited} more to become a ${step[1].toLowerCase()}. Travel from the motor park, bus terminal or airport`,
      go: ["park", "terminal", "airport"],
    });
  return <GoalList goals={goals} />;
}

const GOALS_OPEN = "nv:goals-open";

/** One tap to the place a goal needs: selects it, which opens its card with the ways to get there. */
function GoButton({ go }: { go?: string[] }) {
  const world = useGame((s) => s.world);
  const busy = useGame((s) => s.activity !== null);
  const id = go?.find((g) => world?.places.some((p) => p.id === g));
  if (!id) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => getGameStore().getState().select(id)}
      className="flex shrink-0 items-center gap-0.5 rounded-full bg-indigo px-2.5 py-1 text-xs font-bold text-[#F7E7C1] disabled:opacity-50"
    >
      Go <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
    </button>
  );
}

/** Folded, the goals are one small chip so they don't cover the map; tap to see them all. */
function GoalList({ goals }: { goals: Goal[] }) {
  // Phones start folded, bigger screens open. The player's last choice wins after that.
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(GOALS_OPEN);
      if (v !== null) return v === "1";
    } catch {}
    return typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;
  });
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(GOALS_OPEN, o ? "0" : "1");
      } catch {}
      return !o;
    });
  if (!goals.length) return null;
  const shown = goals.slice(0, 2);
  if (!open)
    return (
      <Glass className="pointer-events-auto flex max-w-[80vw] items-center gap-1.5 py-1 pr-1 pl-3 text-sm font-bold">
        <button type="button" onClick={toggle} aria-expanded={false} className="flex min-w-0 items-center gap-1.5 py-0.5">
          <span className="truncate">{shown[0].title}</span>
          {shown.length > 1 && <span className="shrink-0 rounded-full bg-panel-2 px-1.5 text-xs text-ink-soft">+{shown.length - 1}</span>}
          <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink-soft" />
        </button>
        <GoButton go={shown[0].go} />
      </Glass>
    );
  return (
    <div className="pointer-events-auto flex max-w-70 flex-col gap-2">
      {shown.map((g, i) => (
        <Glass key={g.title} className="flex items-start gap-2 px-3 py-2">
          <button type="button" onClick={toggle} aria-expanded className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-bold">{g.title}</span>
            <span className="block text-xs text-ink-soft">{g.hint}</span>
          </button>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {i === 0 && (
              <button type="button" onClick={toggle} aria-label="Fold goals" className="text-ink-soft">
                <ChevronUp aria-hidden className="h-4 w-4" />
              </button>
            )}
            <GoButton go={g.go} />
          </div>
        </Glass>
      ))}
    </div>
  );
}

export function NeedsDock() {
  const needs = useGame((s) => s.game.needs);
  const g = useGame((s) => s.game.citizen?.look.g ?? "m");
  const smelly = useGame((s) => !!s.game.flags.smelly);
  const low = useGame((s) => !!s.game.flags.low);
  const atWork = useGame((s) => s.activity?.kind === "action" && !!s.activity.plan.action.shift);
  return (
    <div className="pointer-events-auto relative flex items-center gap-2">
      {(smelly || low || atWork) && (
        <div className="absolute -top-6 left-0 flex gap-1">
          {atWork && <span className="rounded-full bg-[#0E7A4B] px-2 py-0.5 text-[11px] font-bold text-white shadow">At work</span>}
          {smelly && <span className="rounded-full bg-[#6B5B2A] px-2 py-0.5 text-[11px] font-bold text-[#F7E7C1] shadow">Smelling</span>}
          {low && <span className="rounded-full bg-[#4F6AAE] px-2 py-0.5 text-[11px] font-bold text-white shadow">Feeling low</span>}
        </div>
      )}
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-[3px] border-[#0E7A4B] bg-[#E9D5AE] shadow sm:h-16 sm:w-16 sm:border-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={AVATAR_ART[g]}
          alt="You"
          className="h-20 w-full object-cover object-top sm:h-28"
        />
      </div>
      {/* One slim row on a phone (icon over bar), a 3-column grid on bigger screens. */}
      <Glass className="flex gap-2 px-2.5 py-1.5 sm:grid sm:grid-cols-3 sm:gap-x-3 sm:gap-y-1.5 sm:px-3 sm:py-2">
        {NEEDS.map(({ key, label }) => (
          <div
            key={key}
            className="flex flex-col items-center gap-1 sm:flex-row sm:gap-1.5"
            title={`${label} ${Math.round(needs[key])}`}
          >
            {(() => {
              const Icon = NEED_ICON[key];
              return (
                <Icon
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-ink-soft"
                  strokeWidth={2.25}
                />
              );
            })()}
            <div
              className={cx(
                "h-2 w-9 overflow-hidden rounded-full bg-panel-2 sm:w-12",
                // Empty: two minutes before it catches up with you.
                needs[key] <= 0 && "animate-pulse bg-danger/60 motion-reduce:animate-none",
              )}
              role="progressbar"
              aria-label={label}
              aria-valuenow={Math.round(needs[key])}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cx(
                  "h-full rounded-full transition-[width]",
                  needs[key] < 25 ? "bg-danger" : NEED_BAR[key],
                )}
                style={{ width: `${needs[key]}%` }}
              />
            </div>
          </div>
        ))}
      </Glass>
    </div>
  );
}

export type Tab = "life" | "campaign" | "vote" | "phone";

export function BottomNav({
  tab,
  onTab,
}: {
  tab: Tab | null;
  onTab: (t: Tab | null) => void;
}) {
  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "life", label: "Life", icon: House },
    { id: "campaign", label: "Campaign", icon: Megaphone },
    { id: "vote", label: "Vote", icon: Vote },
    { id: "phone", label: "Phone", icon: Smartphone },
  ];
  return (
    <Glass className="pointer-events-auto flex gap-1 p-1.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onTab(tab === t.id ? null : t.id)}
          aria-pressed={tab === t.id}
          className={cx(
            "flex min-w-16 flex-col items-center rounded-xl px-3 py-1.5 text-xs font-bold md:min-w-24",
            tab === t.id ? "bg-indigo text-[#F7E7C1]" : "text-ink-soft",
          )}
        >
          <t.icon aria-hidden className="mb-0.5 h-5 w-5" strokeWidth={2.25} />
          {t.label}
        </button>
      ))}
    </Glass>
  );
}

export function Toasts() {
  const first = useGame((s) => s.toasts[0]);
  // Keyed on the count of toasts gone, not the text: after one "+₦8,000" goes, the next "+₦8,000" still
  // gets its own 2.4 seconds instead of staying up for ever. New toasts joining the queue don't reset it.
  const seq = useGame((s) => s.toastSeq);
  useEffect(() => {
    if (!first) return;
    const id = setTimeout(() => getGameStore().getState().shiftToast(), 2400);
    return () => clearTimeout(id);
  }, [first, seq]);
  if (!first) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4">
      <div className="rounded-2xl bg-indigo px-4 py-2.5 text-center font-semibold text-[#F7E7C1] shadow-lg">
        {first}
      </div>
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
          <Button
            key={c.id}
            tone={i === 0 ? "primary" : "ghost"}
            onClick={() => getGameStore().getState().answer(c.id)}
          >
            {c.label}
          </Button>
        ))}
      </div>
    </Modal>
  );
}
