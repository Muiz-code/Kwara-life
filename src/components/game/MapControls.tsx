"use client";
// A list of every place in town, to jump straight to its card and travel there.
import { MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { PLACES } from "@/data/ilorin/places";
import { getGameStore, useGame } from "@/store";

/** Every place in town, to jump straight to its card and travel there. */
export function PlacesButton() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const world = useGame((s) => s.world);
  const here = useGame((s) => s.game.loc);
  const places = useMemo(() => (world ? world.places : PLACES).map((p) => ({ id: p.id, name: p.name, area: p.area })), [world]);
  const shown = places.filter((p) => `${p.name} ${p.area}`.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <button type="button" aria-label="All places" className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink/25 bg-panel text-ink shadow-md hover:bg-panel-2" onClick={() => setOpen(true)}>
        <MapPin aria-hidden className="h-5 w-5" />
      </button>
      {open && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center bg-[#0A0E1E]/45 sm:items-center" onClick={() => setOpen(false)}>
          <div className="flex h-[75dvh] w-full max-w-md flex-col rounded-t-3xl bg-panel p-4 text-ink shadow-2xl sm:h-auto sm:max-h-[75dvh] sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="All places">
            {/* A fixed height on phones, so the search box stays put however few places match. */}
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-sign text-xl text-indigo">Places in town</h2>
              <button type="button" className="text-sm font-bold text-[#5E6582]" onClick={() => setOpen(false)}>Close</button>
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a place" className="mb-3 w-full rounded-xl border border-line bg-panel-2 px-3 py-2" />
            <ul className="-mx-1 overflow-y-auto">
              {shown.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-panel-2"
                    onClick={() => {
                      getGameStore().getState().select(p.id);
                      setOpen(false);
                    }}
                  >
                    <span>
                      <span className="block font-bold">{p.name}</span>
                      <span className="text-xs text-[#5E6582]">{p.area}</span>
                    </span>
                    {p.id === here && <span className="rounded-full bg-sun px-2 py-0.5 text-xs font-bold text-indigo">You are here</span>}
                  </button>
                </li>
              ))}
              {!shown.length && <li className="px-2 py-4 text-sm text-[#5E6582]">No place by that name.</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
