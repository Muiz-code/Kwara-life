"use client";
// While you travel: what is happening (the keke pulling up, climbing in, the ride, arriving), how far
// along you are, and a Skip that jumps to arrival for the same fare and game time.
import { FastForward } from "lucide-react";
import { useEffect, useState } from "react";
import { tripPhase, type TripPhase } from "@/sim/travel";
import { getGameStore, useGame } from "@/store";

const LINES: Record<string, Partial<Record<TripPhase, string>>> = {
  keke: { wait: "Flagging down a keke…", board: "Climbing into the keke", alight: "Paying the keke man" },
  okada: { wait: "Okada man is coming…", board: "Hopping on the back", alight: "Climbing down" },
  danfo: { wait: "Waiting at the bus stop. The conductor dey shout…", board: "Squeezing into the danfo", alight: "\"Owa o!\" Climbing down" },
  bus: { wait: "Waiting at the bus stop. The conductor dey shout…", board: "Squeezing into the bus", alight: "\"Owa o!\" Climbing down" },
  ride: { wait: "Your driver is on the way…", board: "Getting into the car", alight: "Thanking your driver" },
  suv: { wait: "Your driver is bringing the car round…", board: "Getting into your SUV", alight: "Stepping out" },
  horse: { board: "Climbing onto the horse", alight: "Climbing down" },
};

/** performance.now(), the trip's own clock, ticking four times a second. */
function usePerfNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(performance.now());
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function TripBar() {
  const a = useGame((s) => s.activity);
  const now = usePerfNow();
  if (a?.kind !== "trip" || a.ms < 1000 || !now) return null;
  const elapsed = now - a.startedAt;
  const { phase } = tripPhase(a.timing, elapsed);
  const left = Math.max(0, Math.ceil((a.ms - elapsed) / 1000));
  const p = Math.min(1, Math.max(0, elapsed / a.ms));
  const line = phase === "ride" ? `On the way to ${a.trip.destName}` : (LINES[a.trip.mode]?.[phase] ?? `Off to ${a.trip.destName}`);
  return (
    <div className="pointer-events-auto mx-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-indigo/95 px-3 py-2 text-[#F7E7C1] shadow-lg">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold" role="status" aria-live="polite">{line}</div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-keke" style={{ width: `${p * 100}%` }} />
          </div>
          <span className="shrink-0 text-xs tabular-nums opacity-80">
            {a.trip.modeLabel} · {left}s
          </span>
        </div>
      </div>
      <button
        type="button"
        disabled={a.fast}
        onClick={() => getGameStore().getState().skipTrip(performance.now())}
        className="flex shrink-0 items-center gap-1 rounded-xl bg-keke px-3 py-1.5 text-sm font-bold text-[#2A2000] hover:brightness-105 disabled:opacity-70"
      >
        <FastForward aria-hidden className={a.fast ? "h-4 w-4 animate-pulse" : "h-4 w-4"} strokeWidth={2.5} />
        {a.fast ? "Fast" : "Skip"}
      </button>
    </div>
  );
}
