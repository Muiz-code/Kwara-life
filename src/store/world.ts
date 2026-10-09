// Ties the game state to the map the citizen is on: which actions a place offers, the place's hours, and how
// trips work there. Ilorin keeps its hand-tuned places, actions and modes; every other LGA uses the generic
// LGA places (src/data/lga.ts) with transport by class (src/data/transport.ts).
import type { Action } from "../data/action";
import { ACTIONS as ILORIN_ACTIONS } from "../data/ilorin/actions";
import { EAT_TAKEAWAY, takeawayPacks } from "../sim/actions";
import { ILORIN_LGAS, LGA } from "../data/geography";
import { FURNITURE_ACTIONS } from "../data/furniture";
import { SYNC_ACTIONS } from "../data/sync";
import { PHONE_ACTIONS } from "../data/phones";
import { CIVIC_ACTIONS, lgaActions, type LgaPlaceId } from "../data/lga";
import { STATE } from "../data/states";
import { MODES_BY_CLASS, NAIJA_MODES } from "../data/transport";
import { ILORIN_TRIPS, currentLga, dayNum, isAway, type Mode, type PlaceInfo, type TripWorld } from "../sim";
import type { GameState } from "../sim/state";
import { ILORIN_MAP_ID, router, type WorldMap } from "../world";

/** The citizen is on the hand-built Ilorin map (or has no citizen yet, the legacy Ilorin game). */
export function onIlorin(game: GameState, map: WorldMap | null): boolean {
  if (map) return map.id === ILORIN_MAP_ID;
  const lga = currentLga(game);
  return !lga || ILORIN_LGAS.includes(lga);
}

/** What the citizen can do at a place on the current map. */
/**
 * The prototype's "Fly to Lagos for the weekend" only ran the clock and said you went. A citizen gets a
 * real flight instead: the journey system takes you to Lagos's airport town, with the real fare, and you
 * fly back when you like. (The prototype action stays in data/ilorin for the parity tests and old saves.)
 */
const FLY_TO_LAGOS: Action = { id: "fly", label: "Fly to Lagos", dur: 0, fx: {}, done: "", journey: { state: "lagos", mode: "flight" } };

/** Item 7 is pick-up only: its meals are packed to eat at home, not eaten at the counter. */
const TAKEAWAY_PLACES = new Set(["item7"]);
function asTakeaway(a: Action): Action {
  if (!a.fx.food) return a;
  const { food, ...rest } = a.fx;
  return {
    ...a, label: `${a.label} (take-away)`, dur: 15, fx: rest, takeaway: food, bubble: "Waiting",
    done: `${a.done.replace(/\.$/, "")}, packed in a nylon bag. Take it home and eat it while it's hot.`,
  };
}

export function actionsAt(game: GameState, map: WorldMap | null, placeId: string): Action[] {
  const all = placeActions(game, map, placeId);
  // At home with take-away packs: eat one.
  return placeId === game.homeId && game.loc === game.homeId && takeawayPacks(game).length ? [...all, EAT_TAKEAWAY] : all;
}

function placeActions(game: GameState, map: WorldMap | null, placeId: string): Action[] {
  const c = game.citizen;
  const place = map?.places.find((p) => p.id === placeId);
  if (!c || onIlorin(game, map)) {
    const civic = place && place.kind in KIND_TO_CIVIC ? CIVIC_ACTIONS[KIND_TO_CIVIC[place.kind]] : [];
    // Taiwo Oke sells appliances and furniture.
    const shop = placeId === "taiwo" ? [...FURNITURE_ACTIONS, ...PHONE_ACTIONS] : placeId === "sync" ? SYNC_ACTIONS : [];
    const own = (ILORIN_ACTIONS[placeId] ?? []).map((a) => (c && a.goal === "fly" ? FLY_TO_LAGOS : TAKEAWAY_PLACES.has(placeId) ? asTakeaway(a) : a));
    return [...own, ...civic, ...shop];
  }
  const lgaCode = currentLga(game)!;
  // Visiting: the town's homes and workplaces are not yours.
  if (isAway(game) && ["home", "work", "shelter"].includes(placeId)) return [];
  const lga = LGA[lgaCode];
  const acts = lgaActions({
    state: STATE[lga.stateCode],
    lgaName: lga.name,
    cls: c.cls,
    job: c.job,
    home: c.home,
    underFlyover: c.underFlyover,
    wasUnder: c.wasUnder,
    career: c.career,
    visiting: isAway(game),
  });
  return acts[placeId as LgaPlaceId] ?? [];
}

/** Civic places on the Ilorin map, by tile kind, get the shared civic actions. */
const KIND_TO_CIVIC: Record<string, keyof typeof CIVIC_ACTIONS> = {
  inec: "inec", school: "pu", viewing: "viewing", kiosk: "kiosk", townhall: "hall", board: "board",
};

export const findActionAt = (game: GameState, map: WorldMap | null, placeId: string, actionId: string) =>
  actionsAt(game, map, placeId).find((a) => a.id === actionId);

/** Hours and generator for a place, for the action rules. */
export function placeInfo(map: WorldMap | null, placeId: string): PlaceInfo | undefined {
  const p = map?.places.find((x) => x.id === placeId);
  return p ? { name: p.name, open: p.open, gen: p.gen } : undefined;
}

const toMode = (m: (typeof NAIJA_MODES)[keyof typeof NAIJA_MODES]): Mode => ({ label: m.label, note: m.by, minutes: m.minutes, fare: m.fare });

const routers = new WeakMap<WorldMap, ReturnType<typeof router>>();
/** One road graph per map, built on first use. */
export function routerFor(map: WorldMap) {
  let r = routers.get(map);
  if (!r) routers.set(map, (r = router(map)));
  return r;
}

/** How trips work on this map. Ilorin keeps its tuned routes and modes. */
/** Your Sync car and driver, for the day you hired them. */
const HIRED: Mode = { label: "Hired car", note: "Your Sync driver for today", minutes: (d) => Math.round(3 + d / 45), fare: () => 0 };
const hiredToday = (game: GameState) => game.flags.carHireDay === dayNum(game.t);

export function tripWorldFor(game: GameState, map: WorldMap | null): TripWorld {
  if (!game.citizen || onIlorin(game, map)) {
    return hiredToday(game) ? { ...ILORIN_TRIPS, modes: { ...ILORIN_TRIPS.modes, hire: HIRED }, modeIds: [...ILORIN_TRIPS.modeIds, "hire"] } : ILORIN_TRIPS;
  }
  if (!map) return { route: () => ({ ids: [], pts: [], length: 0, highway: false }), modes: {}, modeIds: [], placeName: (id) => id };
  const r = routerFor(map);
  const modes: Record<string, Mode> = Object.fromEntries(Object.entries(NAIJA_MODES).map(([k, m]) => [k, toMode(m)]));
  const modeIds: string[] = [...MODES_BY_CLASS[game.citizen.cls]];
  // A car you bought: drive yourself, paying only for fuel. The rich already have an SUV and a driver.
  if (game.car && !modeIds.includes("suv")) {
    modes.drive = { label: "Your car", note: "in your own car", minutes: NAIJA_MODES.ride.minutes, fare: (d: number) => 200 + Math.round(d / 200) * 50 };
    modeIds.push("drive");
  }
  if (hiredToday(game)) {
    modes.hire = HIRED;
    modeIds.push("hire");
  }
  return {
    route: (from, to) => r.route(from, to),
    modes,
    modeIds,
    placeName: (id) => map!.places.find((p) => p.id === id)?.name ?? id,
  };
}
