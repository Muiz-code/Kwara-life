"use client";
// Small building blocks for the game screens: glass pills and cards over the map, sheets and modals.
import { useEffect, useState, type ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Glass({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("rounded-2xl border border-white/60 bg-white/85 text-ink shadow-[0_6px_24px_rgba(31,42,77,0.18)] backdrop-blur-md dark:border-white/10 dark:bg-[#1B2443]/90", className)}>
      {children}
    </div>
  );
}

export function Button({
  children, onClick, disabled, tone = "primary", className, small,
}: { children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: "primary" | "keke" | "ghost" | "danger"; className?: string; small?: boolean }) {
  const tones = {
    primary: "bg-[#0E7A4B] text-white hover:bg-[#0B6A41]",
    keke: "bg-keke text-[#2A2000] hover:brightness-95",
    ghost: "bg-panel-2 text-ink hover:brightness-95",
    danger: "bg-danger text-white hover:brightness-95",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx("rounded-full font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45", small ? "px-3 py-1.5 text-sm" : "px-5 py-3", tones[tone], className)}
    >
      {children}
    </button>
  );
}

/** A bottom sheet on phones, a side card on wide screens. */
export function Sheet({ title, onClose, children }: { title: ReactNode; onClose?: () => void; children: ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 max-h-[70dvh] overflow-y-auto rounded-t-3xl bg-panel p-4 pb-32 shadow-[0_-8px_30px_rgba(0,0,0,0.25)] md:inset-x-auto md:right-4 md:bottom-24 md:top-24 md:w-[400px] md:rounded-3xl md:pb-4">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line md:hidden" />
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 className="font-sign text-2xl leading-tight text-ink">{title}</h2>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-panel-2 px-3 py-1 text-sm font-bold text-ink-soft">
            Close
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function Modal({ title, children, wide }: { title: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[#0A0E1E]/55 p-4" role="dialog" aria-modal="true">
      <div className={cx("max-h-[90dvh] w-full overflow-y-auto rounded-3xl bg-panel p-5 text-ink shadow-2xl", wide ? "max-w-2xl" : "max-w-md")}>
        <h3 className="mb-2 font-sign text-2xl leading-tight">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Chip({ children, tone }: { children: ReactNode; tone?: "cost" | "up" | "down" }) {
  return (
    <span className={cx("rounded-md bg-panel px-2 py-0.5 text-xs font-semibold", tone === "cost" ? "text-danger" : tone === "up" ? "text-up" : tone === "down" ? "text-danger" : "text-ink-soft")}>
      {children}
    </span>
  );
}

/** Real wall-clock time, refreshed every few seconds. */
export function useNow(everyMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

export const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");

export const DISCLAIMER = "A game. Not affiliated with INEC. Not a poll or prediction.";
