// Higgsfield art used on the map. Files are produced by scripts/fetch_assets.py.
import type { Gender } from "../data/character";
import type { ModeId } from "../sim/travel";

const A = "/assets/";

/** Building tile per place. The Post Office junction's art is named postoffice. */
export const TILE_ART: Record<string, string> = {
  po: A + "postoffice.webp",
  palace: A + "palace.webp",
  adabata: A + "adabata.webp",
  taiwo: A + "taiwo.webp",
  stadium: A + "stadium.webp",
  sawmill: A + "sawmill.webp",
  adewole: A + "adewole.webp",
  airport: A + "airport.webp",
  metro: A + "metro.webp",
  irewolede: A + "irewolede.webp",
  secretariat: A + "secretariat.webp",
  hotel: A + "hotel.webp",
  hub: A + "hub.webp",
  govhouse: A + "govhouse.webp",
  flower: A + "flower.webp",
  amala: A + "amala.webp",
  mall: A + "mall.webp",
  froyo: A + "froyo.webp",
  home: A + "home.webp",
  item7: A + "item7.webp",
  okeodo: A + "okeodo.webp",
  unilorin: A + "unilorin.webp",
  evergreen: A + "evergreen.webp",
  poly: A + "poly.webp",
  shao: A + "shao.webp",
  farm: A + "farm.webp",
  kwasu: A + "kwasu.webp",
};

export const AVATAR_ART: Record<Gender, string> = {
  m: A + "avatar-man-kaftan.webp",
  f: A + "avatar-woman-gele.webp",
  h: A + "avatar-woman-hijab.webp",
};

export const VEHICLE_ART: Record<Exclude<ModeId, "walk">, string> = {
  keke: A + "sprite-keke.webp",
  okada: A + "sprite-okada.webp",
  bus: A + "sprite-bus.webp",
  horse: A + "sprite-horse.webp",
};

export const BILLBOARD_ART = A + "billboard.webp";

/** Billboard face corners in billboard.webp pixels (440 x 431): TL, TR, BR, BL. */
export const BILLBOARD_FACE: [number, number][] = [
  [111, 65],
  [338, 15],
  [337, 135],
  [111, 188],
];

/** World-pixel sizes. Tiles are drawn this wide; their bottom edge sits this far below the place point. */
export const TILE_W = 210;
export const TILE_BASE = 40;
export const BILLBOARD_W = 130;
export const AVATAR_H = 84;
export const VEHICLE_W: Record<Exclude<ModeId, "walk">, number> = { keke: 74, okada: 66, bus: 96, horse: 84 };
export const TRAFFIC_W: Record<"keke" | "okada" | "bus", number> = { keke: 40, okada: 34, bus: 54 };

export const ALL_ART = [
  ...Object.values(TILE_ART),
  ...Object.values(AVATAR_ART),
  ...Object.values(VEHICLE_ART),
  BILLBOARD_ART,
];
