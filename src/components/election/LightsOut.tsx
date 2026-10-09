"use client";
// The very last thing in the season: before you leave, switch off. The bulb, the TV, the fan and the gen are on
// in your parlour; tap each one off. When the last one goes, the room goes dark and the game says goodnight.
import { Fan, Lightbulb, Tv, Zap, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { NEXT_REAL_ELECTION } from "@/data/credits";

type Thing = "bulb" | "tv" | "fan" | "gen";

const THINGS: { id: Thing; label: string; off: string; icon: LucideIcon }[] = [
  { id: "bulb", label: "Bulb", off: "Light off.", icon: Lightbulb },
  { id: "tv", label: "TV", off: "TV off. The news can wait.", icon: Tv },
  { id: "fan", label: "Fan", off: "Fan off.", icon: Fan },
  { id: "gen", label: "Gen", off: "Gen off. No wasting fuel.", icon: Zap },
];

export function LightsOut({ onLeave }: { onLeave: () => void }) {
  const [on, setOn] = useState<Record<Thing, boolean>>({ bulb: true, tv: true, fan: true, gen: true });
  const [said, setSaid] = useState("Before you go, switch everything off.");
  const left = THINGS.filter((t) => on[t.id]).length;
  const dark = left === 0;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden p-6 text-center"
      initial={{ opacity: 0, backgroundColor: "#3A2E1E" }}
      animate={{ opacity: 1, backgroundColor: dark ? "#000000" : left > 2 ? "#3A2E1E" : left > 1 ? "#251E16" : "#14110D" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* The bulb's glow fills the room until it goes off. */}
      <motion.div
        className="pointer-events-none absolute top-0 left-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[#F7C46A] blur-3xl"
        animate={{ opacity: on.bulb ? 0.35 : 0 }}
        transition={{ duration: 0.6 }}
      />
      <AnimatePresence mode="wait">
        {!dark ? (
          <motion.div key="room" className="relative flex w-full max-w-lg flex-col items-center text-[#F1E8D4]" exit={{ opacity: 0 }}>
            <p className="font-sign text-3xl">Lights out, Naija</p>
            <motion.p key={said} className="mt-2 min-h-6 text-white/80" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              {said}
            </motion.p>
            <div className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
              {THINGS.map((t) => (
                <Switch
                  key={t.id}
                  thing={t}
                  on={on[t.id]}
                  onOff={() => {
                    setOn((o) => ({ ...o, [t.id]: false }));
                    setSaid(t.off);
                  }}
                />
              ))}
            </div>
            <p className="mt-6 text-xs text-white/50">{left} still on. Tap to switch off.</p>
          </motion.div>
        ) : (
          <motion.div
            key="dark"
            className="relative flex flex-col items-center text-[#F1E8D4]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 1.2 }}
          >
            <p className="font-sign text-4xl">Goodnight, Naija.</p>
            <p className="mt-3 max-w-sm text-white/70">The game is over. See you at the real polls in {NEXT_REAL_ELECTION}. Go and vote wisely.</p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.6 }}>
              <button
                type="button"
                onClick={onLeave}
                className="mt-8 rounded-full border-2 border-[#F1E8D4]/40 px-6 py-2.5 font-bold text-[#F1E8D4] hover:border-[#F1E8D4]/80"
              >
                Leave the game
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Switch({ thing, on, onOff }: { thing: (typeof THINGS)[number]; on: boolean; onOff: () => void }) {
  const Icon = thing.icon;
  return (
    <motion.button
      type="button"
      disabled={!on}
      onClick={onOff}
      aria-label={on ? `Switch off the ${thing.label.toLowerCase()}` : `${thing.label} is off`}
      whileTap={{ scale: 0.92 }}
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-colors ${on ? "border-[#F2B705]/60 bg-white/10" : "border-white/10 bg-black/30"}`}
    >
      <motion.span
        animate={
          !on
            ? { rotate: 0, x: 0, opacity: 0.35 }
            : thing.id === "fan"
              ? { rotate: 360, opacity: 1 }
              : thing.id === "gen"
                ? { x: [0, -1.5, 1.5, 0], opacity: 1 }
                : thing.id === "tv"
                  ? { opacity: [1, 0.75, 1] }
                  : { opacity: 1 }
        }
        transition={
          !on
            ? { duration: 0.6 }
            : thing.id === "fan"
              ? { duration: 0.8, repeat: Infinity, ease: "linear" }
              : thing.id === "gen"
                ? { duration: 0.15, repeat: Infinity }
                : { duration: 1.2, repeat: Infinity }
        }
        className={on ? "text-[#F2B705] drop-shadow-[0_0_10px_#F2B705]" : "text-white"}
      >
        <Icon className="h-10 w-10" strokeWidth={1.75} aria-hidden />
      </motion.span>
      <span className="text-sm font-bold text-[#F1E8D4]">{thing.label}</span>
      <span className={`h-5 w-9 rounded-full p-0.5 ${on ? "bg-[#0E7A4B]" : "bg-white/20"}`} aria-hidden>
        <motion.span className="block h-4 w-4 rounded-full bg-white" animate={{ x: on ? 16 : 0 }} />
      </span>
    </motion.button>
  );
}
