"use client";
// Party standings, most votes first. When a party overtakes another its row slides past it, and a new leader
// gets a "takes the lead" flash. The top rows are large; the rest sit below as compact chips so every party is
// always on screen. Ties go alphabetically (sim/live.ts rankParties).
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useState } from "react";
import { PARTIES } from "@/data/parties";
import { rankParties } from "@/sim/live";
import type { Tally } from "@/sim/results";
import { Ticker } from "./Ticker";

const CODES = PARTIES.map((p) => p.code);
const TOP = 8;
const SPRING = { type: "spring", stiffness: 380, damping: 34 } as const;

export function RankedList({ tally }: { tally: Tally }) {
  const order = rankParties(tally, CODES);
  const total = tally.reduce((a, b) => a + b, 0);
  const lead = total ? order[0] : -1;
  const top = tally[order[0]] || 1;
  // Remember the last leader so a change of lead can flash. Updating state while rendering is React's pattern
  // for "adjust state when a prop changes".
  const [seen, setSeen] = useState({ lead, flashes: 0 });
  if (seen.lead !== lead) setSeen({ lead, flashes: seen.lead >= 0 && lead >= 0 ? seen.flashes + 1 : seen.flashes });

  return (
    <LayoutGroup>
      <ol className="flex flex-col gap-[0.45em]">
        {order.slice(0, TOP).map((i, rank) => {
          const p = PARTIES[i];
          const v = tally[i];
          return (
            <motion.li
              key={p.code}
              layout
              layoutId={`party-${p.code}`}
              transition={SPRING}
              className="relative grid grid-cols-[1.6em_0.45em_4.2em_1fr_auto] sm:grid-cols-[1.6em_0.45em_13em_1fr_auto] items-center gap-[0.6em] overflow-hidden rounded-[0.7em] bg-white/[0.06] px-[0.8em] py-[0.55em]"
            >
              <span className="text-[1.1em] font-bold text-white/50 tabular-nums">{rank + 1}</span>
              <span className="h-[1.9em] rounded-full" style={{ background: p.colour }} />
              <span className="min-w-0 leading-tight">
                <b className="block font-sign text-[1.7em] leading-none tracking-wide">{p.code}</b>
                <small className="hidden truncate text-[0.75em] text-white/60 sm:block">{p.name}</small>
              </span>
              <span className="h-[0.9em] overflow-hidden rounded-full bg-white/10">
                <motion.span
                  className="block h-full rounded-full"
                  style={{ background: p.colour }}
                  initial={false}
                  animate={{ width: `${(v / top) * 100}%` }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              </span>
              <span className="text-right leading-tight">
                <Ticker value={v} className="block font-sign text-[1.5em] leading-none" />
                <small className="text-[0.8em] text-white/60 tabular-nums">{total ? ((v / total) * 100).toFixed(1) : "0.0"}%</small>
              </span>
              <AnimatePresence>
                {i === lead && seen.flashes > 0 && (
                  <motion.span
                    key={seen.flashes}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[0.7em] bg-[#F2B705]/90 font-sign text-[1.4em] text-[#0F1730]"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: [0, 1, 1, 0], scale: [0.9, 1.02, 1, 1] }}
                    transition={{ duration: 3.2, times: [0, 0.12, 0.8, 1] }}
                  >
                    {p.code} takes the lead
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ol>
      <ol className="mt-[0.7em] flex flex-wrap gap-[0.35em]">
        {order.slice(TOP).map((i, k) => {
          const p = PARTIES[i];
          return (
            <motion.li
              key={p.code}
              layout
              layoutId={`party-${p.code}`}
              transition={SPRING}
              className="flex items-center gap-[0.4em] rounded-full bg-white/[0.06] py-[0.25em] pr-[0.7em] pl-[0.35em] text-[0.85em]"
            >
              <span className="h-[0.8em] w-[0.8em] rounded-full" style={{ background: p.colour }} />
              <span className="text-white/50 tabular-nums">{TOP + k + 1}</span>
              <b>{p.code}</b>
              <Ticker value={tally[i]} className="text-white/70" />
            </motion.li>
          );
        })}
      </ol>
    </LayoutGroup>
  );
}
