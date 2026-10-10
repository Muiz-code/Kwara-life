"use client";
// The owner's emergency pause: while it is on, the whole game is covered and nothing can be done (the server
// refuses every action too). It never opens or closes polls and never touches a vote.
import { usePause } from "@/net/settings";

export function PauseOverlay() {
  const { paused, message } = usePause();
  if (!paused) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0A0E1E]/85 p-6 text-center text-[#F7E7C1]" role="alertdialog" aria-label="Game paused">
      <div className="max-w-sm rounded-3xl bg-[#141B33] p-6 shadow-2xl">
        <p className="font-sign text-3xl">Small pause</p>
        <p className="mt-2">{message || "Naija Votes is paused for a short while. Your game is safe; we'll be back soon."}</p>
        <p className="mt-3 text-xs opacity-70">This screen goes away by itself when we are back.</p>
      </div>
    </div>
  );
}
