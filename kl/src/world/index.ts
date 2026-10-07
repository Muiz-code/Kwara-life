// What the rest of the app needs from the world: pick a map, route on it, draw it.
export type { BillboardSlot, MapPlace, MapRoad, PlaceKind, Point, RoadClass, WorldMap } from "./types";
export { OSM_ATTRIBUTION, PLACE_KINDS, isPlaceKind } from "./types";
export { loadMap, mapUrl, type MapRequest } from "./load";
export { ilorinMap, ILORIN_MAP_ID } from "./ilorin-map";
export { generateMap, type GenOptions } from "./generate";
export { addPlayerPlaces, type PlayerPlacesOptions } from "./player-places";
export {
  meanTripLength, normaliseTrips, pointAlong, polylineLength, router, routeOn, TARGET_MEAN_TRIP,
  type MapRoute, type RoadGraph,
} from "./routing";
export { billboardPositions, hitTest, roadDistance, standAt, type MapHit } from "./layout";
export { KIND_ART, MISSING_ART } from "./tiles";
export { TILE_W, TILE_BASE } from "./art";
