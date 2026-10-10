"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Loader from "./game/Loader";
import Welcome, { hasConsent } from "./Welcome";
import AuthGate from "./AuthGate";
import { ResultsBoard } from "./results/ResultsBoard";
import { seasonState } from "@/data/season";
import { clockNow, syncClock } from "@/store/clock";
import { loadGameSettings } from "@/net/settings";

/** The game runs only in the browser: it reads the real clock, local saves and WebGL. */
const Game = dynamic(() => import("./Game"), {
  ssr: false,
  loading: () => <Loader done={false} label="Loading Naija Votes…" />,
});

export default function ClientGame() {
  // null until the browser has checked for an earlier agreement.
  const [agreed, setAgreed] = useState<boolean | null>(null);
  // Once polls close the game never loads again: only the results (docs/DECISIONS.md, "After the season
  // closes"). Decided on the server's clock, so a phone set to an earlier date changes nothing.
  const [over, setOver] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage once, after mount
    setAgreed(hasConsent());
    // The server's clock and the owner's settings (a postponed election moves the dates) before deciding.
    void Promise.all([syncClock(), loadGameSettings()]).then(() => setOver(seasonState(clockNow()) !== "playing"));
  }, []);
  if (over) return <ResultsBoard />;
  if (agreed === null || over === null) return <Loader done={false} label="Loading Naija Votes…" />;
  if (!agreed) return <Welcome onAgree={() => setAgreed(true)} />;
  return (
    <AuthGate>
      <Game />
    </AuthGate>
  );
}
