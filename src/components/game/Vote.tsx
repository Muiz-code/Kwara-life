"use client";
// The Vote tab, the BVAS and ballot flow, live collation, and the season finale.
import { Check, Fingerprint } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PRESIDENTIAL_2027 as CAL, civicPhase, seasonClosed } from "@/data/calendar";
import { LGA, POLLING_UNITS } from "@/data/geography";
import { submitVote } from "@/net/sync";
import { useTurnout } from "@/net/turnout";
import { PARTY_INDEX, ballot, bvasScan, collate, emptyTally, leader, puSheets, simulateVoters, uploadOrder, type Tally } from "@/sim";
import { turnoutCurve } from "@/sim/live";
import { seasonState } from "@/data/season";
import { useGame } from "@/store";
import { clockNow } from "@/store/clock";
import { BallotDrop } from "../election/BallotDrop";
import { Finale } from "../election/Finale";
import { RankedList } from "../results/RankedList";
import { StateMap } from "../results/StateMap";
import { Ticker } from "../results/Ticker";
import { Button, DISCLAIMER, Modal, Sheet, cx, useNow } from "./ui";

const ELECTION_SEED = 20261114;

/** "Sat 14 Nov, 7:50am" in WAT. */
function longDate(iso: string) {
  const d = new Date(Date.parse(iso) + 3600_000);
  const day = d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const time = h === 0 && m === 0 ? "midnight" : `${h % 12 === 0 ? 12 : h % 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`;
  return `${day}, ${time}`;
}

