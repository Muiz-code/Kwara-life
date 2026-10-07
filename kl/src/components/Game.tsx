"use client";

import { useEffect, useState } from "react";
import MapView from "./MapView";
import type { GameMap } from "@/game/map/GameMap";
import { getGameStore, startGameLoop, useGame } from "@/game/store";
import { PLACE } from "@/game/data/locations";
import { MODES, MODE_IDS, fmtTime, quoteTrip } from "@/game/sim";

export default function Game() {
  const [map, setMap] = useState<GameMap | null>(null);
  const selected = useGame((s) => s.selected);
  const loc = useGame((s) => s.game.loc);
  const t = useGame((s) => s.game.t);
  const money = useGame((s) => s.game.money);
  const busy = useGame((s) => s.activity !== null);

  useEffect(() => startGameLoop(getGameStore()), []);

  // Temporary panel for phase 3; the real UI comes in phase 4.
  const q = selected !== loc ? quoteTrip(loc, selected) : null;
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#D3B67F]">
      <MapView onReady={setMap} onBillboard={(id) => alert(`Billboard ${id}: booking comes later`)} />
      <div className="absolute right-3 bottom-3 flex flex-col gap-1.5">
        {[["+", 1.3], ["−", 1 / 1.3]].map(([l, f]) => (
          <button key={l} className="h-10 w-10 rounded-lg border-2 border-indigo bg-panel text-lg font-extrabold text-indigo" onClick={() => map?.zoomBy(f as number)}>
            {l}
          </button>
        ))}
        <button className="h-10 w-10 rounded-lg border-2 border-indigo bg-panel text-xs font-extrabold text-indigo" onClick={() => map?.centerOnMe()}>
          Me
        </button>
      </div>
      <div className="absolute top-3 left-3 max-w-[90vw] rounded-xl border border-line bg-panel/95 p-3 text-sm text-ink shadow">
        <div className="font-bold">
          {fmtTime(t)} · ₦{money.toLocaleString("en-NG")} · at {PLACE[loc].name}
        </div>
        <div className="mt-1">Selected: {PLACE[selected].name}</div>
        {q && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MODE_IDS.map((m) => (
              <button key={m} disabled={busy} className="rounded-md bg-keke px-2 py-1 font-semibold text-[#2A2000] disabled:opacity-50" onClick={() => getGameStore().getState().travel(selected, m, performance.now())}>
                {MODES[m].label} {q.modes[m].minutes}m
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
