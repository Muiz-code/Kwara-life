"use client";
// On shift: you are at work, the time left, and whatever comes up (a customer, a file, a bug) to handle in
// time for a bonus. Skip still fast-forwards the shift; no tasks come while it does.
import { Briefcase, FastForward } from "lucide-react";
import { CAREERS } from "@/data/careers";
import { TASK_EVERY, TASK_FIRST, TASK_WINDOW, WORK_TASKS, taskAt, taskPay } from "@/data/work-tasks";
import { getGameStore, useGame } from "@/store";
import { cx, naira, usePerfNow } from "./ui";

export default function WorkPanel() {
  const a = useGame((s) => s.activity);
  const c = useGame((s) => s.game.citizen);
  const now = usePerfNow();
  if (a?.kind !== "action" || !a.plan.action.shift || !now) return null;
  const elapsed = now - a.startedAt;
  const left = Math.max(0, Math.ceil((a.ms - elapsed) / 1000));
  const p = Math.min(1, Math.max(0, elapsed / a.ms));
  const tasks = c ? WORK_TASKS[c.career] : undefined;
  const i = a.fast || !tasks ? null : taskAt(elapsed);
  const task = i !== null && tasks && !a.tasks?.includes(i) ? tasks[i % tasks.length] : null;
  // How much of this task's window is left, for its shrinking bar.
  const windowLeft = i !== null ? 1 - (elapsed - TASK_FIRST - i * TASK_EVERY) / TASK_WINDOW : 0;
  const handled = a.tasks?.length ?? 0;
  const label = c ? CAREERS[c.career]?.workLabel : a.plan.action.label;
  return (
    <div className="pointer-events-auto mx-auto w-full max-w-md rounded-2xl bg-indigo/95 p-3 text-[#F7E7C1] shadow-lg">
      <div className="flex items-center gap-2">
        <Briefcase aria-hidden className="h-5 w-5 shrink-0 text-keke" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">At work · {label}</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-keke" style={{ width: `${p * 100}%` }} />
          </div>
        </div>
        <span className="shrink-0 text-xs tabular-nums opacity-80">{left}s</span>
        <button
          type="button"
          disabled={a.fast}
          onClick={() => getGameStore().getState().fastForward(performance.now())}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-white/15 px-2.5 py-1 text-xs font-bold disabled:opacity-70"
        >
          <FastForward aria-hidden className={cx("h-3.5 w-3.5", a.fast && "animate-pulse")} strokeWidth={2.5} />
          {a.fast ? "Fast" : "Skip"}
        </button>
      </div>
      {tasks && (
        <div className="mt-2">
          {task ? (
            <button
              type="button"
              onClick={() => {
                navigator.vibrate?.(30);
                getGameStore().getState().workTask(i!, performance.now());
              }}
              className="relative w-full overflow-hidden rounded-xl bg-[#F7E7C1] px-3 py-2 text-left text-indigo"
            >
              <span className="absolute inset-x-0 bottom-0 h-1 bg-keke" style={{ width: `${Math.max(0, windowLeft) * 100}%` }} aria-hidden />
              <span className="block text-xs font-semibold opacity-80">{task.what}</span>
              <span className="block font-bold">{task.act} →</span>
            </button>
          ) : (
            <p className="rounded-xl bg-white/10 px-3 py-2 text-xs" role="status">
              {a.fast ? "Rushing through the rest of the shift…" : "Working… something will come up soon"}
            </p>
          )}
          <p className="mt-1.5 text-xs opacity-80">
            Handled {handled} · bonus so far {naira(handled * taskPay(c?.monthlyPay ?? 0))}
          </p>
        </div>
      )}
    </div>
  );
}
