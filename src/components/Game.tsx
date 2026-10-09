"use client";
import {
  DoorClosed,
  DoorOpen,
  Ellipsis,
  LocateFixed,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  House,
  X,
} from "lucide-react";

import { useEffect, useState } from "react";
import MapView from "./MapView";
import InteriorView from "./InteriorView";
import AdBooking from "./game/AdBooking";
import { ILORIN_MAP_ID } from "@/world";
import { PLACE as ILORIN_PLACE } from "@/data/ilorin/places";
import type { MapHandle } from "@/world/handle";
import { loadMap } from "@/world";
import { LGA } from "@/data/geography";
import { STATE } from "@/data/states";
import { currentLga } from "@/sim";
import {
  debugMode,
  getGameStore,
  isBusy,
  startGameLoop,
  syncClock,
  useGame,
} from "@/store";
import CreateCitizen, { Reveal } from "./game/CreateCitizen";
import {
  BottomNav,
  NeedsDock,
  NewsTicker,
  Notes,
  Objectives,
  Toasts,
  TopBar,
  type Tab,
} from "./game/Hud";
import PlaceSheet, { JourneyOverlay, JourneyPicker } from "./game/PlaceSheet";
import { BribeModal, CampaignPanel, PromoModal } from "./game/Campaign";
import { BallotFlow, Results, VotePanel } from "./game/Vote";
import { IncomingCall, PhonePanel } from "./game/Phone";
import { PlacesButton } from "./game/MapControls";
import TripBar from "./game/TripBar";
import ServicePanel from "./game/ServicePanel";
import WorkPanel from "./game/WorkPanel";
import { Atmosphere, Overheard } from "./game/Vibes";
import Inspection from "./game/Inspection";
import { DISCLAIMER, useNow } from "./game/ui";
import { PRESIDENTIAL_2027 as CAL, seasonClosed } from "@/data/calendar";

/** One tap to step into the place you are standing at, or back out to the street. */
function DoorButton({ inside, name }: { inside: boolean; name: string }) {
  const busy = useGame(isBusy);
  const Icon = inside ? DoorClosed : DoorOpen;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => getGameStore().getState().setInside(!inside)}
      className="pointer-events-auto flex max-w-[70vw] items-center gap-2 rounded-2xl border-2 border-ink/25 bg-indigo px-3 py-1.5 text-sm font-bold sm:px-3.5 sm:py-2 sm:text-base text-white shadow-md hover:brightness-110 disabled:opacity-55"
    >
      <Icon aria-hidden className="h-5 w-5 shrink-0" strokeWidth={2.25} />
      {/* The full name is on the place card; a phone gets the short label. */}
      <span className="truncate sm:hidden">
        {inside ? "Go outside" : "Go inside"}
      </span>
      <span className="hidden truncate sm:inline">
        {inside ? "Go outside" : `Go inside ${name}`}
      </span>
    </button>
  );
}

/** Away from home: one tap opens the journey home. */
function GoHomeButton() {
  const busy = useGame(isBusy);
  const home = useGame((s) => s.game.citizen?.lgaCode);
  const [open, setOpen] = useState(false);
  if (!home) return null;
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex max-w-[70vw] items-center gap-2 rounded-2xl border-2 border-ink/25 bg-keke px-3 py-1.5 text-sm font-bold sm:px-3.5 sm:py-2 sm:text-base text-[#2A2000] shadow-md hover:brightness-105 disabled:opacity-55"
      >
        <House aria-hidden className="h-5 w-5 shrink-0" strokeWidth={2.25} />
        <span className="truncate sm:hidden">Go home</span>
        <span className="hidden truncate sm:inline">
          Go home to {LGA[home].name}
        </span>
      </button>
      {open && <JourneyPicker home onClose={() => setOpen(false)} />}
    </>
  );
}

