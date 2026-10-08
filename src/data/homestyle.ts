// How a player has styled their home: the paint on the walls, the floor, the sofa and the accent colour for
// curtains, the rug and cushions. Free to change, saved with the game. Until a player styles it, a home
// looks the way their class would have it.
import type { ClassId } from "./jobs";
import { HOUSE } from "./shops";

export const WALLS = [
  { id: "cream", label: "Cream", colour: "#F2EBDD" },
  { id: "sky", label: "Sky blue", colour: "#DCE6EA" },
  { id: "mint", label: "Mint", colour: "#D7E3D0" },
  { id: "peach", label: "Peach", colour: "#F2D9C8" },
  { id: "lilac", label: "Lilac", colour: "#E3DAEA" },
  { id: "sun", label: "Sunflower", colour: "#F3E3A8" },
  { id: "grey", label: "Dove grey", colour: "#D9D6D0" },
  { id: "plain", label: "Unpainted", colour: "#B9B1A4" },
] as const;

export const FLOORS = [
  { id: "terrazzo", label: "Terrazzo", tiles: ["#D9D2C5", "#EDE7DA"] },
  { id: "wood", label: "Wood", tiles: ["#9C6B43", "#8A5D3B"] },
  { id: "white", label: "White tiles", tiles: ["#F4F1EA", "#E2DED6"] },
  { id: "slate", label: "Slate", tiles: ["#5E6B73", "#6E7B83"] },
  { id: "terracotta", label: "Terracotta", tiles: ["#B5532E", "#A5482A"] },
  { id: "cement", label: "Cement", tiles: ["#8F877C", "#878075"] },
] as const;

export const SOFAS = [
  { id: "navy", label: "Navy", colour: "#26355E" },
  { id: "maroon", label: "Maroon", colour: "#7B2232" },
  { id: "emerald", label: "Emerald", colour: "#1F6B4A" },
  { id: "mustard", label: "Mustard", colour: "#C9A227" },
  { id: "grey", label: "Grey", colour: "#6E7178" },
  { id: "cream", label: "Cream", colour: "#E8DCC4" },
] as const;

export const ACCENTS = [
  { id: "wine", label: "Wine", colour: "#8C2F5A" },
  { id: "orange", label: "Ankara orange", colour: "#E67E22" },
  { id: "teal", label: "Teal", colour: "#1F7A8C" },
  { id: "gold", label: "Gold", colour: "#C9A227" },
  { id: "green", label: "Green", colour: "#2E7D4F" },
  { id: "red", label: "Red", colour: "#C0392B" },
] as const;

export interface HomeStyle {
  wall: string;
  floor: string;
  sofa: string;
  accent: string;
}

/** How a home looks before its owner styles it. */
export const defaultStyle = (cls: ClassId | undefined): HomeStyle =>
  cls === "rich"
    ? { wall: "cream", floor: "white", sofa: "cream", accent: "gold" }
    : cls === "middle"
      ? { wall: "sky", floor: "terrazzo", sofa: "navy", accent: "orange" }
      : { wall: "plain", floor: "cement", sofa: "maroon", accent: "wine" };

const ids = (list: readonly { id: string }[]) => new Set(list.map((x) => x.id));
const VALID = { wall: ids(WALLS), floor: ids(FLOORS), sofa: ids(SOFAS), accent: ids(ACCENTS) };

/** A style the game can show: every choice is one of the options above. */
export const isHomeStyle = (s: unknown): s is HomeStyle =>
  typeof s === "object" && s !== null && (Object.keys(VALID) as (keyof HomeStyle)[]).every((k) => typeof (s as HomeStyle)[k] === "string" && VALID[k].has((s as HomeStyle)[k]));

/** The colours for a style. */
export function styleColours(s: HomeStyle) {
  return {
    wall: WALLS.find((w) => w.id === s.wall)!.colour,
    floor: FLOORS.find((f) => f.id === s.floor)!.tiles,
    sofa: SOFAS.find((x) => x.id === s.sofa)!.colour,
    accent: ACCENTS.find((x) => x.id === s.accent)!.colour,
  };
}

/** How grand the home is furnished: your class, lifted by a house you have bought (a duplex or a mansion furnishes like the rich). */
export function homeClass(g: { citizen: { cls: ClassId } | null; house?: string | null }): ClassId {
  const cls = g.citizen?.cls ?? "poor";
  const tier = g.house ? (HOUSE[g.house]?.tier ?? 0) : 0;
  if (tier >= 3) return "rich";
  if (tier >= 1 && cls === "poor") return "middle";
  return cls;
}
