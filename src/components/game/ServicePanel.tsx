"use client";
// Waiting your turn at a counter, then the steps there: your ticket and the number being served, then a
// tracker of steps you tap or hold through (thumbprint on the scanner, the receipt, paying by transfer, POS or
// cash, collect), then the action runs. Paying is play only: the money comes off your in-game balance either way.
import { Banknote, Check, CreditCard, FastForward, Fingerprint, LogOut, Smartphone, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { receiptItem } from "@/data/services";
import { clockNow } from "@/store/clock";
import { getGameStore, useGame } from "@/store";
import type { ServiceRun } from "@/store/game";
import { chime, cx, naira, usePerfNow } from "./ui";

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
          {sv.service.queue ? `${sv.service.prefix}${sv.ticket}, your turn with ${sv.service.caller}` : `Buying from ${sv.service.caller}`}
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
      {step.do === "receipt" && <Receipt sv={sv} prompt={step.prompt} />}
      {step.do === "pay" && <Pay key={sv.step} total={sv.price} />}
      {step.do === "auto" && (
        <p className="rounded-xl bg-panel-2 px-3 py-2.5 text-center text-sm font-semibold" role="status">
          <span className="inline-block animate-pulse">{step.prompt}</span>
        </p>
      )}
    </div>
  );
}

/** Press and hold until the bar fills: a thumb on the scanner, a PIN on the POS. Let go early and it starts again. */
function HoldButton({ prompt, Icon = Fingerprint }: { prompt: string; Icon?: LucideIcon }) {
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
        <Icon aria-hidden className="h-5 w-5" />
        {held > 0 ? "Keep holding…" : prompt}
      </span>
    </button>
  );
}

const next = () => getGameStore().getState().serviceStep(performance.now());

/** The paper receipt: shop, number, date, what you are buying and the total, with the usual small print. */
function Receipt({ sv, prompt }: { sv: ServiceRun; prompt: string }) {
  const when = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
        clockNow(),
      ),
    [],
  );
  // Cash scarcity: the POS charge shows as its own line.
  const charge = Math.max(0, sv.price - sv.listPrice);
  const line = (l: string, r: string, strong?: boolean) => (
    <div className={cx("flex justify-between gap-3", strong && "text-sm font-bold")}>
      <span className="min-w-0">{l}</span>
      <span className="shrink-0">{r}</span>
    </div>
  );
  return (
    <>
      <div className="mb-3 rounded-md bg-[#FFFDF6] px-4 py-3 font-mono text-xs text-[#2B2B2B] shadow-inner" role="group" aria-label="Receipt">
        <div className="text-center text-sm font-bold uppercase">{sv.shop || "Receipt"}</div>
        <div className="text-center">Receipt No. {String(sv.ticket * 7919 + (Math.floor(sv.startedAt) % 997)).padStart(6, "0")}</div>
        <div className="mb-2 text-center">{when}</div>
        <div className="space-y-1 border-y border-dashed border-[#2B2B2B]/40 py-2">
          {line(`1 x ${receiptItem(sv.item)}`, naira(sv.price - charge))}
          {charge > 0 && line("POS charge (no cash)", naira(charge))}
        </div>
        <div className="py-2">{line("TOTAL", naira(sv.price), true)}</div>
        <div className="border-t border-dashed border-[#2B2B2B]/40 pt-2 text-center text-[10px] leading-snug">
          Goods bought in good condition are not returnable.
          <br />
          Thank you for your patronage.
        </div>
      </div>
      <button type="button" onClick={next} className="w-full rounded-xl bg-indigo px-3 py-2.5 font-bold text-[#F7E7C1]">
        {prompt}
      </button>
    </>
  );
}

type Method = "transfer" | "pos" | "cash";

/** Pick how to pay, then it plays out: the bank app, the POS keypad or counting notes. */
function Pay({ total }: { total: number }) {
  const [method, setMethod] = useState<Method | null>(null);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (method !== "transfer") return;
    const a = setTimeout(() => setSent(true), 1600);
    const b = setTimeout(next, 2600);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [method]);
  if (!method) {
    const ways: [Method, string, LucideIcon][] = [
      ["transfer", "Transfer", Smartphone],
      ["pos", "POS", CreditCard],
      ["cash", "Cash", Banknote],
    ];
    return (
      <>
        <p className="mb-2 text-center text-sm font-semibold">{naira(total)}. How will you pay?</p>
        <div className="grid grid-cols-3 gap-2">
          {ways.map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className="flex flex-col items-center gap-1 rounded-xl bg-indigo px-2 py-2.5 text-sm font-bold text-[#F7E7C1]"
            >
              <Icon aria-hidden className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </>
    );
  }
  if (method === "transfer")
    return (
      <p className={cx("rounded-xl px-3 py-2.5 text-center text-sm font-semibold", sent ? "bg-[#0E7A4B] text-white" : "bg-panel-2")} role="status">
        {sent ? `Transfer successful. ${naira(total)} sent` : <span className="inline-block animate-pulse">Network is a bit slow… sending {naira(total)}</span>}
      </p>
    );
  if (method === "pos") return <HoldButton prompt={`Hold to enter your PIN for ${naira(total)}`} Icon={CreditCard} />;
  return (
    <button type="button" onClick={next} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo px-3 py-2.5 font-bold text-[#F7E7C1]">
      <Banknote aria-hidden className="h-5 w-5" />
      Count out {naira(total)} and hand it over
    </button>
  );
}
