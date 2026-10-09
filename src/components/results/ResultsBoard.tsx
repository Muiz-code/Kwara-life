"use client";
// The public results board (docs/DECISIONS.md, "Public results board"). No sign-in, made for a big screen in a
// viewing centre as well as a phone. Party standings update live from 8am; at 4pm the final result shows.
// It only reads. Nothing on this page can change a result, and the demo exists only in dev builds.
import { Maximize, Repeat } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { PRESIDENTIAL_2027 as CAL } from "@/data/calendar";
import { LGA, LGAS } from "@/data/geography";
import { PARTIES } from "@/data/parties";
import { STATE, STATES } from "@/data/states";
import { ZONES, ZONE_CODES, type ZoneCode } from "@/data/zones";
import { CLOSING_MESSAGE, NEXT_REAL_ELECTION, SIGNED } from "@/data/credits";
import { seasonState } from "@/data/season";
import { useLiveResults } from "@/net/live-results";
import { emptyTally, leader, type Tally } from "@/sim/results";
import { Finale } from "../election/Finale";
import dynamic from "next/dynamic";
import { DISCLAIMER } from "../game/ui";
import { Feed } from "./Feed";
import { RankedList } from "./RankedList";
import { StateMap } from "./StateMap";
import { Ticker } from "./Ticker";
import { countdown, watTime } from "./time";

type Scope = { level: "nation" } | { level: "zone"; zone: ZoneCode } | { level: "state"; state: string } | { level: "lga"; lga: string };

// The ballot screens for the demo live in the game; they load only when someone votes in the demo.
const BallotFlow = dynamic(() => import("../game/Vote").then((m) => m.BallotFlow), { ssr: false });
const VotedMoment = dynamic(() => import("../election/BallotDrop").then((m) => m.VotedMoment), { ssr: false });
const DEMO_STATE = "kwara";
const DEMO_LGA = "kwara/ilorin-west";

const NATION: Scope = { level: "nation" };
const CYCLE_MS = 12_000;
/** Big-screen cycle: the nation, then every state in turn. */
const CYCLE: Scope[] = [NATION, ...[...STATES].sort((a, b) => a.name.localeCompare(b.name)).map((s): Scope => ({ level: "state", state: s.code }))];

const scopeKey = (s: Scope) => (s.level === "nation" ? "nation" : s.level === "zone" ? `zone:${s.zone}` : s.level === "state" ? `state:${s.state}` : `lga:${s.lga}`);

function scopeName(s: Scope) {
  if (s.level === "nation") return "Nigeria";
  if (s.level === "zone") return ZONES[s.zone];
  if (s.level === "state") return STATE[s.state].name;
  return LGA[s.lga].name;
}

/** The path from Nigeria down to this scope, for the breadcrumbs. */
function trail(s: Scope): Scope[] {
  if (s.level === "nation") return [NATION];
  if (s.level === "zone") return [NATION, s];
  const state = s.level === "state" ? s.state : LGA[s.lga].stateCode;
  const up: Scope[] = [NATION, { level: "zone", zone: STATE[state].zone }, { level: "state", state }];
  return s.level === "lga" ? [...up, s] : up;
}

/** The next level down, for the chips under the breadcrumbs. */
function children(s: Scope): Scope[] {
  if (s.level === "nation") return ZONE_CODES.map((zone) => ({ level: "zone", zone }));
  if (s.level === "zone") return STATES.filter((x) => x.zone === s.zone).map((x) => ({ level: "state", state: x.code }));
  const state = s.level === "state" ? s.state : LGA[s.lga].stateCode;
  return LGAS.filter((l) => l.stateCode === state).map((l) => ({ level: "lga", lga: l.code }));
}

function feedFilter(s: Scope): ((pu: string) => boolean) | undefined {
  if (s.level === "nation") return undefined;
  if (s.level === "zone") return (pu) => STATE[pu.slice(0, pu.indexOf("/"))]?.zone === s.zone;
  const prefix = (s.level === "state" ? s.state : s.lga) + "/";
  return (pu) => pu.startsWith(prefix);
}

function tallyFor(s: Scope, states: Record<string, Tally>, lgas: Record<string, Tally>, nation: Tally): Tally {
  if (s.level === "nation") return nation;
  if (s.level === "state") return states[s.state];
  if (s.level === "lga") return lgas[s.lga];
  const t = emptyTally();
  for (const st of STATES) if (st.zone === s.zone) states[st.code].forEach((v, i) => (t[i] += v));
  return t;
}

