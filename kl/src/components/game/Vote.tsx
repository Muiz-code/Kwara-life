"use client";
// The Vote tab, the BVAS and ballot flow, live collation, and the season finale.
import { useEffect, useMemo, useState } from "react";
import { PRESIDENTIAL_2027 as CAL, civicPhase, seasonClosed } from "@/data/calendar";
import { LGA, POLLING_UNITS } from "@/data/geography";
import { PARTIES } from "@/data/parties";
import { STATES } from "@/data/states";
import { PARTY_INDEX, ballot, bvasScan, collate, emptyTally, leader, puSheets, simulateVoters, uploadOrder, type Tally } from "@/sim";
import { getGameStore, useGame } from "@/store";
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
            <span className="block font-sign text-lg text-ink-soft">{done ? "✓" : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {c.pvc === "seized" && <p className="mb-2 font-bold text-danger">Your PVC was seized. You cannot vote this election.</p>}
      <ul className="mb-3 divide-y divide-line text-sm">
        <li className="py-1.5"><b>Registration</b> closes {longDate(CAL.registrationClose)}, at the INEC office in {LGA[c.lgaCode].name}</li>
        <li className="py-1.5"><b>PVC collection</b> {longDate(CAL.pvcAnnouncement)} to {longDate(CAL.pvcCollectionClose)}</li>
        <li className="py-1.5"><b>Campaigns end</b> 24 hours before polls open</li>
        <li className="py-1.5"><b>Election day</b> {longDate(CAL.pollsOpen)} to 4pm, at your polling unit</li>
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

/** Live turnout while polls are open. Votes cast only, never party standings. */
function TurnoutCounter() {
  const now = useNow(1000);
  const open = Date.parse(CAL.pollsOpen);
  const close = Date.parse(CAL.pollsClose);
  // Until the server counter is connected, show the simulated electorate filling up through the day.
  const total = useMemo(() => Object.values(simulateVoters(ELECTION_SEED)).reduce((a, t) => a + t.reduce((x, y) => x + y, 0), 0), []);
  const share = Math.min(1, Math.max(0, (now - open) / (close - open)));
  return (
    <div className="mb-3 rounded-2xl bg-indigo p-3 text-center text-[#F7E7C1]">
      <div className="text-xs font-bold tracking-wide uppercase opacity-80">Votes cast so far</div>
      <div className="font-sign text-4xl tabular-nums">{Math.round(total * Math.sqrt(share)).toLocaleString("en-NG")}</div>
      <div className="text-xs opacity-80">Results come after polls close at 4pm</div>
    </div>
  );
}

/** BVAS accreditation, then the ballot. */
export function BallotFlow({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<"bvas" | "ballot">("bvas");
  const [tries, setTries] = useState(0);
  const [msg, setMsg] = useState("Tap to scan your fingerprint");
  const [choice, setChoice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (stage === "bvas") {
    return (
      <Modal title="BVAS accreditation">
        <p className="mb-3">The presiding officer asks for your PVC and your thumb.</p>
        <button
          type="button"
          aria-label="Scan fingerprint"
          onClick={() => {
            const n = tries + 1;
            setTries(n);
            if (bvasScan(n, Math.random) === "face-capture") return setMsg("Fingerprint not matched. Facial capture: tap again and look at the camera.");
            setMsg("Accredited.");
            setTimeout(() => setStage("ballot"), 600);
          }}
          className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl bg-indigo text-5xl text-[#F7E7C1]"
        >
          👆
        </button>
        <p className="mt-3 text-center font-semibold">{msg}</p>
        <Button tone="ghost" className="mt-3 w-full" onClick={onClose}>
          Leave the queue
        </Button>
      </Modal>
    );
  }
  return (
    <Modal title="Presidential ballot" wide>
      <p className="mb-3 text-sm text-ink-soft">Alphabetical, equal boxes, no logos. Choose one.</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {ballot().map((p) => (
          <button
            key={p.code}
            type="button"
            onClick={() => setChoice(p.code)}
            aria-pressed={choice === p.code}
            className={cx("flex h-24 flex-col items-center justify-center rounded-xl border-2 bg-white p-1 text-center text-[#1F2A4D]", choice === p.code ? "border-[#0E7A4B]" : "border-line")}
          >
            <b className="text-lg">{p.code}</b>
            <small className="text-[10px] leading-tight">{p.name}</small>
            {choice === p.code && <span className="mt-1 h-4 w-6 rounded-full bg-[#5B2C83]/80" aria-label="Thumbprint" />}
          </button>
        ))}
      </div>
      {err && <p className="mt-2 text-sm font-bold text-danger">{err}</p>}
      <div className="mt-3 flex flex-col gap-2">
        <Button
          disabled={!choice}
          onClick={() => {
            const e = getGameStore().getState().vote(choice!);
            if (e) setErr(e);
            else onClose();
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

const GRID: Record<string, [number, number]> = Object.fromEntries(STATES.map((s) => [s.code, s.grid]));

/** Live collation after polls close, then the finale. */
export function Results({ onClose }: { onClose: () => void }) {
  const myBallot = useGame((s) => s.myBallot);
  const game = useGame((s) => s.game);
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
    if (uploaded >= order.length) return;
    const id = setTimeout(() => setUploaded((u) => Math.min(order.length, u + 9)), 400);
    return () => clearTimeout(id);
  }, [uploaded, order.length]);
  const snap = collate(sheets, new Set(order.slice(0, uploaded)), uploaded, "");
  const all = snap.nation.reduce((a, b) => a + b, 0) || 1;
  const ranked = snap.nation.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
  const done = uploaded >= order.length;
  if (done) return <Finale winner={leader(snap.nation)} onClose={onClose} />;
  return (
    <Modal title="Live collation" wide>
      <p className="mb-2 text-xs font-semibold text-ink-soft">Simulated voters vote at random with equal odds for every party. {DISCLAIMER}</p>
      <p className="mb-3 inline-block rounded-full bg-panel-2 px-3 py-1 text-sm font-bold">
        {uploaded} of {POLLING_UNITS.length} polling units uploaded
      </p>
      <div className="space-y-1.5">
        {ranked.slice(0, 6).map(([v, i]) => (
          <div key={i} className="grid grid-cols-[48px_1fr_110px] items-center gap-2 text-sm">
            <b>{PARTIES[i].code}</b>
            <div className="h-3 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full rounded-full" style={{ width: `${(v / all) * 100}%`, background: PARTIES[i].colour }} />
            </div>
            <span className="text-right tabular-nums">
              {v.toLocaleString()} <small>{((v / all) * 100).toFixed(1)}%</small>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-1" style={{ gridTemplateColumns: "repeat(9, minmax(0, 1fr))" }}>
        {STATES.map((s) => {
          const lead = leader(snap.states[s.code]);
          return (
            <div key={s.code} className="rounded-md p-1 text-center text-[10px] font-bold text-white" style={{ gridColumn: GRID[s.code][0] + 1, gridRow: GRID[s.code][1] + 1, background: lead >= 0 ? PARTIES[lead].colour : "#cfc6ae" }}>
              {s.name.slice(0, 3).toUpperCase()}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/** The end of the season: the winner, a celebration, thanks, and the real-world message. */
function Finale({ winner, onClose }: { winner: number; onClose: () => void }) {
  const p = PARTIES[winner];
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto p-6 text-center text-white" style={{ background: `radial-gradient(circle at 50% 30%, ${p.colour}, #0F1730 70%)` }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {Array.from({ length: 40 }, (_, i) => (
          <span key={i} className="absolute top-[-10px] h-3 w-2 animate-[confetti_4s_linear_infinite] motion-reduce:hidden" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 10) * 0.4}s`, background: ["#F2B705", "#FFFFFF", "#0E7A4B", p.colour][i % 4] }} />
        ))}
      </div>
      <p className="text-sm font-bold tracking-widest uppercase opacity-80">Naija Votes 2027 has a winner</p>
      <h1 className="my-3 font-sign text-6xl">{p.code}</h1>
      <p className="text-2xl font-bold">{p.name}</p>
      <div className="mt-8 max-w-xl space-y-3 rounded-3xl bg-black/30 p-5 text-left">
        <p className="font-bold">Thank you for voting.</p>
        <p>You queued, you thumbprinted, you waited for the count. That is how it works in real life too.</p>
        <p>When the real election comes: collect your PVC, come out on election day, protect your vote, and choose wisely. Nobody should buy your future for one day&apos;s money.</p>
        <p className="text-sm opacity-80">{DISCLAIMER} The result of this game says nothing about any real election.</p>
      </div>
      <Button tone="keke" className="mt-6" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}
