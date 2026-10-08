"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Loader from "./game/Loader";
import Welcome, { hasConsent } from "./Welcome";
import AuthGate from "./AuthGate";

/** The game runs only in the browser: it reads the real clock, local saves and WebGL. */
const Game = dynamic(() => import("./Game"), {
  ssr: false,
  loading: () => <Loader done={false} label="Loading Naija Votes…" />,
});

export default function ClientGame() {
  // null until the browser has checked for an earlier agreement.
  const [agreed, setAgreed] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage once, after mount
    setAgreed(hasConsent());
  }, []);
  if (agreed === null) return <Loader done={false} label="Loading Naija Votes…" />;
  if (!agreed) return <Welcome onAgree={() => setAgreed(true)} />;
  return (
    <AuthGate>
      <Game />
    </AuthGate>
  );
}
