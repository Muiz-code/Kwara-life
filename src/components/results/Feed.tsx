"use client";
// Polling units as they report, newest on top. Totals only: never who voted or how.
import { AnimatePresence, motion } from "motion/react";
import { LGA } from "@/data/geography";
import { STATE } from "@/data/states";
import type { FeedItem } from "@/sim/live";
import { watTime } from "./time";

export function Feed({ items, timeAt }: { items: FeedItem[]; timeAt: (progress: number) => number }) {
  if (!items.length) return <p className="text-[0.85em] text-white/50">No polling unit has reported here yet.</p>;
  return (
    <ul className="flex flex-col gap-[0.3em]">
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((f) => (
          <motion.li
            key={`${f.puCode}@${f.at}`}
            layout
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="grid grid-cols-[4.2em_1fr_auto] items-baseline gap-[0.5em] text-[0.85em]"
          >
            <span className="text-white/50 tabular-nums">{watTime(timeAt(f.at))}</span>
            <span className="truncate">
              {LGA[f.lgaCode]?.name}, {STATE[f.stateCode]?.name} <span className="text-white/50">PU {f.puCode.split("/").pop()}</span>
            </span>
            <b className="text-[#F2B705] tabular-nums">+{f.added.toLocaleString("en-NG")}</b>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
