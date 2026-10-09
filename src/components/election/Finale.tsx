"use client";
// The end of the season, after collation: the winner over a celebration, then the closing scene at dusk with the
// real-world message, then the closing credits (Credits.tsx), then switching off the lights to leave
// (LightsOut.tsx). Each scene plays its video when one exists (scenes.ts), otherwise an animation drawn here.
// The celebration moves on by itself when its video ends. Party colour and name are overlaid; nothing else about any party appears.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PARTIES } from "@/data/parties";
import { Button, DISCLAIMER } from "../game/ui";
import { Credits } from "./Credits";
import { LightsOut } from "./LightsOut";
import { SCENE_VIDEO } from "./scenes";

export function Finale({
  winner,
  votes,
  onClose,
  onViewResults,
}: {
  winner: number;
  votes: number;
  onClose: () => void;
  /** Shown in the credits while the results are still up (three days after polls close). */
  onViewResults?: () => void;
}) {
  const [stage, setStage] = useState<"winner" | "closing" | "credits" | "lights">("winner");
  // One dark backdrop under every scene, so nothing behind (the results board, the frozen game) ever shows
  // between them: each scene crossfades straight into the next.
  return (
    <div className="fixed inset-0 z-50 bg-[#0B1022]">
      <AnimatePresence>
        {stage === "winner" && <WinnerScene key="winner" winner={winner} votes={votes} onNext={() => setStage("closing")} />}
        {stage === "closing" && <ClosingScene key="closing" onNext={() => setStage("credits")} />}
        {stage === "credits" && <Credits key="credits" onClose={() => setStage("lights")} onViewResults={onViewResults} />}
        {stage === "lights" && <LightsOut key="lights" onLeave={onClose} />}
      </AnimatePresence>
      {stage !== "lights" && (
        <div className="pointer-events-none fixed top-4 left-4 z-[60] flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 text-xs font-bold tracking-wide text-white uppercase backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-[#7FD3A8]" aria-hidden />
          Voting closed · 4pm, Sat 14 Nov
        </div>
      )}
    </div>
  );
}

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.9 } };

/** The scene's video, or null if there is none or it failed to load (then the drawn scene plays). */
function useSceneVideo(src: string | null) {
  const [failed, setFailed] = useState(false);
  return { src: failed ? null : src, onError: () => setFailed(true) };
}

function SceneVideo({ src, loop, onError, onEnded }: { src: string; loop?: boolean; onError: () => void; onEnded?: () => void }) {
  return (
    <video className="absolute inset-0 h-full w-full object-cover" src={src} autoPlay muted playsInline loop={loop} onError={onError} onEnded={onEnded} aria-hidden />
  );
}

/** Seconds the winner stays up after the celebration video ends (or in all, when there is no video). */
const AFTER_VIDEO_S = 2.5;
const NO_VIDEO_S = 9;

function WinnerScene({ winner, votes, onNext }: { winner: number; votes: number; onNext: () => void }) {
  const p = PARTIES[winner];
  const video = useSceneVideo(SCENE_VIDEO.celebration);
  // Moves on by itself: a moment after the video ends, or after a fixed time when there is no video.
  // The parent re-renders every second (the live board), so hold the callback in a ref to keep the timer steady.
  const [ended, setEnded] = useState(false);
  const next = useRef(onNext);
  useEffect(() => {
    next.current = onNext;
  }, [onNext]);
  useEffect(() => {
    if (video.src && !ended) return;
    const id = setTimeout(() => next.current(), (video.src ? AFTER_VIDEO_S : NO_VIDEO_S) * 1000);
    return () => clearTimeout(id);
  }, [video.src, ended]);
  return (
    <motion.div
      {...fade}
      className={`fixed inset-0 z-50 flex flex-col items-center overflow-hidden p-6 text-center text-white ${video.src ? "justify-end pb-16" : "justify-center"}`}
      style={{ background: "#0F1730" }}
    >
      {video.src && <SceneVideo src={video.src} onError={video.onError} onEnded={() => setEnded(true)} />}
      <button type="button" onClick={onNext} className="absolute top-4 right-4 z-10 rounded-full bg-black/30 px-3 py-1 text-xs font-bold hover:bg-black/50">
        Skip
      </button>
      {/* Over the video the party colour rises from the bottom so the villa stays in view; without one it fills the screen. */}
      <div
        className="absolute inset-0"
        style={{
          background: video.src
            ? `linear-gradient(to top, #0F1730f0, ${p.colour}aa 38%, transparent 62%)`
            : `radial-gradient(circle at 50% 40%, ${p.colour}, #0F1730 75%)`,
        }}
      />
      <Celebration colour={p.colour} />
      <div className="relative flex flex-col items-center">
        <motion.p
          className="text-sm font-bold tracking-[0.3em] uppercase opacity-80"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.8, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Naija has a winner
        </motion.p>
        <motion.h1
          className="my-3 font-sign text-7xl sm:text-8xl"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.7, type: "spring", stiffness: 220, damping: 14 }}
        >
          {p.code}
        </motion.h1>
        <motion.p className="text-2xl font-bold" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>
          {p.name}
        </motion.p>
        <motion.p
          className="mt-3 font-sign text-5xl tabular-nums"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.6, type: "spring", stiffness: 200, damping: 15 }}
        >
          {votes.toLocaleString("en-NG")} <span className="text-2xl">votes</span>
        </motion.p>
        <motion.p className="mt-2 max-w-md text-sm opacity-80" initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: 2 }}>
          Most votes in the Naija Votes game election.
        </motion.p>
      </div>
    </motion.div>
  );
}