export default function Game() {
  const [map, setMap] = useState<MapHandle | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  /** The billboard being booked, or null. */
  const [adBoard, setAdBoard] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(true);
  /** Phones: zoom and turn buttons folded away until asked for. */
  const [moreControls, setMoreControls] = useState(false);
  const [results, setResults] = useState(false);
  // When polls close the results open for everyone, once; the Vote tab can replay them.
  const [seenResults, setSeenResults] = useState(false);
  const over = seasonClosed(CAL, useNow(5000));
  const citizen = useGame((s) => s.game.citizen);
  const lgaCode = useGame((s) => currentLga(s.game));
  const world = useGame((s) => s.world);
  const flow = useGame((s) => s.flow);
  const selected = useGame((s) => s.selected);
  const inside = useGame((s) => s.game.inside);
  const loc = useGame((s) => s.game.loc);
  const away = useGame((s) => s.game.at !== null);
  // The place you are inside: from the town map, or the hand-built Ilorin places.
  const insideOf = (() => {
    const p = world?.places.find((q) => q.id === loc) ?? ILORIN_PLACE[loc];
    return p ? { id: p.id, kind: p.kind, name: p.name } : null;
  })();
  // Testers: ?debug&room=church opens any kind of room straight away.
  const [devRoom] = useState(() =>
    typeof window !== "undefined" && debugMode()
      ? new URLSearchParams(window.location.search).get("room")
      : null,
  );

  useEffect(() => {
    syncClock();
    return startGameLoop(getGameStore());
  }, []);

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
      visiting: lgaCode !== citizen.lgaCode,
      career: citizen.career,
      citizenSeed: `${citizen.name}|${citizen.createdAt}`,
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
      {(world || !citizen) && (
        <MapView
          key={world?.id ?? "ilorin"}
          world={world}
          active={!inside}
          onReady={setMap}
          onBillboard={setAdBoard}
        />
      )}
      <Atmosphere />
      {adBoard && (
        <AdBooking
          mapId={world?.id ?? ILORIN_MAP_ID}
          boardId={adBoard}
          onClose={() => setAdBoard(null)}
        />
      )}
      {inside && insideOf && (
        <InteriorView
          key={insideOf.id}
          placeId={insideOf.id}
          kind={insideOf.kind}
          name={insideOf.name}
        />
      )}
      {devRoom && (
        <InteriorView
          placeId={devRoom === "home" ? "home" : "dev"}
          kind={devRoom}
          name={devRoom}
        />
      )}
      {citizen && !world && (
        <div className="absolute inset-0 flex items-center justify-center font-sign text-2xl text-indigo">
          Loading your town…
        </div>
      )}

      {/* Above the map and the room view (z-1), below the tabs (z-30) and sheets: the gauges show indoors too. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        <div className="flex flex-col gap-2 p-3">
          <TopBar />
          <NewsTicker />
        </div>
        <div className="px-3">
          <Objectives />
        </div>
        {/* While you travel: what is happening, how long is left, and Skip. */}
        <div className="mt-auto flex flex-col gap-2 px-3">
          <Overheard />
          <TripBar />
          <ServicePanel />
          <WorkPanel />
        </div>
        <div className="flex items-end justify-between gap-2 px-3 pt-3 pb-2 sm:p-3">
          <div className="flex min-w-0 flex-col items-start gap-2">
            <div className="flex flex-wrap gap-2 sm:flex-col sm:items-start">
              {citizen && revealed && insideOf && (
                <DoorButton
                  inside={inside}
                  name={insideOf.id === "home" ? "home" : insideOf.name}
                />
              )}
              {citizen && revealed && away && !inside && <GoHomeButton />}
            </div>
            <NeedsDock />
          </div>
          <div className="pointer-events-auto flex flex-col gap-1.5">
            <PlacesButton />
            <div
              className={`${moreControls ? "flex" : "hidden"} flex-col gap-1.5 sm:flex`}
            >
              {(
                [
                  [Plus, "Zoom in", 1.3],
                  [Minus, "Zoom out", 1 / 1.3],
                ] as const
              ).map(([Icon, label, f]) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink/25 bg-panel text-ink shadow-md hover:bg-panel-2"
                  onClick={() => map?.zoomBy(f)}
                >
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={2.5} />
                </button>
              ))}
              {map?.rotateBy &&
                (
                  [
                    [RotateCcw, "Turn left", -Math.PI / 4],
                    [RotateCw, "Turn right", Math.PI / 4],
                  ] as const
                ).map(([Icon, label, r]) => (
                  <button
                    key={label}
                    type="button"
                    aria-label={label}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink/25 bg-panel text-ink shadow-md hover:bg-panel-2"
                    onClick={() => map.rotateBy?.(r)}
                  >
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={2.25} />
                  </button>
                ))}
            </div>
            <button
              type="button"
              aria-label={
                moreControls ? "Fewer map controls" : "More map controls"
              }
              aria-expanded={moreControls}
              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink/25 bg-panel text-ink shadow-md hover:bg-panel-2 sm:hidden"
              onClick={() => setMoreControls((m) => !m)}
            >
              {moreControls ? (
                <X aria-hidden className="h-5 w-5" strokeWidth={2.5} />
              ) : (
                <Ellipsis aria-hidden className="h-5 w-5" strokeWidth={2.5} />
              )}
            </button>
            <button
              type="button"
              aria-label="Find me"
              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink/25 bg-panel text-ink shadow-md hover:bg-panel-2"
              onClick={() => map?.centerOnMe()}
            >
              <LocateFixed aria-hidden className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>
        </div>
        <div className="h-24" />
      </div>
      {/* Tabs stay above any open sheet. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-1 pb-1">
        <BottomNav tab={tab} onTab={setTab} />
        {/* A dark pill with light text, so it reads over any part of the map. */}
        <p className="mx-3 rounded-full bg-indigo/90 px-3 py-0.5 text-center text-[11px] font-bold text-[#F7E7C1] shadow">
          {DISCLAIMER}
          {world?.attribution && (
            <span className="whitespace-nowrap">
              {" "}
              Map data {world.attribution}
            </span>
          )}
        </p>
      </div>

      {tab === "life" && selected && <PlaceSheet onClose={close} />}
      {tab === "campaign" && <CampaignPanel onClose={close} />}
      {tab === "vote" && (
        <VotePanel onClose={close} onResults={() => setResults(true)} />
      )}
      {tab === "phone" && <PhonePanel onClose={close} />}
      <IncomingCall />

      {flow === "vote" && <BallotFlow onClose={closeFlow} />}
      {flow === "bribe" && <BribeModal onClose={closeFlow} />}
      {flow === "flyer" && <PromoModal kind="flyer" onClose={closeFlow} />}

      {!citizen && <CreateCitizen />}
      {citizen && !revealed && <Reveal onStart={() => setRevealed(true)} />}
      {citizen && revealed && <Notes />}
      <JourneyOverlay />
      <Inspection />
      {(results || (citizen && revealed && over && !seenResults)) && (
        <Results
          onClose={() => {
            setResults(false);
            setSeenResults(true);
          }}
        />
      )}
      <Toasts />
    </div>
  );
}
