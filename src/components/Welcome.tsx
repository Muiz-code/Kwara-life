"use client";
// The first screen: what Naija is, what it is not, and the player's agreement before they play.
// The agreement is remembered on this device; changing CONSENT_VERSION asks everyone again.
import { useState } from "react";
import { ShieldCheck } from "lucide-react";

export const CONSENT_KEY = "naija-consent";
/** Bump when the terms below change. */
export const CONSENT_VERSION = "2026-10-08";

export function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === CONSENT_VERSION;
  } catch {
    return false;
  }
}

const POINTS = [
  "Naija Votes is a game. It is not affiliated with INEC, any government agency, party or candidate.",
  "Results in the game are made by players and simulated voters. They are not a poll, survey or prediction of any real election.",
  "VINEC, the parties' campaigns, the banks, companies and people you meet are part of the game. Any resemblance to real people is not intended.",
  "One season runs for about a month: launch on Wednesday 14 October 2026, election day on Saturday 14 November 2026. When polls close the game ends for everyone. Dates may still move.",
  "Your vote in the game is secret. The game records only that you voted, never who you voted for.",
  "Buying or selling votes is a crime in real life. In the game it is risky and can get you arrested.",
  "Please vote in real elections. Collect your real PVC from INEC.",
];

export default function Welcome({ onAgree }: { onAgree: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#2B3A6B,#141B33_70%)] p-4 text-[#F7E7C1]">
      <div className="pointer-events-none absolute h-[160vmax] w-[160vmax] animate-[spin_60s_linear_infinite] bg-[repeating-conic-gradient(rgba(17,138,79,0.16)_0deg_10deg,transparent_10deg_20deg)] motion-reduce:animate-none" />
      <div className="relative w-full max-w-lg rounded-3xl bg-[#141B33]/85 p-6 shadow-2xl backdrop-blur">
        <div className="mb-4 text-center animate-[loaderZoom_1.4s_cubic-bezier(.2,.9,.3,1.2)_both] motion-reduce:animate-none">
          <div className="font-sign text-6xl leading-none drop-shadow-[0_4px_0_#0A0E1E]">Naija Votes</div>
          <div className="mt-1 text-sm font-semibold opacity-80">Live a Nigerian life. Get your PVC. Vote once.</div>
        </div>
        <h1 className="mb-2 flex items-center gap-2 font-bold">
          <ShieldCheck aria-hidden className="h-5 w-5 text-[#F2B705]" />
          Before you play
        </h1>
        <ul className="mb-4 max-h-[42dvh] space-y-2 overflow-y-auto text-sm leading-snug">
          {POINTS.map((p) => (
            <li key={p} className="flex gap-2">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F2B705]" />
              {p}
            </li>
          ))}
        </ul>
        <label className="mb-4 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-1 h-4 w-4" />
          I understand this is a game, not affiliated with INEC, and not a poll or prediction, and I agree to play by these terms.
        </label>
        <button
          type="button"
          disabled={!ok}
          onClick={() => {
            try {
              localStorage.setItem(CONSENT_KEY, CONSENT_VERSION);
            } catch {
              // Private mode: they will be asked again next time.
            }
            onAgree();
          }}
          className="w-full rounded-2xl bg-[#F2B705] py-3 font-bold text-[#141B33] transition disabled:opacity-40"
        >
          I agree, let&apos;s play
        </button>
      </div>
    </div>
  );
}
