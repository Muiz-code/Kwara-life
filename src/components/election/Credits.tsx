"use client";
// The closing credits, rolling like the end of a film: who built the game, the brands that backed it, thanks to
// every player and the season's top ten, the partners, a word on voting wisely, then the owner's signed message.
// It scrolls by itself; touching it hands control back to the player.
import { motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { BUILDERS, CLOSING_MESSAGE, NEXT_REAL_ELECTION, PARTNERS, SIGNED, TERM_YEARS } from "@/data/credits";
import { useSeasonCredits } from "@/net/credits";
import { Button, DISCLAIMER } from "../game/ui";

const SPEED = 38; // pixels a second

export function Credits({ onClose }: { onClose: () => void }) {
  const credits = useSeasonCredits();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let held = false;
    let last = performance.now();
    let pos = el.scrollTop;
    let raf = 0;
    const hold = () => (held = true);
    el.addEventListener("pointerdown", hold);
    el.addEventListener("wheel", hold, { passive: true });
    el.addEventListener("touchstart", hold, { passive: true });
    const step = (t: number) => {
      if (!held) {
        pos += ((t - last) / 1000) * SPEED;
        el.scrollTop = pos;
      }
      last = t;
      if (el.scrollTop + el.clientHeight < el.scrollHeight - 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", hold);
      el.removeEventListener("wheel", hold);
      el.removeEventListener("touchstart", hold);
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-[#0B1022] text-[#F1E8D4]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div ref={box} className="h-full overflow-y-auto px-6 text-center">
        <div className="mx-auto flex max-w-xl flex-col gap-14 pt-[60vh] pb-16">
          <Block title="Naija Votes">
            <p className="text-white/70">The first season. Election day, Saturday 14 November 2026.</p>
          </Block>

          <Block title="Built by">
            {BUILDERS.map((b) => (
              <p key={b.name}>
                <b className="text-lg">{b.name}</b>
                <span className="block text-sm text-white/60">{b.role}</span>
              </p>
            ))}
          </Block>

          {!!credits?.brands.length && (
            <Block title="Brought to you by">
              <p className="mb-1 text-sm text-white/60">The brands that backed this season the most</p>
              <ol className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {credits.brands.map((b) => (
                  <li key={b} className="font-semibold">
                    {b}
                  </li>
                ))}
              </ol>
            </Block>
          )}

          <Block title="Thank you, players">
            <p>
              To everyone who picked a state and an LGA, hustled, collected a PVC, queued in the sun and voted: this season was yours. Thank you
              for playing.
            </p>
          </Block>

          {!!credits?.players.length && (
            <Block title="Top players of the season">
              <ol className="flex flex-col gap-1">
                {credits.players.map((p, i) => (
                  <li key={`${p.name}-${i}`}>
                    <span className="mr-2 font-sign text-[#F2B705]">{i + 1}</span>
                    <b>{p.name}</b>
                    {p.place && <span className="text-white/60">, {p.place}</span>}
                  </li>
                ))}
              </ol>
            </Block>
          )}

          <Block title="Special thanks">
            <p className="font-sign text-2xl tracking-wide">{PARTNERS.join("  ·  ")}</p>
          </Block>

          <Block title="Vote wisely">
            <p>
              The choice you make in the real election of {NEXT_REAL_ELECTION} stays with all of us until {NEXT_REAL_ELECTION + TERM_YEARS}. Four
              years is a long time. Collect your PVC, come out on election day, protect your vote, and choose with your head and your heart. Nobody
              should buy your future for one day&apos;s money.
            </p>
          </Block>

          <Block title="A word before you go">
            {CLOSING_MESSAGE.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p className="mt-4 font-sign text-3xl text-[#F2B705]">Signed, {SIGNED}</p>
          </Block>

          <p className="text-sm text-white/60">{DISCLAIMER}</p>
          <div>
            <Button tone="keke" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/20"
      >
        Skip
      </button>
    </motion.div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-bold tracking-[0.3em] text-[#F2B705] uppercase">{title}</h2>
      {children}
    </section>
  );
}