export function VotePanel({ onClose, onResults }: { onClose: () => void; onResults: () => void }) {
  const c = useGame((s) => s.game.citizen);
  const voted = useGame((s) => s.game.voted.includes(CAL.id));
  const informed = useGame((s) => s.game.informed);
  const civic = useGame((s) => s.game.civic);
  const now = useNow(5000);
  const phase = civicPhase(CAL, now);
  if (!c) return null;
  const steps = [
    ["Registered", c.pvc !== "none"],
    ["PVC collected", c.pvc === "have"],
    ["Voted", voted],
  ] as const;
  return (
    <Sheet title={phase === "results" ? "The election is over" : phase === "polls-open" ? "Polls are open" : "Election"} onClose={onClose}>
      <ol className="mb-3 flex gap-2">
        {steps.map(([label, done], i) => (
          <li key={label} className={cx("flex-1 rounded-xl border-2 p-2 text-sm font-bold", done ? "border-[#0E7A4B]" : "border-line")}>
            <span className="block font-sign text-lg text-ink-soft">{done ? <Check aria-label="Done" className="h-5 w-5 text-[#0E7A4B]" strokeWidth={3} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {c.pvc === "seized" && <p className="mb-2 font-bold text-danger">Your PVC was seized. You cannot vote this election.</p>}
      <ul className="mb-3 divide-y divide-line text-sm">
        <li className="py-1.5">
          <b>Registration</b> closes {longDate(CAL.registrationClose)}, at the VINEC office in {LGA[c.lgaCode].name}
        </li>
        <li className="py-1.5">
          <b>PVC collection</b> {longDate(CAL.pvcAnnouncement)} to {longDate(CAL.pvcCollectionClose)}
        </li>
        <li className="py-1.5">
          <b>Campaigns end</b> 24 hours before polls open
        </li>
        <li className="py-1.5">
          <b>Election day</b> {longDate(CAL.pollsOpen)} to 4pm, at your polling unit
        </li>
      </ul>
      {phase === "polls-open" && <TurnoutCounter />}
      <p className="text-xs text-ink-soft">
        Informed {informed}, civic {civic}. Polling unit {c.puCode.split("/").pop()}, {LGA[c.lgaCode].name}.
      </p>
      {seasonClosed(CAL, now) && (
        <Button className="mt-3 w-full" onClick={onResults}>
          Watch the results
        </Button>
      )}
    </Sheet>
  );
}

/** Live turnout while polls are open: the simulated electorate filling up through the day, plus real players. */
function TurnoutCounter() {
  const now = useNow(1000);
  const real = useTurnout();
  const open = Date.parse(CAL.pollsOpen);
  const close = Date.parse(CAL.pollsClose);
  const total = useMemo(() => Object.values(simulateVoters(ELECTION_SEED)).reduce((a, t) => a + t.reduce((x, y) => x + y, 0), 0), []);
  const share = (now - open) / (close - open);
  return (
    <div className="mb-3 rounded-2xl bg-indigo p-3 text-center text-[#F7E7C1]">
      <div className="text-xs font-bold tracking-wide uppercase opacity-80">Votes cast so far</div>
      <Ticker value={Math.floor(total * turnoutCurve(share)) + (real ?? 0)} className="font-sign text-4xl" />
      <a href="/results" target="_blank" rel="noopener" className="mt-1 block text-xs font-bold underline underline-offset-4 opacity-90">
        Watch the live results
      </a>
    </div>
  );
}

/** BVAS accreditation, then the ballot, then the drop into the box. */
export function BallotFlow({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<"bvas" | "ballot" | "drop">("bvas");
  const [tries, setTries] = useState(0);
  const [scan, setScan] = useState<"idle" | "scanning" | "failed" | "ok">("idle");
  const [msg, setMsg] = useState("Tap to scan your fingerprint");
  const [choice, setChoice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // The ballot goes into the box first, then the vote is sent. Once it counts, the store closes this flow and
  // VotedCelebration shows the inked thumb. If it is refused, back to the ballot with the reason.
  useEffect(() => {
    if (stage !== "drop" || !choice) return;
    let live = true;
    const id = setTimeout(async () => {
      const e = await submitVote(choice);
      if (!live || !e) return;
      setErr(e);
      setStage("ballot");
    }, 1500);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [stage, choice]);

  if (stage === "bvas") {
    const tap = () => {
      if (scan === "scanning" || scan === "ok") return;
      setScan("scanning");
      setMsg("Scanning...");
      setTimeout(() => {
        const n = tries + 1;
        setTries(n);
        if (bvasScan(n, Math.random) === "face-capture") {
          setScan("failed");
          return setMsg("Fingerprint not matched. Facial capture: tap again and look at the camera.");
        }
        setScan("ok");
        setMsg("Accredited.");
        setTimeout(() => setStage("ballot"), 900);
      }, 1100);
    };
    return (
      <Modal title="BVAS accreditation">
        <p className="mb-3">The presiding officer asks for your PVC and your thumb.</p>
        <motion.button
          type="button"
          aria-label={tries ? "Scan again" : "Scan fingerprint"}
          onClick={tap}
          animate={scan === "failed" ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.45 }}
          className={cx(
            "relative mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl text-[#F7E7C1] transition-colors",
            scan === "ok" ? "bg-[#0E7A4B]" : scan === "failed" ? "bg-danger" : "bg-indigo",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {scan === "ok" ? (
              <motion.span key="ok" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
                <Check aria-hidden className="h-16 w-16" strokeWidth={3} />
              </motion.span>
            ) : (
              <motion.span key="print" exit={{ scale: 0.6, opacity: 0 }}>
                <Fingerprint aria-hidden className="h-16 w-16" strokeWidth={1.5} />
              </motion.span>
            )}
          </AnimatePresence>
          {scan === "scanning" && (
            <motion.span
              aria-hidden
              className="absolute inset-x-2 h-1 rounded-full bg-[#7FD3A8] shadow-[0_0_12px_#7FD3A8]"
              initial={{ top: "10%" }}
              animate={{ top: ["10%", "88%", "10%"] }}
              transition={{ duration: 1.1, ease: "easeInOut" }}
            />
          )}
        </motion.button>
        <p className="mt-3 text-center font-semibold" aria-live="polite">
          {msg}
        </p>
        <Button tone="ghost" className="mt-3 w-full" onClick={onClose}>
          Leave the queue
        </Button>
      </Modal>
    );
  }
  if (stage === "drop") {
    return (
      <Modal title="Into the box">
        <BallotDrop />
        <p className="mt-3 text-center font-semibold">You fold your ballot and drop it in the box.</p>
      </Modal>
    );
  }
  return (
    <Modal title="Presidential ballot" wide>
      <p className="mb-3 text-sm text-ink-soft">Alphabetical, equal boxes, no logos. Choose one.</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {ballot().map((p, i) => (
          <motion.button
            key={p.code}
            type="button"
            onClick={() => setChoice(p.code)}
            aria-pressed={choice === p.code}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.025 }}
            whileTap={{ scale: 0.96 }}
            className={cx("relative flex h-24 flex-col items-center justify-center rounded-xl border-2 bg-white p-1 text-center text-[#1F2A4D]", choice === p.code ? "border-[#0E7A4B]" : "border-line")}
          >
            <b className="text-lg">{p.code}</b>
            <small className="text-[10px] leading-tight">{p.name}</small>
            <AnimatePresence>
              {choice === p.code && (
                <motion.span
                  className="absolute right-2 bottom-2 h-5 w-7 rounded-full bg-[#5B2C83]/80"
                  aria-label="Thumbprint"
                  initial={{ scale: 2.4, opacity: 0, rotate: -25 }}
                  animate={{ scale: 1, opacity: 1, rotate: -8 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 18 }}
                />
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>
      {err && <p className="mt-2 text-sm font-bold text-danger">{err}</p>}
      <div className="mt-3 flex flex-col gap-2">
        <Button
          disabled={!choice}
          onClick={() => {
            setErr(null);
            setStage("drop");
          }}
        >
          Thumbprint and drop in the box
        </Button>
        <Button tone="ghost" onClick={onClose}>
          Back
        </Button>
      </div>
    </Modal>
  );
}

/** 4pm: the game freezes, the count plays out unit by unit, then the winner and the closing scenes. */
export function Results({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const myBallot = useGame((s) => s.myBallot);
  const game = useGame((s) => s.game);
  const [stage, setStage] = useState<"closed" | "count">("closed");
  const [uploaded, setUploaded] = useState(0);
  const order = useMemo(() => uploadOrder(ELECTION_SEED), []);
  const sheets = useMemo(() => {
    const real: Record<string, Tally> = {};
    if (myBallot) {
      const t = emptyTally();
      t[PARTY_INDEX[myBallot.party]]++;
      real[myBallot.puCode] = t;
    }
    const bribes = game.citizen && Object.keys(game.bribeEffects).length ? { [game.citizen.lgaCode]: game.bribeEffects } : {};
    return puSheets({ simulated: simulateVoters(ELECTION_SEED), real, bribes });
  }, [myBallot, game.citizen, game.bribeEffects]);
  useEffect(() => {
    if (stage === "closed") {
      const id = setTimeout(() => setStage("count"), 3200);
      return () => clearTimeout(id);
    }
    if (uploaded >= order.length) return;
    const id = setTimeout(() => setUploaded((u) => Math.min(order.length, u + 9)), 400);
    return () => clearTimeout(id);
  }, [stage, uploaded, order.length]);
  const snap = collate(sheets, new Set(order.slice(0, uploaded)), uploaded, "");
  const hot = useMemo(() => {
    const h: Record<string, string> = {};
    for (const code of order.slice(Math.max(0, uploaded - 9), uploaded)) h[code.slice(0, code.indexOf("/"))] = `${uploaded}`;
    return h;
  }, [order, uploaded]);
  if (uploaded >= order.length) return (
      <Finale
        winner={leader(snap.nation)}
        votes={snap.nation[leader(snap.nation)]}
        onClose={onClose}
        onViewResults={seasonState(clockNow()) === "results" ? () => router.push("/results") : undefined}
      />
    );
  return (
    <MotionConfig reducedMotion="user">
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0F1730] p-4 text-[#F1E8D4] sm:p-6" role="dialog" aria-modal="true" aria-label="Live collation">
        <AnimatePresence mode="wait">
          {stage === "closed" ? (
            <motion.div
              key="closed"
              className="flex min-h-full flex-col items-center justify-center text-center"
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={() => setStage("count")}
            >
              <motion.div
                className="font-sign text-7xl tabular-nums"
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 16 }}
              >
                4:00pm
              </motion.div>
              <motion.p className="mt-3 font-sign text-3xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                Polls are closed
              </motion.p>
              <motion.p className="mt-2 text-white/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
                Pens down across Naija. The game is frozen. The count starts now.
              </motion.p>
            </motion.div>
          ) : (
            <motion.div key="count" className="mx-auto max-w-5xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="font-sign text-3xl">Live collation</h2>
              <p className="mb-3 text-xs text-white/60">Simulated voters vote at random with equal odds for every party. {DISCLAIMER}</p>
              <div className="mb-4">
                <div className="flex items-center justify-between gap-2 text-sm font-bold">
                  <span>
                    {uploaded} of {POLLING_UNITS.length} polling units uploaded
                  </span>
                  <button type="button" className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/20" onClick={() => setUploaded(order.length)}>
                    Skip to the result
                  </button>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div className="h-full rounded-full bg-[#F2B705]" animate={{ width: `${(uploaded / order.length) * 100}%` }} />
                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" style={{ fontSize: "clamp(13px, 0.35vw + 0.45vh, 22px)" }}>
                <RankedList tally={snap.nation} />
                <StateMap states={snap.states} hot={hot} onPick={() => {}} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
