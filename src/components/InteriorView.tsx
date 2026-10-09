"use client";
// Inside a place, in 3D. Shown over the town (which stops drawing meanwhile) while you are inside.
// Tap the floor to walk; tap something you can use and it asks what to do (sleep or take a nap).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { blockReason, actionCost, actionMinutes, packNote } from "@/sim/actions";
import { fmtDuration } from "@/sim/time";
import { Paintbrush, X } from "lucide-react";
import {
  ACCENTS,
  FLOORS,
  SOFAS,
  WALLS,
  defaultStyle,
  homeClass,
  type HomeStyle,
} from "@/data/homestyle";
import { getGameStore, useGame } from "@/store";
import { actionsAt, placeInfo } from "@/store/world";
import { roomFor, type Interior3D } from "@/world3d/interior";
import { COUNTER_ROLES } from "@/data/counters";
import type { Spot } from "@/world3d/home";
import Loader from "./game/Loader";
import { isPhone, naira, useNow } from "./game/ui";

export default function InteriorView({
  placeId,
  kind,
  name,
}: {
  placeId: string;
  kind: string;
  name: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const room = useRef<Interior3D | null>(null);
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState<{ spot: Spot; x: number; y: number } | null>(
    null,
  );
  const now = useNow(5000);
  const [styling, setStyling] = useState(false);
  /** What the person behind the counter just said. */
  const [said, setSaid] = useState<{ who: string; line: string } | null>(null);
  const role = COUNTER_ROLES[roomFor(kind, placeId)];
  useEffect(() => {
    if (!said) return;
    const id = setTimeout(() => setSaid(null), 5000);
    return () => clearTimeout(id);
  }, [said]);
  // Restyling the home, moving house or rising or falling a class rebuilds the room.
  const styleKey = useGame((s) =>
    placeId === "home"
      ? `${s.game.citizen?.cls}|${s.game.house}|${s.game.homeStyle ? Object.values(s.game.homeStyle).join("|") : ""}`
      : "",
  );

  useEffect(() => {
    let alive = true;
    let made: Interior3D | null = null;
    (async () => {
      const { Interior3D } = await import("@/world3d/interior");
      if (!alive || !host.current) return;
      made = await Interior3D.create(host.current, getGameStore(), {
        placeId,
        kind,
        onSpot: (spot, x, y) => setMenu({ spot, x, y }),
      });
      if (!alive) return made.destroy();
      room.current = made;
      setReady(true);
    })();
    return () => {
      alive = false;
      made?.destroy();
      room.current = null;
    };
  }, [placeId, kind, styleKey]);

  const st = getGameStore().getState();
  // The counter ("*") offers everything the place does; anything else, only what it is for.
  const choices = menu
    ? actionsAt(st.game, st.world, placeId).filter(
        (a) =>
          menu.spot.actions.includes("*") || menu.spot.actions.includes(a.id),
      )
    : [];
  const atCounter = !!menu?.spot.actions.includes("*");
  const phone = isPhone();
  const info = placeInfo(st.world, placeId) ?? {
    name,
    open: [0, 24] as [number, number],
    gen: false,
  };

  return (
    <div className="absolute inset-0 z-1">
      <div
        ref={host}
        className="absolute inset-0"
        aria-label={`Inside ${name}`}
        role="img"
        onPointerDown={() => setMenu(null)}
      />
      {menu &&
        createPortal(
          // Above the HUD: on a phone a sheet over the bottom of the screen, elsewhere a popover where you tapped.
          <div
            className="fixed inset-0 z-50"
            onPointerDown={() => setMenu(null)}
          >
            <div
              className={
                phone
                  ? "fixed inset-x-3 bottom-3 max-h-[60dvh] overflow-y-auto rounded-2xl bg-panel p-2 text-ink shadow-2xl"
                  : "fixed max-h-[70dvh] w-60 overflow-y-auto rounded-2xl bg-panel p-2 text-ink shadow-2xl"
              }
              style={
                phone
                  ? undefined
                  : {
                      left: Math.min(menu.x, window.innerWidth - 250),
                      top: Math.min(
                        Math.max(8, menu.y - 20),
                        window.innerHeight - 320,
                      ),
                    }
              }
              onPointerDown={(e) => e.stopPropagation()}
              role="menu"
              aria-label={menu.spot.label}
            >
              <div className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-[#5E6582]">
                {menu.spot.label}
              </div>
              {choices.map((a) => {
                const why = blockReason(st.game, a, { now, place: info });
                const cost = actionCost(st.game, a);
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="menuitem"
                    disabled={!!why}
                    className="block w-full rounded-xl px-2 py-2 text-left hover:bg-panel-2 disabled:opacity-55"
                    onClick={() => {
                      room.current?.use(menu.spot, a.id);
                      setMenu(null);
                    }}
                  >
                    <span className="block font-bold">{a.label}</span>
                    <span className="text-xs text-[#5E6582]">
                      {fmtDuration(actionMinutes(st.game, a))}
                      {cost > 0 ? ` · ${naira(cost)}` : ""}
                      {packNote(st.game, a) ? ` · ${packNote(st.game, a)}` : ""}
                    </span>
                    {why && (
                      <span className="block text-xs font-semibold text-danger">
                        {why}
                      </span>
                    )}
                  </button>
                );
              })}
              {atCounter && role && (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full rounded-xl px-2 py-2 text-left hover:bg-panel-2"
                  onClick={() => {
                    setSaid({
                      who: role.who,
                      line: role.lines[
                        Math.floor(Math.random() * role.lines.length)
                      ],
                    });
                    setMenu(null);
                  }}
                >
                  <span className="block font-bold">Talk to {role.who}</span>
                  <span className="text-xs text-[#5E6582]">Free</span>
                </button>
              )}
              {!choices.length && !atCounter && (
                <p className="px-2 py-2 text-sm text-[#5E6582]">
                  Nothing to do with this here.
                </p>
              )}
              <button
                type="button"
                onClick={() => setMenu(null)}
                className="mt-1 block w-full rounded-xl px-2 py-2 text-center text-sm font-bold text-[#5E6582] hover:bg-panel-2"
              >
                Close
              </button>
            </div>
          </div>,
          document.body,
        )}
      {said &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 top-1/3 z-50 mx-auto w-fit max-w-[88%] rounded-2xl bg-panel px-4 py-3 text-ink shadow-2xl"
            role="status"
          >
            <div className="text-xs font-bold uppercase tracking-wide text-[#5E6582]">
              {said.who.replace(/^the /, "")}
            </div>
            <p className="text-sm font-semibold">&ldquo;{said.line}&rdquo;</p>
          </div>,
          document.body,
        )}
      {ready && !menu && (
        <p className="pointer-events-none absolute inset-x-0 bottom-28 mx-auto w-fit max-w-[90%] rounded-full bg-indigo/85 px-4 py-1.5 text-center text-xs font-semibold text-[#F7E7C1]">
          {placeId === "home"
            ? "Tap the floor to walk. Tap your bed, stove, shower, TV or radio to use them."
            : role
              ? `Tap ${role.who} to see what you can do here.`
              : "Tap the floor to walk around."}
        </p>
      )}
      {placeId === "home" && ready && (
        <button
          type="button"
          onClick={() => setStyling((v) => !v)}
          aria-expanded={styling}
          className="absolute right-3 top-20 z-10 flex items-center gap-1.5 rounded-full bg-panel px-3 py-2 text-sm font-bold text-ink shadow-lg"
        >
          <Paintbrush size={16} aria-hidden /> Style my home
        </button>
      )}
      {placeId === "home" && styling && (
        <StylePanel onClose={() => setStyling(false)} />
      )}
      <Loader done={ready} />
    </div>
  );
}

