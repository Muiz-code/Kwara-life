"use client";
// A house inspection with the Sync agent: the drive there, a walk through the rooms (what the agent says,
// what you notice: the good and the wahala), and the drive back to the office.
import { AlertTriangle, Car, Check, ChevronRight, FastForward, Home } from "lucide-react";
import { useEffect, useState } from "react";
import { HOUSE } from "@/data/shops";
import { tourOf } from "@/data/sync";
import { getGameStore, useGame } from "@/store";
import { cx, naira, usePerfNow } from "./ui";

/** How long each drive takes on screen. */
const DRIVE_MS = 6000;

export default function Inspection() {
  const house = useGame((s) => s.touring);
  if (!house) return null;
  return <Tour key={house} house={house} />;
}

function Tour({ house }: { house: string }) {
  const h = HOUSE[house];
  const tour = tourOf(house);
  const [stage, setStage] = useState<"there" | "rooms" | "back">("there");
  const [stop, setStop] = useState(0);
  const [t0, setT0] = useState(() => performance.now());
  const [fast, setFast] = useState(false);
  const now = usePerfNow(100);
  const driveMs = fast ? 800 : DRIVE_MS;
  const p = now ? Math.min(1, (now - t0) / driveMs) : 0;
  const driving = stage === "there" || stage === "back";
  // When a drive is over: into the house, or back at the office and done.
  useEffect(() => {
    if (!driving) return;
    const id = setTimeout(() => {
      if (stage === "there") {
        setStage("rooms");
        setFast(false);
      } else getGameStore().getState().finishTour();
    }, Math.max(0, t0 + driveMs - performance.now()));
    return () => clearTimeout(id);
  }, [driving, stage, t0, driveMs]);
  if (!h) return null;
  const s = tour.stops[stop];
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#26355E] to-[#0F1730] p-5 text-[#F7E7C1]" role="dialog" aria-label="House inspection">
      <div className="text-center">
        <div className="text-xs font-bold uppercase tracking-wide opacity-70">Inspection with your Sync agent</div>
        <h2 className="font-sign text-2xl leading-tight">{h.name}</h2>
        <div className="text-sm opacity-80">
          {naira(h.price)}
          {h.rent ? " a year" : ""} · {tour.area}
        </div>
      </div>

      {driving ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-3">
          <Car aria-hidden className="h-14 w-14" strokeWidth={1.75} />
          <p className="text-center text-sm">
            {stage === "there" ? `Your agent is driving you to ${tour.area}…` : "Driving back to the Sync office…"}
          </p>
          <p className="text-center text-sm italic opacity-80">
            {stage === "there" ? "\"The place fine o. You go like am, I promise.\"" : "\"So, wetin you think? If you like am, we fit sign today.\""}
          </p>
          <div className="h-2 w-64 overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-keke" style={{ width: `${p * 100}%` }} />
          </div>
          {!fast && (
            <button type="button" onClick={() => setFast(true)} className="flex items-center gap-1 rounded-xl bg-white/15 px-3 py-1.5 text-sm font-bold">
              <FastForward aria-hidden className="h-4 w-4" /> Skip the drive
            </button>
          )}
        </div>
      ) : (
        <div className="w-full max-w-sm rounded-2xl bg-panel p-4 text-ink shadow-2xl">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-ink-soft">
            <span className="flex items-center gap-1">
              <Home aria-hidden className="h-3.5 w-3.5" /> {s.room}
            </span>
            <span>
              {stop + 1} of {tour.stops.length}
            </span>
          </div>
          <p className="mb-3 text-sm">
            <span className="font-bold">Agent: </span>&ldquo;{s.says}&rdquo;
          </p>
          <p className={cx("mb-4 flex items-start gap-2 rounded-xl p-2 text-sm font-semibold", s.good ? "bg-[#0E7A4B]/10 text-[#0E7A4B]" : "bg-[#E0884F]/15 text-[#9A4A12]")}>
            {s.good ? <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />}
            {s.note}
          </p>
          <button
            type="button"
            onClick={() => {
              if (stop + 1 < tour.stops.length) setStop(stop + 1);
              else {
                setStage("back");
                setT0(performance.now());
              }
            }}
            className="flex w-full items-center justify-center gap-1 rounded-xl bg-indigo px-3 py-2.5 font-bold text-[#F7E7C1]"
          >
            {stop + 1 < tour.stops.length ? "Next room" : "That's everything. Back to Sync"}
            <ChevronRight aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
