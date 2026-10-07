// Ties the game state to the map the citizen is on: which actions a place offers, the place's hours, and how
// trips work there. Ilorin keeps its hand-tuned places, actions and modes; every other LGA uses the generic
// LGA places (src/data/lga.ts) with transport by class (src/data/transport.ts).
import type { Action } from "../data/action";
import { ACTIONS as ILORIN_ACTIONS } from "../data/ilorin/actions";
import { ILORIN_LGAS, LGA } from "../data/geography";
import { CIVIC_ACTIONS, lgaActions, type LgaPlaceId } from "../data/lga";
import { STATE } from "../data/states";
import { MODES_BY_CLASS, NAIJA_MODES } from "../data/transport";
import { ILORIN_TRIPS, currentLga, isAway, type Mode, type PlaceInfo, type TripWorld } from "../sim";
import type { GameState } from "../sim/state";
import { ILORIN_MAP_ID, router, type WorldMap } from "../world";

/** The citizen is on the hand-built Ilorin map (or has no citizen yet, the legacy Ilorin game). */
export function onIlorin(game: GameState, map: WorldMap | null): boolean {
  if (map) return map.id === ILORIN_MAP_ID;
  const lga = currentLga(game);
  return !lga || ILORIN_LGAS.includes(lga);
}

/** What the citizen can do at a place on the current map. */
export function actionsAt(game: GameState, map: WorldMap | null, placeId: string): Action[] {
  const c = game.citizen;
  const place = map?.places.find((p) => p.id === placeId);
  if (!c || onIlorin(game, map)) {
    const civic = place && place.kind in KIND_TO_CIVIC ? CIVIC_ACTIONS[KIND_TO_CIVIC[place.kind]] : [];
    return [...(ILORIN_ACTIONS[placeId] ?? []), ...civic];
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
export function tripWorldFor(game: GameState, map: WorldMap | null): TripWorld {
  if (!game.citizen || onIlorin(game, map)) return ILORIN_TRIPS;
  if (!map) return { route: () => ({ ids: [], pts: [], length: 0, highway: false }), modes: {}, modeIds: [], placeName: (id) => id };
  const r = routerFor(map);
  const modes = Object.fromEntries(Object.entries(NAIJA_MODES).map(([k, m]) => [k, toMode(m)]));
  return {
    route: (from, to) => r.route(from, to),
    modes,
    modeIds: MODES_BY_CLASS[game.citizen.cls],
    placeName: (id) => map!.places.find((p) => p.id === id)?.name ?? id,
  };
}
