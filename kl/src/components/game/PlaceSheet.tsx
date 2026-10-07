"use client";
// The Life tab: the selected place, what you can do there, or how to get there.
import { useMemo, useState } from "react";
import { LGAS, LGA } from "@/data/geography";
import { PLACE as ILORIN_PLACE } from "@/data/ilorin/places";
import { STATES, STATE } from "@/data/states";
import { SHORT_NEED } from "./labels";
import {
  MODES_FOR_CLASS, actionCost, actionMinutes, blockReason, currentLga, fmtDuration, isOpen, modeBlockReason, openText, quoteJourney,
  quoteTrip, type JourneyMode,
} from "@/sim";
import { actionsAt, placeInfo, tripWorldFor } from "@/store/world";
import { getGameStore, useGame } from "@/store";
import { Button, Chip, Modal, Sheet, naira, useNow } from "./ui";

export default function PlaceSheet({ onClose }: { onClose: () => void }) {
  const st = useGame((s) => s);
  const now = useNow(5000);
  const [journey, setJourney] = useState(false);
  const { game, world, selected } = st;
  const busy = st.activity !== null;
  const mapPlace = world?.places.find((p) => p.id === selected);
  const info = placeInfo(world, selected) ?? (ILORIN_PLACE[selected] ? { name: ILORIN_PLACE[selected].name, open: ILORIN_PLACE[selected].open, gen: ILORIN_PLACE[selected].gen } : null);
  if (!info) return null;
  const blurb = mapPlace?.blurb ?? ILORIN_PLACE[selected]?.blurb ?? "";
  const open = isOpen(info, Math.floor((game.t % 1440) / 60));
  const here = selected === game.loc;
  const acts = actionsAt(game, world, selected);

  return (
    <Sheet title={info.name} onClose={onClose}>
      <div className="mb-1 text-sm font-semibold">
        <span className={open ? "text-up" : "text-danger"}>{open ? openText(info) : "Closed now"}</span>
      </div>
      {blurb && <p className="mb-3 text-sm text-ink-soft">{blurb}</p>}

      {here ? (
        <div className="flex flex-col gap-2">
          {acts.map((a) => {
            const why = busy ? null : blockReason(game, a, { now, place: info });
            const cost = actionCost(game, a);
            const mins = actionMinutes(game, a);
            return (
              <button
                key={a.id}
                type="button"
                disabled={!!why || busy}
                onClick={() => getGameStore().getState().doAction(a.id, performance.now())}
                className="rounded-2xl border border-transparent bg-panel-2 px-3 py-2.5 text-left hover:border-indigo disabled:opacity-55"
              >
                <span className="block font-bold">{a.label}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {mins > 0 && <Chip>{fmtDuration(mins)}</Chip>}
                  {cost > 0 && <Chip tone="cost">{naira(cost)}</Chip>}
                  {a.earn && <Chip tone="up">+{naira(a.earn)}</Chip>}
                  {Object.entries(a.fx).map(([k, v]) => (
                    <Chip key={k} tone={(v ?? 0) > 0 ? "up" : "down"}>
                      {(v ?? 0) > 0 ? "+" : "−"}
                      {SHORT_NEED[k]}
                    </Chip>
                  ))}
                </span>
                {why && <span className="mt-1 block text-xs font-semibold text-danger">{why}</span>}
              </button>
            );
          })}
          {game.citizen && selected === "park" && (
            <Button tone="keke" onClick={() => setJourney(true)} disabled={busy}>
              Travel to another town or state
            </Button>
          )}
        </div>
      ) : (
        <TripModes />
      )}
      {journey && <JourneyPicker onClose={() => setJourney(false)} />}
    </Sheet>
  );
}