export function ResultsBoard() {
  const [scope, setScope] = useState<Scope>(NATION);
  const [cycling, setCycling] = useState(false);
  const key = scopeKey(scope);
  const filter = useMemo(() => feedFilter(scope), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const { now, phase, snap: live, lastMinute, timeAt, demo, jump } = useLiveResults(filter, key);
  // Demo only: vote yourself (BVAS, ballot, the drop into the box) and watch your vote land on the board.
  // It counts at a demo polling unit in Ilorin West, Kwara.
  const [voting, setVoting] = useState(false);
  const [mine, setMine] = useState<number | null>(null);
  const [thumb, setThumb] = useState(false);
  const snap = useMemo(() => {
    if (mine === null) return live;
    const plus = (t: Tally) => t.map((v, i) => (i === mine ? v + 1 : v));
    return {
      ...live,
      votesCast: live.votesCast + 1,
      nation: plus(live.nation),
      states: { ...live.states, [DEMO_STATE]: plus(live.states[DEMO_STATE]) },
      lgas: { ...live.lgas, [DEMO_LGA]: plus(live.lgas[DEMO_LGA]) },
    };
  }, [live, mine]);
  // When the result goes final the finale plays by itself (celebration with the winner and their votes, closing,
  // credits, lights out); "View results again" in the credits comes back here. Results stay up for three days.
  const [finale, setFinale] = useState(false);
  const [seenPhase, setSeenPhase] = useState(phase);
  if (seenPhase !== phase) {
    setSeenPhase(phase);
    if (phase === "final") setFinale(true);
  }
  const [demoEnded, setDemoEnded] = useState(false);
  const season = demo ? (demoEnded ? "ended" : phase === "final" ? "results" : "playing") : now === null ? "playing" : seasonState(now);
  const goto = (p: number) => {
    setDemoEnded(false);
    jump(p);
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("cycle")) setCycling(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);
  useEffect(() => {
    if (!cycling) return;
    const id = setInterval(() => setScope((s) => CYCLE[(CYCLE.findIndex((c) => scopeKey(c) === scopeKey(s)) + 1) % CYCLE.length]), CYCLE_MS);
    return () => clearInterval(id);
  }, [cycling]);

  const pick = (s: Scope) => {
    setCycling(false);
    setScope(s);
  };
  const tally = tallyFor(scope, snap.states, snap.lgas, snap.nation);
  const scopeVotes = tally.reduce((a, b) => a + b, 0);
  const hot = useMemo(() => {
    const h: Record<string, string> = {};
    for (const f of snap.feed) h[f.stateCode] ??= `${f.puCode}@${f.at}`;
    return h;
  }, [snap.feed]);
  const winner = phase === "final" ? leader(snap.nation) : -1;
  const openState = scope.level === "state" ? scope.state : scope.level === "lga" ? LGA[scope.lga].stateCode : undefined;

  if (season === "ended") return <SeasonEnded demo={demo} onBack={() => setDemoEnded(false)} />;

  return (
    <MotionConfig reducedMotion="user">
      <main
        className="flex min-h-dvh flex-col bg-[#0F1730] px-4 py-[1em] text-[#F1E8D4] sm:px-[1.6em]"
        style={{ fontSize: "clamp(15px, 0.42vw + 0.5vh, 34px)" }}
      >
        <header className="flex flex-wrap items-center justify-between gap-[0.8em]">
          <div>
            <h1 className="font-sign text-[2em] leading-none tracking-wide">
              Naija Votes <span className="text-[#F2B705]">live results</span>
            </h1>
            <p className="mt-[0.3em] flex items-center gap-[0.5em] text-[0.9em] text-white/70">
              <PhaseDot phase={phase} />
              {phase === "before" && "Polls open 8am WAT, Saturday 14 November"}
              {phase === "live" && now !== null && `Polls open. Live at ${watTime(now)} WAT`}
              {phase === "final" && "Polls closed at 4pm. Final result"}
              {demo && <span className="rounded-full bg-[#B5532E] px-[0.6em] text-[0.8em] font-bold text-white">DEMO: a sped-up simulated day</span>}
            </p>
            {demo && (
              <p className="mt-[0.4em] flex flex-wrap gap-[0.3em] text-[0.8em]">
                <DemoButton onClick={() => goto(0)}>8am</DemoButton>
                <DemoButton onClick={() => goto(0.5)}>12 noon</DemoButton>
                <DemoButton onClick={() => goto(0.98)}>3:50pm</DemoButton>
                <DemoButton onClick={() => goto(1)}>Final result</DemoButton>
                <DemoButton
                  onClick={() => {
                    goto(1);
                    setFinale(true);
                  }}
                >
                  Play the finale
                </DemoButton>
                <DemoButton onClick={() => setDemoEnded(true)}>3 days later</DemoButton>
                {phase === "live" && mine === null && <DemoButton onClick={() => setVoting(true)}>Vote now</DemoButton>}
                {mine !== null && <span className="rounded-full bg-[#5B2C83] px-[0.7em] py-[0.15em] font-semibold">You voted. Your vote is in the count</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-[1.2em]">
            <Stat label="Votes cast" value={snap.votesCast} />
            {phase === "live" && <Stat label="In the last minute" value={lastMinute} />}
            <div className="flex gap-[0.3em]">
              <IconButton label={cycling ? "Stop cycling states" : "Cycle through states"} on={cycling} onClick={() => setCycling((c) => !c)}>
                <Repeat className="h-[1.1em] w-[1.1em]" />
              </IconButton>
              <IconButton label="Full screen" onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}>
                <Maximize className="h-[1.1em] w-[1.1em]" />
              </IconButton>
            </div>
          </div>
        </header>

        <DayBar progress={snap.progress} phase={phase} />

        {phase === "before" && now !== null && (
          <div className="my-[0.8em] rounded-[1em] bg-white/[0.06] p-[1em] text-center">
            <div className="text-[0.85em] font-bold tracking-wider text-white/60 uppercase">Polls open in</div>
            <div className="font-sign text-[3em] leading-none tabular-nums">{countdown(Date.parse(CAL.pollsOpen) - now)}</div>
            <div className="mt-[0.3em] text-[0.85em] text-white/60">Every vote shows here the moment it is counted.</div>
          </div>
        )}

        <AnimatePresence>
          {winner >= 0 && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="my-[0.6em] flex flex-wrap items-center justify-center gap-x-[0.8em] rounded-[1em] p-[0.8em] text-center text-white"
              style={{ background: `linear-gradient(90deg, ${PARTIES[winner].colour}, #0F1730)` }}
            >
              <span className="text-[0.9em] font-bold tracking-widest uppercase opacity-80">Naija has a winner</span>
              <span className="font-sign text-[2.2em] leading-none">{PARTIES[winner].code}</span>
              <span className="text-[1.1em] font-bold">{PARTIES[winner].name}</span>
              <span className="font-sign text-[1.6em] leading-none tabular-nums">
                {snap.nation[winner].toLocaleString("en-NG")} <span className="text-[0.6em] opacity-80">votes</span>
              </span>
              <button
                type="button"
                onClick={() => setFinale(true)}
                className="rounded-full bg-[#F2B705] px-[1em] py-[0.3em] font-bold text-[#0F1730] hover:brightness-110"
              >
                Watch the celebration again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <nav className="mt-[0.6em] flex flex-col gap-[0.4em]" aria-label="Results area">
          <ol className="flex flex-wrap items-center gap-[0.3em] text-[0.95em]">
            {trail(scope).map((s, i, all) => (
              <li key={scopeKey(s)} className="flex items-center gap-[0.3em]">
                {i > 0 && <span className="text-white/40">›</span>}
                {i === all.length - 1 ? (
                  <b className="text-[#F2B705]">{scopeName(s)}</b>
                ) : (
                  <button type="button" className="underline-offset-4 hover:underline" onClick={() => pick(s)}>
                    {scopeName(s)}
                  </button>
                )}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-[0.3em]">
            {children(scope).map((c) => (
              <button
                key={scopeKey(c)}
                type="button"
                onClick={() => pick(c)}
                className={`rounded-full px-[0.7em] py-[0.2em] text-[0.8em] font-semibold ${scopeKey(c) === key ? "bg-[#F2B705] text-[#0F1730]" : "bg-white/[0.08] hover:bg-white/[0.15]"}`}
              >
                {scopeName(c)}
              </button>
            ))}
          </div>
        </nav>

        <div className="mt-[0.8em] grid flex-1 gap-[1.2em] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section aria-label={`Standings in ${scopeName(scope)}`}>
            <AnimatePresence mode="wait">
              <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <h2 className="mb-[0.5em] flex items-baseline justify-between gap-[0.5em]">
                  <span className="font-sign text-[1.4em]">{scopeName(scope)}</span>
                  <span className="text-[0.85em] text-white/60">
                    <Ticker value={scopeVotes} /> votes
                  </span>
                </h2>
                <RankedList tally={tally} />
              </motion.div>
            </AnimatePresence>
          </section>
          <section className="flex flex-col gap-[1em]" aria-label="Map and reporting">
            <div className="mx-auto w-full max-w-[34em]">
              <StateMap
                states={snap.states}
                hot={hot}
                selected={openState}
                zone={scope.level === "zone" ? scope.zone : openState ? STATE[openState].zone : undefined}
                onPick={(state) => pick({ level: "state", state })}
              />
            </div>
            <div>
              <h2 className="mb-[0.4em] text-[0.8em] font-bold tracking-wider text-white/60 uppercase">Just reported</h2>
              <Feed items={snap.feed} timeAt={timeAt} />
            </div>
          </section>
        </div>

        {voting && (
          <BallotFlow
            onClose={() => setVoting(false)}
            cast={async (party) => {
              setMine(PARTIES.findIndex((p) => p.code === party));
              setThumb(true);
              return null;
            }}
          />
        )}
        <VotedMoment show={thumb} onHide={() => setThumb(false)} />
        {finale && winner >= 0 && (
          <Finale
            winner={winner}
            votes={snap.nation[winner]}
            onClose={() => setFinale(false)}
            onViewResults={season === "results" ? () => setFinale(false) : undefined}
          />
        )}

        <footer className="mt-[1em] border-t border-white/10 pt-[0.6em] text-center text-[0.8em] text-white/60">
          {DISCLAIMER} Simulated voters vote at random with equal odds for every party. Results are final and cannot be
          changed by anyone.
        </footer>
      </main>
    </MotionConfig>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <div className="text-[0.75em] font-bold tracking-wider text-white/60 uppercase">{label}</div>
      <Ticker value={value} className="font-sign text-[1.6em] leading-none" />
    </div>
  );
}

function PhaseDot({ phase }: { phase: "before" | "live" | "final" }) {
  if (phase !== "live") return <span className={`inline-block h-[0.6em] w-[0.6em] rounded-full ${phase === "final" ? "bg-[#7FD3A8]" : "bg-white/40"}`} />;
  return (
    <span className="relative inline-flex h-[0.6em] w-[0.6em]">
      <motion.span
        className="absolute inset-0 rounded-full bg-[#E5484D]"
        animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      />
      <span className="relative h-full w-full rounded-full bg-[#E5484D]" />
    </span>
  );
}

function DayBar({ progress, phase }: { progress: number; phase: "before" | "live" | "final" }) {
  const p = phase === "before" ? 0 : Math.min(1, progress);
  return (
    <div className="mt-[0.8em]" aria-hidden>
      <div className="h-[0.4em] overflow-hidden rounded-full bg-white/10">
        <motion.div className="h-full rounded-full bg-[#F2B705]" initial={false} animate={{ width: `${p * 100}%` }} transition={{ duration: 0.9 }} />
      </div>
      <div className="mt-[0.2em] flex justify-between text-[0.7em] text-white/50">
        <span>8am</span>
        <span>12 noon</span>
        <span>4pm</span>
      </div>
    </div>
  );
}

/** Three days after polls close the results come down; only thanks and the closing message remain. */
function SeasonEnded({ demo, onBack }: { demo: boolean; onBack: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0B1022] px-6 py-12 text-center text-[#F1E8D4]">
      <h1 className="font-sign text-4xl">Naija Votes has ended</h1>
      <p className="mt-3 max-w-md text-white/75">
        The first season is over and the results are no longer up. Thank you to everyone who played. See you at the real polls in{" "}
        {NEXT_REAL_ELECTION}.
      </p>
      <div className="mt-8 max-w-xl space-y-3 rounded-3xl bg-white/5 p-6 text-left">
        {CLOSING_MESSAGE.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p className="font-sign text-2xl text-[#F2B705]">Signed, {SIGNED}</p>
      </div>
      <p className="mt-6 text-sm text-white/60">{DISCLAIMER}</p>
      {demo && (
        <button type="button" onClick={onBack} className="mt-6 rounded-full bg-[#B5532E] px-4 py-1 text-sm font-bold text-white">
          DEMO: back to the results
        </button>
      )}
    </main>
  );
}

function DemoButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full bg-white/[0.08] px-[0.7em] py-[0.15em] font-semibold hover:bg-white/[0.18]">
      {children}
    </button>
  );
}

function IconButton({ label, on, onClick, children }: { label: string; on?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={on}
      onClick={onClick}
      className={`flex h-[2.2em] w-[2.2em] items-center justify-center rounded-full ${on ? "bg-[#F2B705] text-[#0F1730]" : "bg-white/[0.08] hover:bg-white/[0.15]"}`}
    >
      {children}
    </button>
  );
}
