"use client";
// Where the public results board gets its numbers. Today the day is simulated in the browser (src/sim/live.ts);
// when the server lands, this hook reads the CDN snapshot and the per-second broadcast instead, and nothing on
// the board changes. The board only ever reads: there is no way to send anything from here.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRESIDENTIAL_2027 as CAL } from "@/data/calendar";
import { liveSchedule, liveSnapshot, type LiveSnapshot } from "@/sim/live";
import { DEBUG_ALLOWED, clockNow, syncClock } from "@/store/clock";

export const ELECTION_SEED = 20261114;

export type BoardPhase = "before" | "live" | "final";

/** The demo plays the whole day in three minutes, then stays closed on the final result. Reload to run it again. Dev builds only. */
const DEMO_DAY_MS = 180_000;

export interface LiveResults {
  /** Null until the clock has ticked once in the browser (the page itself is static). */
  now: number | null;
  phase: BoardPhase;
  snap: LiveSnapshot;
  /** Votes counted in the last minute of polling time. */
  lastMinute: number;
  /** Clock time for a point in the polling day. */
  timeAt: (progress: number) => number;
  demo: boolean;
  /** Demo only: jump the sped-up day to a point (0 = 8am, 1 = 4pm). */
  jump: (progress: number) => void;
}

const OPEN = Date.parse(CAL.pollsOpen);
const CLOSE = Date.parse(CAL.pollsClose);
/** One minute as a share of the polling day. */
const MINUTE = 60_000 / (CLOSE - OPEN);
const timeAt = (p: number) => OPEN + p * (CLOSE - OPEN);

export function useLiveResults(feedFilter?: (puCode: string) => boolean, filterKey = "all"): LiveResults {
  const [tick, setTick] = useState<{ now: number; progress: number; demo: boolean } | null>(null);
  const started = useRef(0);
  const reader = useRef<(() => { now: number; progress: number; demo: boolean }) | null>(null);
  useEffect(() => {
    const demo = DEBUG_ALLOWED && new URLSearchParams(window.location.search).has("demo");
    started.current = performance.now();
    const read = () => {
      if (demo) {
        const t = performance.now() - started.current;
        const progress = Math.min(1, t / DEMO_DAY_MS);
        return { now: timeAt(progress), progress, demo };
      }
      const now = clockNow();
      return { now, progress: (now - OPEN) / (CLOSE - OPEN), demo };
    };
    reader.current = demo ? read : null;
    if (!demo) void syncClock().then(() => setTick(read()));
    const first = requestAnimationFrame(() => setTick(read()));
    const id = setInterval(() => setTick(read()), 1000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(id);
    };
  }, []);
  const jump = useCallback((p: number) => {
    if (!reader.current) return;
    started.current = performance.now() - Math.min(1, Math.max(0, p)) * DEMO_DAY_MS;
    setTick(reader.current());
  }, []);
  const sched = useMemo(() => liveSchedule(ELECTION_SEED), []);
  const progress = tick?.progress ?? -1;
  // Uploads land every few seconds across the country, so recomputing once a tick is plenty.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const snap = useMemo(() => liveSnapshot(sched, progress, 8, feedFilter), [sched, progress, filterKey]);
  const lastMinute = useMemo(
    () => (progress > 0 && progress < 1 ? snap.votesCast - liveSnapshot(sched, progress - MINUTE, 0).votesCast : 0),
    [sched, progress, snap.votesCast],
  );
  const phase: BoardPhase = progress < 0 ? "before" : progress >= 1 ? "final" : "live";
  return { now: tick?.now ?? null, phase, snap, lastMinute, timeAt, demo: tick?.demo ?? false, jump };
}