function TripModes() {
  const st = useGame((s) => s);
  const { game, world, selected } = st;
  const busy = st.activity !== null;
  const w = useMemo(() => tripWorldFor(game, world), [game, world]);
  const q = useMemo(() => {
    try {
      return quoteTrip(game.loc, selected, w);
    } catch {
      return null;
    }
  }, [game.loc, selected, w]);
  if (!q) return <p className="text-sm text-ink-soft">The map is still loading.</p>;
  return (
    <div className="grid grid-cols-2 gap-2">
      {w.modeIds.map((m) => {
        const why = busy ? "" : modeBlockReason(game, m, q);
        return (
          <button
            key={m}
            type="button"
            disabled={!!why || busy}
            onClick={() => getGameStore().getState().travel(selected, m, performance.now())}
            className="rounded-2xl bg-indigo px-3 py-2.5 text-left text-[#F7E7C1] disabled:opacity-45"
          >
            <b className="block">{w.modes[m].label}</b>
            <small className="block opacity-90">
              {q.modes[m].fare ? naira(q.modes[m].fare) : "Free"}, about {fmtDuration(q.modes[m].minutes)}
            </small>
            <small className="block opacity-75">{why || w.modes[m].note}</small>
          </button>
        );
      })}
    </div>
  );
}

const JOURNEY_LABEL: Record<JourneyMode, string> = { bus: "Bus", flight: "Fly", car: "Your car" };

function JourneyPicker({ onClose }: { onClose: () => void }) {
  const game = useGame((s) => s.game);
  const now = useNow(10_000);
  const here = currentLga(game)!;
  const [stateCode, setStateCode] = useState(LGA[here].stateCode);
  const lgas = LGAS.filter((l) => l.stateCode === stateCode && l.code !== here);
  const [to, setTo] = useState(lgas[0]?.code ?? "");
  const [err, setErr] = useState<string | null>(null);
  const home = game.citizen!.lgaCode;
  return (
    <Modal title="Where are you going?">
      {here !== home && (
        <Button tone="keke" className="mb-3 w-full" onClick={() => {
            setStateCode(LGA[home].stateCode);
            setTo(home);
          }}>
          Go home to {LGA[home].name}
        </Button>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-bold">
          State
          <select
            value={stateCode}
            onChange={(e) => {
              setStateCode(e.target.value);
              setTo(LGAS.find((l) => l.stateCode === e.target.value && l.code !== here)?.code ?? "");
            }}
            className="mt-1 block w-full rounded-xl border border-line bg-panel-2 px-3 py-2"
          >
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          Town (LGA)
          <select value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-panel-2 px-3 py-2">
            {lgas.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {to &&
          MODES_FOR_CLASS[game.citizen!.cls].map((m) => {
            const q = quoteJourney(game, to, m, now);
            return (
              <button
                key={m}
                type="button"
                disabled={!!q.blocked}
                onClick={() => {
                  const e = getGameStore().getState().journeyTo(to, m);
                  if (e) setErr(e);
                  else onClose();
                }}
                className="rounded-2xl bg-panel-2 px-3 py-2.5 text-left disabled:opacity-50"
              >
                <b>{JOURNEY_LABEL[m]}</b> · {naira(q.fare)} · about {fmtDuration(q.minutes)} · {q.km} km
                {q.blocked && <span className="block text-xs font-semibold text-danger">{q.blocked}</span>}
              </button>
            );
          })}
      </div>
      {err && <p className="mt-2 text-sm font-bold text-danger">{err}</p>}
      <p className="mt-3 text-xs text-ink-soft">
        You can only vote at your polling unit in {LGA[home].name}, {STATE[LGA[home].stateCode].name}. Be home before election day.
      </p>
      <Button tone="ghost" onClick={onClose} className="mt-3 w-full">
        Cancel
      </Button>
    </Modal>
  );
}

/** The long-journey loading screen when crossing into another zone's server. */
export function JourneyOverlay() {
  const j = useGame((s) => s.journey);
  const now = useNow(250);
  if (!j) return null;
  const left = Math.max(0, Math.ceil((j.until - now) / 1000));
  const lga = LGA[j.to];
  if (left === 0) {
    setTimeout(() => getGameStore().getState().endJourney(), 0);
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#26355E] to-[#0F1730] p-6 text-center text-[#F7E7C1]">
      <div className="text-5xl" aria-hidden>
        🚌
      </div>
      <h2 className="font-sign text-3xl">On the road to {lga.name}</h2>
      <p className="max-w-sm text-sm opacity-90">Long journey. The radio is on, the driver is playing fuji, and somebody is selling gala at every stop.</p>
      <div className="h-2 w-64 overflow-hidden rounded-full bg-white/20">
        <div className="h-full bg-keke transition-[width]" style={{ width: `${100 - (left / j.seconds) * 100}%` }} />
      </div>
      <p className="text-sm opacity-75">Arriving in about {left}s</p>
    </div>
  );
}
