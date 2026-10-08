// What the rest of the app needs from the world: pick a map, route on it, draw it.
export type { BillboardSlot, MapPlace, MapRoad, PlaceKind, Point, RoadClass, WorldMap } from "./types";
export { PLACE_KINDS, isPlaceKind } from "./types";
export { loadMap, townFor, type MapRequest } from "./load";
export { buildTown, type TownSpec } from "./town";
export { townSpecFor } from "./town-spec";
export { ilorinTown, ILORIN_TOWN_ID as ILORIN_MAP_ID } from "./ilorin-town";
export { generateMap, type GenOptions } from "./generate";
export {
  meanTripLength, normaliseTrips, pointAlong, polylineLength, router, routeOn, TARGET_MEAN_TRIP,
  type MapRoute, type RoadGraph,
} from "./routing";
export { billboardPositions, hitTest, roadDistance, standAt, type MapHit } from "./layout";
export { KIND_ART, MISSING_ART } from "./tiles";
export { TILE_W, TILE_BASE } from "./art";
