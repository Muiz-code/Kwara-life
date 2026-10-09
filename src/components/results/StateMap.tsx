"use client";
// Nigeria as a tile map: each state in its rough place, coloured by the party leading there. States that just
// reported flash. Tap a state to open its results.
import { motion } from "motion/react";
import { PARTIES } from "@/data/parties";
import { STATES } from "@/data/states";
import type { ZoneCode } from "@/data/zones";
import { leader, type Tally } from "@/sim/results";

const EMPTY = "#2A3560";

export function StateMap({
  states,
  hot,
  selected,
  zone,
  onPick,
}: {
  states: Record<string, Tally>;
  /** States with an upload in the latest feed, keyed by that upload so each new one flashes. */
  hot: Record<string, string>;
  selected?: string;
  /** When a zone is open, the other zones fade back. */
  zone?: ZoneCode;
  onPick: (stateCode: string) => void;
}) {
  return (
    <div className="grid aspect-square w-full gap-[0.3em]" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gridTemplateRows: "repeat(8, minmax(0, 1fr))" }}>
      {STATES.map((s) => {
        const lead = leader(states[s.code]);
        const faded = zone && s.zone !== zone;
        return (
          <motion.button
            key={s.code}
            type="button"
            onClick={() => onPick(s.code)}
            title={s.name}
            aria-label={`${s.name}${lead >= 0 ? `, ${PARTIES[lead].code} leading` : ""}`}
            className="relative flex flex-col items-center justify-center overflow-hidden rounded-[0.45em] text-white"
            style={{ gridColumn: s.grid[0] + 1, gridRow: s.grid[1] + 1 }}
            initial={false}
            animate={{
              backgroundColor: lead >= 0 ? PARTIES[lead].colour : EMPTY,
              opacity: faded ? 0.3 : 1,
            }}
            transition={{ duration: 0.7 }}
            whileHover={{ scale: 1.06 }}
          >
            {hot[s.code] && (
              <motion.span key={hot[s.code]} className="absolute inset-0 bg-white" initial={{ opacity: 0.55 }} animate={{ opacity: 0 }} transition={{ duration: 1.4 }} />
            )}
            {selected === s.code && <span className="absolute inset-0 rounded-[0.45em] ring-[0.18em] ring-[#F2B705] ring-inset" />}
            <span className="text-[0.7em] font-bold tracking-wide">{s.name.slice(0, 3).toUpperCase()}</span>
            {lead >= 0 && <span className="hidden font-sign text-[0.75em] leading-none opacity-90 md:block">{PARTIES[lead].code}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