/** Confetti and fireworks, in the party colour with green and white. */
function Celebration({ colour }: { colour: string }) {
  const colours = ["#F2B705", "#FFFFFF", "#0E7A4B", colour];
  return (
    <div className="pointer-events-none absolute inset-0 motion-reduce:hidden" aria-hidden>
      {Array.from({ length: 6 }, (_, b) => (
        <div key={`b${b}`} className="absolute" style={{ left: `${15 + ((b * 29) % 70)}%`, top: `${12 + ((b * 17) % 40)}%` }}>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                className="absolute h-2 w-2 rounded-full"
                style={{ background: colours[(i + b) % 4] }}
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{ x: Math.cos(a) * 90, y: Math.sin(a) * 90 + 30, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.6, delay: 0.4 + b * 0.55, repeat: Infinity, repeatDelay: 2.2, ease: "easeOut" }}
              />
            );
          })}
        </div>
      ))}
      {Array.from({ length: 48 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute top-0 h-3 w-2 rounded-[1px]"
          style={{ left: `${(i * 37) % 100}%`, background: colours[i % 4] }}
          initial={{ y: "-5vh", rotate: 0 }}
          animate={{ y: "110vh", rotate: 720, x: [0, i % 2 ? 30 : -30, 0] }}
          transition={{ duration: 4 + (i % 5) * 0.6, delay: (i % 12) * 0.3, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}

const CLOSING_LINES = ["The polls are closed.", "The count is done.", "Thank you for voting."];

function ClosingScene({ onNext }: { onNext: () => void }) {
  const video = useSceneVideo(SCENE_VIDEO.closing);
  // With the video, the words wait until she has raised her inked thumb, and sit low so her face stays in view.
  const start = video.src ? 5.5 : 0.6;
  const step = video.src ? 0.7 : 1.1;
  const after = start + CLOSING_LINES.length * step;
  return (
    <motion.div
      {...fade}
      className={`fixed inset-0 z-50 flex flex-col items-center overflow-y-auto p-6 text-white ${video.src ? "justify-end" : "justify-center"}`}
    >
      {video.src ? <SceneVideo src={video.src} onError={video.onError} /> : <Dusk />}
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-[#0F1730]/40 to-[#0F1730]/90" />
      <div className="relative flex max-w-xl flex-col items-center text-center">
        {CLOSING_LINES.map((line, i) => (
          <motion.p
            key={line}
            className={video.src ? "font-sign text-2xl sm:text-3xl" : "font-sign text-3xl sm:text-4xl"}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: start + i * step, duration: 0.7 }}
          >
            {line}
          </motion.p>
        ))}
        {!video.src && <InkedThumb delay={after} />}
        <motion.div
          className="mt-4 space-y-3 rounded-3xl bg-black/35 p-5 text-left backdrop-blur-sm"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: after + 0.8 }}
        >
          <p>You queued, you thumbprinted, you waited for the count. That is how it works in real life too.</p>
          <p className="font-bold">
            Now go and vote for real. Collect your PVC, come out on election day, protect your vote, and choose wisely. Nobody should buy your
            future for one day&apos;s money.
          </p>
          <p className="text-sm opacity-80">{DISCLAIMER} The result of this game says nothing about any real election.</p>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: after + 1.4 }}>
          <Button tone="keke" className="mt-6" onClick={onNext}>
            Continue
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

/** Harmattan dusk over a low skyline: the sun goes down, the lights come on. */
function Dusk() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{ background: "linear-gradient(#E8A55A, #C9643A 55%, #6B3A4A)" }} />
      <motion.div
        className="absolute inset-0"
        style={{ background: "linear-gradient(#26355E, #5B3A5E 55%, #0F1730)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 9, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[#F7C46A] blur-[2px]"
        initial={{ top: "38%", opacity: 1 }}
        animate={{ top: "70%", opacity: 0.2 }}
        transition={{ duration: 9, ease: "easeIn" }}
      />
      <div className="absolute inset-x-0 bottom-0 flex h-[30%] items-end gap-1 px-2">
        {Array.from({ length: 22 }, (_, i) => (
          <div key={i} className="relative flex-1 bg-[#141A30]" style={{ height: `${30 + ((i * 47) % 60)}%` }}>
            <motion.span
              className="absolute top-3 left-1/3 h-2 w-2 bg-[#F2B705]"
              initial={{ opacity: 0 }}
              animate={{ opacity: i % 3 ? 0.9 : 0 }}
              transition={{ delay: 4 + (i % 7) * 0.5, duration: 0.4 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A thumb with the purple ink of someone who voted. */
function InkedThumb({ delay }: { delay: number }) {
  return (
    <motion.div
      className="relative mt-6 h-20 w-14 rounded-t-4xl rounded-b-xl bg-[#B07A55]"
      initial={{ opacity: 0, y: 30, rotate: -8 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ delay, type: "spring", stiffness: 160, damping: 12 }}
      aria-label="A thumb with purple ink"
      role="img"
    >
      <motion.span
        className="absolute top-2 left-2 h-8 w-10 rounded-t-[1.4rem] rounded-b-md bg-[#5B2C83]"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        style={{ originY: 0 }}
        transition={{ delay: delay + 0.4, duration: 0.5 }}
      />
    </motion.div>
  );
}
