"use client";
// Daily: your streak, today's three missions and the stamp book of firsts.
import { Award, Check, Flame } from "lucide-react";
import { MISSIONS, STAMPS, streakReward } from "@/sim";
import { watDate } from "@/sim/civic";
import { useGame } from "@/store";
import { clockNow } from "@/store/clock";
import { cx, naira } from "./ui";

const MISSION = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

export default function DailyApp() {
  const flags = useGame((s) => s.game.flags);
  const today = watDate(clockNow());
  const streak = flags.streak?.last === today ? flags.streak.count : 0;
  const daily = flags.daily?.day === today ? flags.daily.missions : [];
  const stamps = flags.stamps ?? {};
  const got = STAMPS.filter((s) => stamps[s.id] !== undefined).length;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#E67E22] to-[#C0392B] p-3 text-white">
        <Flame aria-hidden className="h-8 w-8 shrink-0" />
        <div>
          <div className="font-sign text-2xl leading-none">Day {streak || 1}</div>
          <div className="text-xs opacity-90">Come back tomorrow for {naira(streakReward((streak || 0) + 1))}</div>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Today&apos;s missions</h3>
        {!daily.length && <p className="text-ink-soft">Your missions arrive with your first move today.</p>}
        <ul className="space-y-1.5">
          {daily.map((m) => {
            const def = MISSION[m.id];
            if (!def) return null;
            const done = m.got >= def.need;
            return (
              <li key={m.id} className={cx("flex items-center gap-2 rounded-xl p-2", done ? "bg-[#0E7A4B]/10" : "bg-panel-2")}>
                <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2", done ? "border-[#0E7A4B] bg-[#0E7A4B] text-white" : "border-line")}>
                  {done && <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className={cx("min-w-0 flex-1 font-semibold", done && "text-[#0E7A4B]")}>
                  {def.label}
                  {def.need > 1 && !done && <span className="text-ink-soft"> ({m.got} of {def.need})</span>}
                </span>
                <span className="shrink-0 text-xs font-bold">{naira(def.reward)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          Stamp book · {got} of {STAMPS.length}
        </h3>
        <ul className="grid grid-cols-3 gap-1.5">
          {STAMPS.map((s) => {
            const have = stamps[s.id] !== undefined;
            return (
              <li key={s.id} className={cx("flex flex-col items-center rounded-xl p-2 text-center", have ? "bg-[#F2B705]/20" : "bg-panel-2 opacity-60")}>
                <Award aria-hidden className={cx("mb-1 h-6 w-6", have ? "text-[#B5791A]" : "text-ink-soft")} />
                <span className="text-[11px] leading-tight font-semibold">{s.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
