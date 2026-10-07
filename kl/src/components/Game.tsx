"use client";

import { useEffect, useState } from "react";
import MapView from "./MapView";
import type { GameMap } from "@/world/GameMap";
import { loadMap } from "@/world";
import { LGA } from "@/data/geography";
import { STATE } from "@/data/states";
import { currentLga } from "@/sim";
import { getGameStore, startGameLoop, useGame } from "@/store";
import CreateCitizen, { Reveal } from "./game/CreateCitizen";
import { BottomNav, NeedsDock, NewsTicker, Notes, Objectives, Toasts, TopBar, type Tab } from "./game/Hud";
import PlaceSheet, { JourneyOverlay } from "./game/PlaceSheet";
import { BribeModal, CampaignPanel, PromoModal } from "./game/Campaign";
import { BallotFlow, Results, VotePanel } from "./game/Vote";
import { PhonePanel } from "./game/Phone";
import { DISCLAIMER } from "./game/ui";

export default function Game() {
  const [map, setMap] = useState<GameMap | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const [revealed, setRevealed] = useState(true);
  const [results, setResults] = useState(false);
  const citizen = useGame((s) => s.game.citizen);
  const lgaCode = useGame((s) => currentLga(s.game));
  const world = useGame((s) => s.world);
  const flow = useGame((s) => s.flow);
  const selected = useGame((s) => s.selected);

  useEffect(() => startGameLoop(getGameStore()), []);

  // Load the map for the LGA the citizen is in (home, or the town they are visiting).
  useEffect(() => {
    if (!citizen || !lgaCode || world) return;
    let alive = true;
    const lga = LGA[lgaCode];
    loadMap({
      lgaCode,
      state: STATE[lga.stateCode],
      lgaName: lga.name,
      pu: Number(citizen.puCode.split("/").pop()) - 1,
      cls: citizen.cls,
      job: citizen.job,
      home: citizen.home,
      under: citizen.underFlyover,
      wasUnder: citizen.wasUnder,
    }).then((m) => alive && getGameStore().getState().setWorld(m));
    return () => {
      alive = false;
    };
  }, [citizen, lgaCode, world]);

  // Tapping a place opens the Life sheet; a new citizen gets the "Your life" card.
  useEffect(
    () =>
      getGameStore().subscribe((s, prev) => {
        if (s.selected !== prev.selected) setTab("life");
        if (s.game.citizen && !prev.game.citizen) {
          setRevealed(false);
          setTab(null);
        }
      }),
    [],
  );

  const close = () => setTab(null);
  const closeFlow = () => getGameStore().getState().closeFlow();

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#D3B67F]">
      {(world || !citizen) && <MapView key={world?.id ?? "ilorin"} world={world} onReady={setMap} onBillboard={() => getGameStore().getState().shiftToast()} />}
      {citizen && !world && <div className="absolute inset-0 flex items-center justify-center font-sign text-2xl text-indigo">Loading your town…</div>}

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="flex flex-col gap-2 p-3">
          <TopBar />
          <NewsTicker />
        </div>
        <div className="px-3">
          <Objectives />
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 p-3">
          <NeedsDock />
          <div className="pointer-events-auto flex flex-col gap-1.5">
            {[
              ["+", 1.3],
              ["−", 1 / 1.3],
            ].map(([l, f]) => (
              <button key={l} type="button" aria-label={l === "+" ? "Zoom in" : "Zoom out"} className="h-10 w-10 rounded-xl border-2 border-indigo bg-panel text-lg font-extrabold text-indigo" onClick={() => map?.zoomBy(f as number)}>
                {l}
              </button>
            ))}
            <button type="button" className="h-10 w-10 rounded-xl border-2 border-indigo bg-panel text-xs font-extrabold text-indigo" onClick={() => map?.centerOnMe()}>
              Me
            </button>
          </div>
        </div>
        <div className="h-24" />
      </div>
      {/* Tabs stay above any open sheet. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-1 pb-1">
        <BottomNav tab={tab} onTab={setTab} />
        <p className="text-center text-[10px] font-semibold text-indigo/70">{DISCLAIMER}</p>
      </div>

      {tab === "life" && selected && <PlaceSheet onClose={close} />}
      {tab === "campaign" && <CampaignPanel onClose={close} />}
      {tab === "vote" && <VotePanel onClose={close} onResults={() => setResults(true)} />}
      {tab === "phone" && <PhonePanel onClose={close} />}

      {flow === "vote" && <BallotFlow onClose={closeFlow} />}
      {flow === "bribe" && <BribeModal onClose={closeFlow} />}
      {flow === "flyer" && <PromoModal kind="flyer" onClose={closeFlow} />}

      {!citizen && <CreateCitizen />}
      {citizen && !revealed && <Reveal onStart={() => setRevealed(true)} />}
      {citizen && revealed && <Notes />}
      <JourneyOverlay />
      {results && <Results onClose={() => setResults(false)} />}
      <Toasts />
    </div>
  );
}
