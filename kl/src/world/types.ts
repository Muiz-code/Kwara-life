// The one map format every LGA uses: the hand-built Ilorin map, maps built from
// OpenStreetMap, and maps built by the fallback generator all serialise to this.
// It is plain JSON so a map can be fetched from /maps/<state>/<lga>.json.
import type { BiomeId } from "../data/biomes";

export interface Point {
  x: number;
  y: number;
}

/**
 * What a place is. The kind picks the tile art, the placeholder tile drawn in
 * code when there is no art yet, and the actions the place offers.
 */
export const PLACE_KINDS = [
  // Civic and everyday places every LGA has
  "house", "flyover", "shelter", "workshop", "office", "tower", "inec", "school",
  "market", "buka", "viewing", "kiosk", "mosque", "church", "garage", "townhall", "board",
  // Landmark shapes
  "lm-market", "lm-hills", "lm-tower", "lm-water", "lm-forest", "lm-palace", "lm-bridge", "lm-rock",
  // Ilorin's hand-built places
  "junction", "palace", "oldtown", "shops", "stadium", "estate", "airport", "square",
  "hotel", "hub", "govhouse", "garden", "mall", "campus", "poly", "village", "farmstop", "kwasu",
] as const;

export type PlaceKind = (typeof PLACE_KINDS)[number];

const KIND_SET = new Set<string>(PLACE_KINDS);
export const isPlaceKind = (s: string): s is PlaceKind => KIND_SET.has(s);

export interface MapPlace {
  id: string;
  name: string;
  /** Neighbourhood or LGA the place sits in. */
  area: string;
  kind: PlaceKind;
  blurb: string;
  /** Opening hours as [from, to) in 24h clock. [0, 24] means always open. */
  open: [number, number];
  /** Has a generator, so lights stay on when NEPA takes light. */
  gen: boolean;
  x: number;
  y: number;
  /** Where the player stands outside, when the map sets it. Otherwise beside the tile. */
  stand?: Point;
  /** Drawn art for this exact place, when there is one. Otherwise the kind's tile. */
  art?: string;
  /** Art variant: a building colour for shops, or the estate class. */
  variant?: string;
  /** Where it came from in OpenStreetMap, e.g. "node/1234". Empty for invented places. */
  osm?: string;
  /** Mirror the tile so its front faces the street. */
  flip?: boolean;
  /**
   * Where you step onto the street: one point on each road the plot touches.
   * Trips leave through these, so nobody cuts across another plot.
   */
  gates?: Point[];
}

/** Road classes we keep from OpenStreetMap, widest first. */
export const ROAD_CLASSES = ["trunk", "primary", "secondary", "tertiary", "residential"] as const;
export type RoadClass = (typeof ROAD_CLASSES)[number];

export interface MapRoad {
  /** Street name, or "" when OpenStreetMap has none. */
  name: string;
  cls?: RoadClass;
  /** A long out-of-town road: no okadas, police checkpoints, korope breakdowns. */
  highway?: boolean;
  /** The road's real shape, in world pixels. At least two points. */
  pts: Point[];
}

/** A paid ad board standing beside a road. */
export interface BillboardSlot {
  id: string;
  /** Place it stands beside. */
  near: string;
  /** Preferred offset from that place, in world pixels. */
  dx: number;
  dy: number;
}

export interface WorldMap {
  /** LGA code, e.g. "kwara/ilorin-west". The Ilorin map uses "kwara/ilorin". */
  id: string;
  name: string;
  biome: BiomeId;
  width: number;
  height: number;
  places: MapPlace[];
  roads: MapRoad[];
  /** River or creek running through the map, when the area has water. */
  river?: Point[];
  /** Named roundabouts and junctions. Labels only, you cannot enter them. */
  junctions?: { name: string; x: number; y: number }[];
  billboards?: BillboardSlot[];
  /** Where the shapes came from. */
  source: "hand" | "osm" | "generated";
  /** Credit line drawn on the map. OpenStreetMap data is ODbL. */
  attribution?: string;
  /** Metres of real ground per world pixel, when the map comes from real data. */
  metresPerPx?: number;
  /** Place the player starts at and the camera opens on. */
  start?: string;
  /** State code, for the state's landmark tile. */
  state?: string;
  /** Present on a grid-built town. */
  grid?: TownGrid;
  /** The town's ordinary buildings, drawn but not tappable. */
  buildings?: TownBuilding[];
  /** Every plot in town, built on or not. */
  lots?: TownLot[];
  /** Junctions with traffic lights. */
  lights?: Point[];
  /** What grows round the town. */
  scenery?: { farmland: boolean; hills: boolean };
  /** District names and where to write them on the ground. */
  districts?: { id: DistrictId; name: string; x: number; y: number }[];
  /**
   * Trip distance per world pixel. A town is drawn big enough for its tiles, and
   * this keeps fares and times at the prototype's scale. Defaults to 1.
   */
  lengthScale?: number;
}

/** The three parts of a town. */
export type DistrictId = "rich" | "mixed" | "poor";

/**
 * The isometric grid a town is laid out on. Cell (u, v) has its centre at
 * x = ox + (u - v) * hw, y = oy + (u + v) * hh. Every cell is exactly one thing:
 * a road, water, a bridge, a building lot, or open ground. A building only ever
 * stands on a lot, so a road passes in front of it or behind it, never under it.
 */
export interface TownGrid {
  hw: number;
  hh: number;
  ox: number;
  oy: number;
  /** Lowest u and v in the grid (outskirts roads can run below zero). */
  u0: number;
  v0: number;
  cols: number;
  rows: number;
  /**
   * One character per cell, row by row (v, then u): "r" road, "b" bridge,
   * "w" water, "R" "M" "P" a lot in the rich, mixed or poor district,
   * "o" a lot out of town, "." open ground.
   */
  cells: string;
}

/** Which way a lot's street is: +u (down right on screen), +v (down left), -u (up left), -v (up right). */
export type Facing = 0 | 1 | 2 | 3;

/**
 * One plot of land. Every building, place or ordinary house, stands on its own
 * lot with its own yard, a wall or fence to suit the district, and a gate and path
 * out to the street it faces.
 */
export interface TownLot {
  x: number;
  y: number;
  district: DistrictId | "out";
  /** The side the main street is on, where the building faces. */
  face: Facing;
  /** Every side with a street: a corner plot has a gate on each. */
  gates: Facing[];
  /** What stands on it. A garden is an empty plot with trees. */
  use: "place" | "building" | "garden";
}

/** A building that is just part of the town, not a place you can visit. */
export interface TownBuilding {
  x: number;
  y: number;
  /** Mirror the tile so its front faces the street. */
  flip?: boolean;
  /** Tile file, when there is one. */
  art?: string;
  /** Drawn in code when there is no art: house, flats, compound, duplex. */
  kind: string;
}

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
