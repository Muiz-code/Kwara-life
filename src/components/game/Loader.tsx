"use client";
// The loading screen while a town is built: the title zooming in, a ballot box filling, a tip.
// Only transforms and opacity animate, so it keeps moving even while the town is being built.
import { useEffect, useState } from "react";
import { adsStore } from "@/store/ads";

/** Ads running now, shuffled: the loading screen shows them behind the title. */
function liveAds(): { title: string; image: string }[] {
  const now = Date.now();
  const ads = Object.values(adsStore.getState().queue).filter((b) => b.image && (b.until ?? Infinity) > now);
  for (let i = ads.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ads[i], ads[j]] = [ads[j], ads[i]];
  }
  return ads.map((b) => ({ title: b.title, image: b.image }));
}

const TIPS = [
  "Walk with W A S D or the arrows. Hold Shift to run.",
  "Two fingers turn the town round. Pinch to zoom.",
  "Tap the pin button to see every place in town.",
  "Register at VINEC, then collect your PVC before the deadline.",
  "Your vote is secret. Nobody can see who you voted for.",
  "Buying or selling votes is a crime. Report it.",
];

export default function Loader({ done, label = "Building your town…" }: { done: boolean; label?: string }) {
  const [tip, setTip] = useState(0);
  const [gone, setGone] = useState(false);
  // Picked after mounting, not while rendering: the page is prerendered, so the clock can't be read there.
  const [ads, setAds] = useState<{ title: string; image: string }[]>([]);
  useEffect(() => {
    const t = setTimeout(() => setAds(liveAds()), 0);
    return () => clearTimeout(t);
  }, []);
  const [ad, setAd] = useState(0);
  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => setAd((i) => (i + 1) % ads.length), 5000);
    return () => clearInterval(t);
  }, [ads.length]);
  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 2600);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setGone(true), 700);
    return () => clearTimeout(t);
  }, [done]);
  if (gone) return null;
  return (
    <div
      className={`absolute inset-0 z-10 flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_40%,#2B3A6B,#141B33_70%)] text-[#F7E7C1] transition-[opacity,transform] duration-700 ease-out ${done ? "scale-110 opacity-0" : "opacity-100"}`}
      role="status"
      aria-live="polite"
    >
      {/* A business's ad behind it all, dimmed so the title still reads. */}
      {ads[ad] && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={ad} src={ads[ad].image} alt="" className="pointer-events-none absolute inset-0 h-full w-full animate-[fadeIn_.8s_ease-out] object-cover opacity-30 blur-[2px]" />
          <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold">Ad · {ads[ad].title}</span>
        </>
      )}
      {/* Green, white, green rays turning slowly behind the title. */}
      <div className="pointer-events-none absolute h-[160vmax] w-[160vmax] animate-[spin_40s_linear_infinite] bg-[repeating-conic-gradient(rgba(17,138,79,0.18)_0deg_10deg,transparent_10deg_20deg)] motion-reduce:animate-none" />
      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        <div className="animate-[loaderZoom_1.6s_cubic-bezier(.2,.9,.3,1.2)_both] motion-reduce:animate-none">
          <div className="font-sign text-6xl leading-none tracking-wide drop-shadow-[0_4px_0_#0A0E1E] sm:text-7xl">Naija Votes</div>
          <div className="mt-1 text-sm font-semibold text-[#F2B705]">Live it. Get your PVC. Vote once.</div>
        </div>
        {/* A ballot box with papers dropping in. */}
        <div className="relative h-20 w-24">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute left-1/2 top-0 h-6 w-9 -translate-x-1/2 rounded-sm bg-[#F4F1EA] shadow animate-[ballotDrop_1.5s_ease-in_infinite] motion-reduce:hidden"
              style={{ animationDelay: `${i * 0.5}s` }}
            />
          ))}
          <div className="absolute bottom-0 left-0 h-12 w-24 rounded-lg border-4 border-[#F4F1EA] bg-[#118A4F]">
            <div className="mx-auto mt-1 h-1.5 w-12 rounded bg-[#0A0E1E]" />
          </div>
        </div>
        <div className="text-sm font-semibold opacity-80">{label}</div>
        <p key={tip} className="max-w-xs animate-[fadeIn_.5s_ease-out] text-sm text-[#F7E7C1]/90">{TIPS[tip]}</p>
        <p className="mt-4 max-w-xs text-[11px] opacity-60">A game. Not affiliated with INEC. Not a poll or prediction.</p>
      </div>
    </div>
  );
}
