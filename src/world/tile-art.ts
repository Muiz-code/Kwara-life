// Which Higgsfield tile draws which building, by kind and zone look.
//
// Files live in public/assets/tiles. A kind with no file here, or a file that
// fails to load, falls back to the tile drawn in code (tiles.ts), so a missing
// picture never leaves a hole in the town.
import { baseOf, type BiomeId } from "../data/biomes";

const T = "/assets/tiles/";

/** Tiles drawn once per zone look: <name>-<look>.webp */
const PER_LOOK = ["duplex", "flats", "compound", "market", "buka", "mosque", "church", "motorpark", "workshop", "house"] as const;
export type LookTile = (typeof PER_LOOK)[number];

/** Tiles shared by every zone: <name>.webp */
const SHARED = ["inec", "school", "viewingcentre", "newsstand", "townhall", "noticeboard", "office", "hq", "hotel", "flyover", "shelter"] as const;
export type SharedTile = (typeof SHARED)[number];

/** State codes that have a landmark tile: lm-<state>.webp */
const LANDMARK_STATES = new Set([
  "abia", "adamawa", "akwa-ibom", "anambra", "bauchi", "bayelsa", "benue", "borno", "cross-river", "delta", "ebonyi",
  "edo", "ekiti", "enugu", "fct", "gombe", "imo", "jigawa", "kaduna", "kano", "katsina", "kebbi", "kogi", "kwara",
  "lagos", "nasarawa", "niger", "ogun", "ondo", "osun", "oyo", "plateau", "rivers", "sokoto", "taraba", "yobe", "zamfara",
]);

export const lookTile = (name: LookTile, look: BiomeId) => `${T}${name}-${baseOf(look)}.webp`;
export const sharedTile = (name: SharedTile) => `${T}${name}.webp`;
export const landmarkTile = (state: string) => (LANDMARK_STATES.has(state) ? `${T}lm-${state}.webp` : null);

/** The game's place kinds, mapped to a tile. Null means draw it in code. */
const KIND_TILE: Record<string, { look?: LookTile; shared?: SharedTile }> = {
  market: { look: "market" },
  "lm-market": { look: "market" },
  buka: { look: "buka" },
  mosque: { look: "mosque" },
  church: { look: "church" },
  garage: { look: "motorpark" },
  workshop: { look: "workshop" },
  inec: { shared: "inec" },
  school: { shared: "school" },
  viewing: { shared: "viewingcentre" },
  kiosk: { shared: "newsstand" },
  townhall: { shared: "townhall" },
  board: { shared: "noticeboard" },
  office: { shared: "office" },
  tower: { shared: "hq" },
  hotel: { shared: "hotel" },
  flyover: { shared: "flyover" },
  shelter: { shared: "shelter" },
};

/** Homes look like their owner's class. */
export const HOME_TILE: Record<"rich" | "middle" | "poor", LookTile> = { rich: "duplex", middle: "flats", poor: "compound" };

export interface ArtQuery {
  kind: string;
  look: BiomeId;
  state: string;
  /** For a home: the owner's class. */
  cls?: "rich" | "middle" | "poor";
}

/** The tile file for a place, or null to draw it in code. */
export function tileFor(q: ArtQuery): string | null {
  if (q.kind.startsWith("lm-")) return landmarkTile(q.state);
  if (q.kind === "house") return lookTile(q.cls ? HOME_TILE[q.cls] : "house", q.look);
  const t = KIND_TILE[q.kind];
  if (!t) return null;
  return t.look ? lookTile(t.look, q.look) : sharedTile(t.shared!);
}

/** Every tile file the table can hand out, for preloading and for the test that checks they exist. */
export function allTiles(): string[] {
  const looks: BiomeId[] = ["sahel", "savanna", "forest", "hills", "delta"];
  return [
    ...PER_LOOK.flatMap((n) => looks.map((l) => lookTile(n, l))),
    ...SHARED.map(sharedTile),
    ...[...LANDMARK_STATES].map((s) => `${T}lm-${s}.webp`),
  ];
}
