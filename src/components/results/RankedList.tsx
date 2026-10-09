"use client";
// Party standings, most votes first. The top three sit on cards; the next seven are rows with bars; the rest are
// compact chips, so every party is always on screen. A party that overtakes another slides past it, between
// cards, rows and chips alike, and a new leader gets a "takes the lead" flash. Ties go alphabetically
// (sim/live.ts rankParties).
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useState } from "react";
import { PARTIES } from "@/data/parties";
import { rankParties } from "@/sim/live";
import type { Tally } from "@/sim/results";
import { Ticker } from "./Ticker";

const CODES = PARTIES.map((p) => p.code);
const PODIUM = 3;
const ROWS = 10;
const SPRING = { type: "spring", stiffness: 380, damping: 34 } as const;
const PLACE = ["1st", "2nd", "3rd"];

export function RankedList({ tally }: { tally: Tally }) {
  const order = rankParties(tally, CODES);
  const total = tally.reduce((a, b) => a + b, 0);
  const lead = total ? order[0] : -1;
  const top = tally[order[0]] || 1;
  const pct = (v: number) => (total ? ((v / total) * 100).toFixed(1) : "0.0");
  // Remember the last leader so a change of lead can flash. Updating state while rendering is React's pattern
  // for "adjust state when a prop changes".
  const [seen, setSeen] = useState({ lead, flashes: 0 });
  if (seen.lead !== lead) setSeen({ lead, flashes: seen.lead >= 0 && lead >= 0 ? seen.flashes + 1 : seen.flashes });

  return (
    <LayoutGroup>
      <ol className="grid grid-cols-3 gap-[0.5em]">
        {order.slice(0, PODIUM).map((i, rank) => {
          const p = PARTIES[i];
          const v = tally[i];
          const gap = rank === 0 ? v - tally[order[1]] : tally[order[rank - 1]] - v;
          return (
            <motion.li
              key={p.code}
              layout
              layoutId={`party-${p.code}`}
              transition={SPRING}
              className="relative flex flex-col overflow-hidden rounded-[0.9em] p-[0.8em]"
              style={{ background: `linear-gradient(160deg, ${p.colour}, ${p.colour}55 70%, #ffffff0d)` }}
            >
              <span
                className={`self-start rounded-full px-[0.6em] text-[0.75em] font-bold ${rank === 0 ? "bg-[#F2B705] text-[#0F1730]" : "bg-black/30 text-white"}`}
              >
                {PLACE[rank]}
              </span>
              <b className="mt-[0.3em] font-sign text-[2.4em] leading-none tracking-wide">{p.code}</b>
              <small className="hidden truncate text-[0.8em] text-white/80 sm:block">{p.name}</small>
              <Ticker value={v} className="mt-[0.4em] block font-sign text-[1.8em] leading-none" />
              <small className="text-[0.8em] text-white/80 tabular-nums">
                {pct(v)}%
                {total > 0 && (
                  <span className="hidden sm:inline">
                    {" · "}
                    {rank === 0 ? "leads by " : "behind by "}
                    {gap.toLocaleString("en-NG")}
                  </span>
                )}
              </small>
              <AnimatePresence>
                {i === lead && seen.flashes > 0 && (
                  <motion.span
                    key={seen.flashes}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[0.9em] bg-[#F2B705]/90 p-[0.4em] text-center font-sign text-[1.4em] leading-tight text-[#0F1730]"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: [0, 1, 1, 0], scale: [0.9, 1.04, 1, 1] }}
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
      <ol className="mt-[0.6em] flex flex-col gap-[0.4em]">
        {order.slice(PODIUM, ROWS).map((i, k) => {
          const p = PARTIES[i];
          const v = tally[i];
          return (
            <motion.li
              key={p.code}
              layout
              layoutId={`party-${p.code}`}
              transition={SPRING}
              className="grid grid-cols-[1.6em_0.45em_4.2em_1fr_auto] items-center gap-[0.6em] rounded-[0.7em] bg-white/[0.06] px-[0.8em] py-[0.45em] sm:grid-cols-[1.6em_0.45em_13em_1fr_auto]"
            >
              <span className="text-[1.1em] font-bold text-white/50 tabular-nums">{PODIUM + k + 1}</span>
              <span className="h-[1.6em] rounded-full" style={{ background: p.colour }} />
              <span className="min-w-0 leading-tight">
                <b className="block font-sign text-[1.4em] leading-none tracking-wide">{p.code}</b>
                <small className="hidden truncate text-[0.75em] text-white/60 sm:block">{p.name}</small>
              </span>
              <span className="h-[0.8em] overflow-hidden rounded-full bg-white/10">
                <motion.span
                  className="block h-full rounded-full"
                  style={{ background: p.colour }}
                  initial={false}
                  animate={{ width: `${(v / top) * 100}%` }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              </span>
              <span className="text-right leading-tight">
                <Ticker value={v} className="block font-sign text-[1.3em] leading-none" />
                <small className="text-[0.8em] text-white/60 tabular-nums">{pct(v)}%</small>
              </span>
            </motion.li>
          );
        })}
      </ol>
      <ol className="mt-[0.7em] flex flex-wrap gap-[0.35em]">
        {order.slice(ROWS).map((i, k) => {
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
              <span className="text-white/50 tabular-nums">{ROWS + k + 1}</span>
              <b>{p.code}</b>
              <Ticker value={tally[i]} className="text-white/70" />
            </motion.li>
          );
        })}
      </ol>
    </LayoutGroup>
  );
}