const ROWS = [
  {
    key: "wall",
    label: "Walls",
    options: WALLS.map((o) => ({ id: o.id, label: o.label, colour: o.colour })),
  },
  {
    key: "floor",
    label: "Floor",
    options: FLOORS.map((o) => ({
      id: o.id,
      label: o.label,
      colour: `linear-gradient(135deg, ${o.tiles[0]} 50%, ${o.tiles[1]} 50%)`,
    })),
  },
  {
    key: "sofa",
    label: "Sofa",
    options: SOFAS.map((o) => ({ id: o.id, label: o.label, colour: o.colour })),
  },
  {
    key: "accent",
    label: "Curtains, rug and cushions",
    options: ACCENTS.map((o) => ({
      id: o.id,
      label: o.label,
      colour: o.colour,
    })),
  },
] as const;

/** Swatches for the paint, the floor, the sofa and the accents. Free to change; saved with the game. */
function StylePanel({ onClose }: { onClose: () => void }) {
  const cls = useGame((s) => homeClass(s.game));
  const saved = useGame((s) => s.game.homeStyle);
  const style: HomeStyle = saved ?? defaultStyle(cls);
  const pick = (key: keyof HomeStyle, id: string) =>
    getGameStore()
      .getState()
      .setHomeStyle({ ...style, [key]: id });
  return (
    <div
      className="absolute right-3 top-32 z-10 w-72 max-w-[calc(100%-24px)] rounded-2xl bg-panel p-3 text-ink shadow-2xl"
      role="dialog"
      aria-label="Style my home"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold">Style my home</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1 hover:bg-panel-2"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      {ROWS.map((row) => (
        <div key={row.key} className="mb-2">
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[#5E6582]">
            {row.label}
          </div>
          <div
            className="flex flex-wrap gap-1.5"
            role="radiogroup"
            aria-label={row.label}
          >
            {row.options.map((o) => {
              const on = style[row.key] === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={o.label}
                  aria-label={o.label}
                  onClick={() => pick(row.key, o.id)}
                  className={`h-8 w-8 rounded-full border-2 ${on ? "border-ink ring-2 ring-[#F2B705]" : "border-black/15"}`}
                  style={{ background: o.colour }}
                />
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-[#5E6582]">
        Furniture you buy at the market shows up here too.
      </p>
    </div>
  );
}
