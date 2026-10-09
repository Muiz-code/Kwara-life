"use client";
// Sync, the town's everything app: book a ride, find a home to rent or buy, see what's on this week, or
// hire a car with a driver for the day. Homes are signed at the Sync office; the app books the ride there.
import { useState, type ReactNode } from "react";
import { CalendarDays, Car, Home, MapPin } from "lucide-react";
import { PLACE as ILORIN_PLACE } from "@/data/ilorin/places";
import { HOUSES } from "@/data/shops";
import { CAR_HIRE_PRICE, townEvents } from "@/data/sync";
import { DAYS, dayNum, dayOfWeek, hourOf, worldT } from "@/sim";
import { getGameStore, useGame } from "@/store";
import { Button, cx, naira } from "./ui";

type Tab = "ride" | "homes" | "events" | "car";

const TABS: { id: Tab; label: string; icon: typeof Car }[] = [
  { id: "ride", label: "Ride", icon: MapPin },
  { id: "homes", label: "Homes", icon: Home },
  { id: "events", label: "What's on", icon: CalendarDays },
  { id: "car", label: "Car hire", icon: Car },
];

export default function SyncApp({ ride }: { ride: ReactNode }) {
  const [tab, setTab] = useState<Tab>("ride");
  return (
    <div className="text-sm">
      <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-panel-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx("flex flex-col items-center rounded-lg py-1.5 text-[11px] font-bold", tab === t.id ? "bg-[#111418] text-white" : "text-ink-soft")}
          >
            <t.icon aria-hidden className="mb-0.5 h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>
      {tab === "ride" && ride}
      {tab === "homes" && <Homes />}
      {tab === "events" && <Events />}
      {tab === "car" && <CarHire />}
    </div>
  );
}

/** Head to a place: its card opens with the ways to get there. */
const goTo = (id: string) => getGameStore().getState().select(id);

function Homes() {
  const house = useGame((s) => s.game.house);
  const money = useGame((s) => s.game.money);
  const hasOffice = useGame((s) => !!s.world?.places.some((p) => p.id === "sync") || !!ILORIN_PLACE.sync);
  const section = (rent: boolean) => (
    <>
      <h3 className="mt-2 mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">{rent ? "To rent (a year up front)" : "To buy"}</h3>
      <ul className="space-y-1.5">
        {HOUSES.filter((h) => !!h.rent === rent).map((h) => (
          <li key={h.id} className={cx("rounded-xl bg-panel-2 p-2", house === h.id && "ring-2 ring-[#0E7A4B]")}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold">{h.name}</span>
              <span className={cx("shrink-0 font-bold", h.price > money && "text-danger")}>{naira(h.price)}</span>
            </div>
            <p className="text-xs text-ink-soft">{h.blurb}</p>
            <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-bold">
              {h.generator && <span className="rounded-full bg-[#0E7A4B]/10 px-2 py-0.5 text-[#0E7A4B]">Generator</span>}
              {house === h.id && <span className="rounded-full bg-[#0E7A4B] px-2 py-0.5 text-white">Your home</span>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
  return (
    <div>
      <p className="text-ink-soft">Inspect and sign at the Sync office. We&apos;ll get you there.</p>
      {hasOffice && (
        <Button small className="mt-2 w-full" onClick={() => goTo("sync")}>
          Book an inspection at the Sync office
        </Button>
      )}
      {section(true)}
      {section(false)}
    </div>
  );
}

function Events() {
  const t = useGame((s) => s.game.t);
  const world = useGame((s) => s.world);
  const w = worldT({ t });
  const weekday = dayOfWeek(w);
  const has = (id: string) => (world ? world.places.some((p) => p.id === id) : !!ILORIN_PLACE[id]);
  const events = townEvents(weekday, hourOf(w), has);
  const when = (inDays: number) => (inDays === 0 ? "Today" : inDays === 1 ? "Tomorrow" : DAYS[(weekday + inDays) % 7]);
  const name = (id: string) => world?.places.find((p) => p.id === id)?.name ?? ILORIN_PLACE[id]?.name ?? id;
  if (!events.length) return <p className="text-ink-soft">Nothing on this week. Check back tomorrow.</p>;
  return (
    <ul className="space-y-1.5">
      {events.map((e) => (
        <li key={`${e.title}-${e.inDays}`} className="flex items-center gap-2 rounded-xl bg-panel-2 p-2">
          <div className="w-14 shrink-0 text-center">
            <div className="text-[11px] font-bold uppercase text-ink-soft">{when(e.inDays)}</div>
            <div className="font-bold">{e.hour % 12 || 12}{e.hour < 12 ? "am" : "pm"}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{e.title}</div>
            <div className="truncate text-xs text-ink-soft">
              {name(e.place)} · {e.note}
            </div>
          </div>
          <Button small onClick={() => goTo(e.place)}>
            Go
          </Button>
        </li>
      ))}
    </ul>
  );
}

function CarHire() {
  const hired = useGame((s) => s.game.flags.carHireDay === dayNum(s.game.t));
  const money = useGame((s) => s.game.money);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="rounded-xl bg-[#111418] p-3 text-white">
        <div className="text-xs opacity-80">Sync Car + Driver</div>
        <div className="font-sign text-2xl">{naira(CAR_HIRE_PRICE)} / day</div>
        <p className="mt-1 text-xs opacity-80">A clean car, AC, and a driver on standby till midnight. Every trip today, anywhere in town, free.</p>
      </div>
      {hired ? (
        <p className="rounded-xl bg-[#0E7A4B]/10 p-2 font-bold text-[#0E7A4B]">Your driver is on standby today. Pick &quot;Hired car&quot; when you travel.</p>
      ) : (
        <Button
          className="w-full"
          disabled={money < CAR_HIRE_PRICE}
          onClick={() => setMsg(getGameStore().getState().hireCar() ?? "Booked! Your driver is on standby.")}
        >
          {money < CAR_HIRE_PRICE ? "Not enough money" : "Book a car and driver"}
        </Button>
      )}
      {msg && <p className="text-xs font-semibold text-ink-soft">{msg}</p>}
    </div>
  );
}
