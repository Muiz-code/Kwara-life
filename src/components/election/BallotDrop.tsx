"use client";
// The ballot folding and dropping into the box, and the inked thumb once the vote is counted.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useGame } from "@/store";

/** A folded ballot slides down into the box's slot. Plays once, about 1.5 seconds. */
export function BallotDrop() {
  return (
    <div className="relative mx-auto h-48 w-48" aria-hidden>
      <motion.div
        className="absolute left-1/2 z-10 h-16 w-20 -translate-x-1/2 rounded-sm border border-[#d8c49e] bg-white shadow"
        initial={{ top: -8, rotate: -10, scaleY: 1 }}
        animate={{ top: [-8, 20, 88], rotate: [-10, 0, 0], scaleY: [1, 0.55, 0.55], opacity: [1, 1, 0] }}
        transition={{ duration: 1.4, times: [0, 0.45, 1], ease: "easeIn" }}
      >
        <span className="absolute top-4 left-6 h-4 w-6 rounded-full bg-[#5B2C83]/80" />
      </motion.div>
      <div className="absolute inset-x-4 bottom-0 h-28 rounded-xl border-4 border-[#26355E]/30 bg-[#E9EEF7]/90">
        <span className="absolute top-3 left-1/2 h-2 w-24 -translate-x-1/2 rounded-full bg-[#26355E]" />
        <span className="absolute inset-x-0 bottom-3 text-center text-[11px] font-bold tracking-[0.25em] text-[#26355E]/60">BALLOT BOX</span>
      </div>
    </div>
  );
}

/**
 * Shows the inked thumb for a moment when this player's ballot is accepted. It watches the store, so it works
 * the same whether the vote went through the server or straight to the local game.
 */
export function VotedCelebration() {
  const ballot = useGame((s) => s.myBallot);
  const [seen, setSeen] = useState(ballot);
  const [show, setShow] = useState(false);
  if (ballot !== seen) {
    setSeen(ballot);
    if (ballot && !seen) setShow(true);
  }
  return <VotedMoment show={show} onHide={() => setShow(false)} />;
}

/** The inked thumb and "You voted", for a few seconds. Also used by the results demo. */
export function VotedMoment({ show, onHide }: { show: boolean; onHide: () => void }) {
  const hide = useRef(onHide);
  useEffect(() => {
    hide.current = onHide;
  }, [onHide]);
  useEffect(() => {
    if (!show) return;
    const id = setTimeout(() => hide.current(), 3200);
    return () => clearTimeout(id);
  }, [show]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-auto fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#0A0E1E]/60 p-6 text-center text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onHide}
          role="status"
        >
          <motion.div
            className="relative h-28 w-20 rounded-t-[2.6rem] rounded-b-2xl bg-[#B07A55] shadow-xl"
            initial={{ y: 40, rotate: -12, opacity: 0 }}
            animate={{ y: 0, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 12 }}
          >
            <motion.span
              className="absolute top-3 left-3 h-12 w-14 rounded-t-[2rem] rounded-b-lg bg-[#5B2C83]"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              style={{ originY: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            />
          </motion.div>
          <motion.p className="mt-5 font-sign text-3xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            You voted
          </motion.p>
          <motion.p className="mt-1 max-w-xs text-sm opacity-90" initial={{ opacity: 0 }} animate={{ opacity: 0.9 }} transition={{ delay: 0.8 }}>
            Your thumb carries the purple ink. Your vote is in the box and counting on the live results.
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
