"use client";
// Waiting your turn at a counter, then the steps there: your ticket and the number being served, then a
// tracker of steps you tap or hold through (thumbprint on the scanner, pay, collect), then the action runs.
import { Check, FastForward, Fingerprint, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getGameStore, useGame } from "@/store";
import type { ServiceRun } from "@/store/game";
import { chime, cx, usePerfNow } from "./ui";

/** How long an "auto" step plays before moving on. */
const AUTO_MS = 2500;
/** How long you hold for a "hold" step. */
const HOLD_MS = 1200;

export default function ServicePanel() {
  const sv = useGame((s) => s.service);
  const now = usePerfNow();
  if (!sv || !now) return null;
  return sv.stage === "queue" ? <Queue sv={sv} now={now} /> : <Steps sv={sv} />;
}

function Queue({ sv, now }: { sv: ServiceRun; now: number }) {
  const p = Math.min(1, Math.max(0, (now - sv.startedAt) / sv.waitMs));
  const serving = sv.ticket - sv.ahead + Math.floor(p * sv.ahead);
  const left = Math.max(0, Math.ceil((sv.waitMs - (now - sv.startedAt)) / 1000));
  const called = p >= 1;
  useEffect(() => {
    if (!called) return;
    chime();
    getGameStore().getState().serviceCalled(performance.now());
  }, [called]);
  const no = (n: number) => `${sv.service.prefix}${n}`;
  return (
    <div className="pointer-events-auto mx-auto w-full max-w-md rounded-2xl bg-indigo/95 p-3 text-[#F7E7C1] shadow-lg">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[#F7E7C1] px-3 py-1.5 text-center text-indigo">
          <div className="text-[10px] font-bold uppercase tracking-wide">Your number</div>
          <div className="font-sign text-2xl leading-none">{no(sv.ticket)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs opacity-80">Now serving</div>
          <div className="font-sign text-xl leading-tight" role="status" aria-live="polite">
            {no(Math.min(serving, sv.ticket))}
          </div>
          <div className="truncate text-xs opacity-80">
            {sv.ticket - serving > 0 ? `${sv.ticket - serving} ahead of you · about ${left}s` : "You're next"}
          </div>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
        <div className="h-full rounded-full bg-keke" style={{ width: `${p * 100}%` }} />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={sv.fast}
          onClick={() => getGameStore().getState().fastForward(performance.now())}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-keke px-3 py-1.5 text-sm font-bold text-[#2A2000] disabled:opacity-70"
        >
          <FastForward aria-hidden className={cx("h-4 w-4", sv.fast && "animate-pulse")} strokeWidth={2.5} />
          {sv.fast ? "Moving fast" : "Skip the wait"}
        </button>
        <button
          type="button"
          onClick={() => getGameStore().getState().leaveService()}
          className="flex items-center gap-1 rounded-xl bg-white/15 px-3 py-1.5 text-sm font-bold"
        >
          <LogOut aria-hidden className="h-4 w-4" />
          Leave
        </button>
      </div>
    </div>
  );
}

function Steps({ sv }: { sv: ServiceRun }) {
  const step = sv.service.steps[sv.step];
  // An auto step plays out on its own.
  useEffect(() => {
    if (step.do !== "auto") return;
    const id = setTimeout(() => getGameStore().getState().serviceStep(performance.now()), AUTO_MS);
    return () => clearTimeout(id);
  }, [sv.step, step.do]);
  const done = sv.step / sv.service.steps.length;
  return (
    <div className="pointer-events-auto mx-auto w-full max-w-md rounded-2xl bg-panel p-3 text-ink shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold">
          {sv.service.prefix}
          {sv.ticket}, your turn with {sv.service.caller}
        </span>
        <span className="text-xs font-bold text-ink-soft">
          {sv.step + 1} of {sv.service.steps.length}
        </span>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-[#0E7A4B] transition-[width]" style={{ width: `${done * 100}%` }} />
      </div>
      <ol className="mb-3 space-y-1">
        {sv.service.steps.map((s, i) => (
          <li key={s.label} className={cx("flex items-center gap-2 text-sm", i < sv.step ? "text-[#0E7A4B]" : i === sv.step ? "font-bold" : "text-ink-soft")}>
            <span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", i < sv.step ? "border-[#0E7A4B] bg-[#0E7A4B] text-white" : i === sv.step ? "border-indigo" : "border-line")}>
              {i < sv.step && <Check aria-hidden className="h-3 w-3" strokeWidth={3} />}
            </span>
            {s.label}
          </li>
        ))}
      </ol>
      {step.do === "tap" && (
        <button
          type="button"
          onClick={() => getGameStore().getState().serviceStep(performance.now())}
          className="w-full rounded-xl bg-indigo px-3 py-2.5 font-bold text-[#F7E7C1]"
        >
          {step.prompt}
        </button>
      )}
      {step.do === "hold" && <HoldButton prompt={step.prompt} />}
      {step.do === "auto" && (
        <p className="rounded-xl bg-panel-2 px-3 py-2.5 text-center text-sm font-semibold" role="status">
          <span className="inline-block animate-pulse">{step.prompt}</span>
        </p>
      )}
    </div>
  );
}

/** Press and hold until the ring fills: a thumb on the scanner. Let go early and it starts again. */
function HoldButton({ prompt }: { prompt: string }) {
  const [held, setHeld] = useState(0);
  const timer = useRef<number | null>(null);
  const start = () => {
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / HOLD_MS);
      setHeld(p);
      if (p >= 1) {
        timer.current = null;
        navigator.vibrate?.(40);
        getGameStore().getState().serviceStep(performance.now());
        setHeld(0);
        return;
      }
      timer.current = requestAnimationFrame(tick);
    };
    timer.current = requestAnimationFrame(tick);
  };
  const stop = () => {
    if (timer.current) cancelAnimationFrame(timer.current);
    timer.current = null;
    setHeld(0);
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full touch-none overflow-hidden rounded-xl bg-indigo px-3 py-2.5 font-bold text-[#F7E7C1] select-none"
    >
      <span className="absolute inset-y-0 left-0 bg-[#0E7A4B]" style={{ width: `${held * 100}%` }} aria-hidden />
      <span className="relative flex items-center justify-center gap-2">
        <Fingerprint aria-hidden className="h-5 w-5" />
        {held > 0 ? "Keep holding…" : prompt}
      </span>
    </button>
  );
}
