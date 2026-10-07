"use client";

import dynamic from "next/dynamic";

/** The game runs only in the browser: it reads the real clock, local saves and WebGL. */
const Game = dynamic(() => import("./Game"), {
  ssr: false,
  loading: () => <div className="flex h-dvh items-center justify-center bg-[#D3B67F] font-sign text-2xl text-indigo">Loading Naija Votes…</div>,
});

export default function ClientGame() {
  return <Game />;
}
