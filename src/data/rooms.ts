// Which room a place has inside, by its kind (and a few places by name). Pure, so the store can use it
// without pulling in the 3D code.

export type Room =
  | "home" | "church" | "mosque" | "club" | "lounge" | "buka" | "office" | "classroom" | "inec" | "viewing" | "hotel" | "hall" | "shop"
  | "airport" | "station" | "stadium" | "bank" | "techhub" | "showroom" | "boutique" | "supermarket" | "takeaway" | "cafe"
  | "gallery";

/** The room for a place, by its kind (and a few places by name). */
export function roomFor(kind: string, id: string): Room {
  if (id === "home" || kind === "house" || kind === "estate" || kind === "oldtown" || kind === "flyover") return "home";
  if (id === "cardealer") return "showroom";
  // Item 7 is a pick-up spot: buy, pack it, take it home. Frozencup is a sit-down dessert café.
  if (id === "item7") return "takeaway";
  if (id === "froyo") return "cafe";
  if (id === "boutique") return "boutique";
  if (id === "supermarket" || kind === "mall") return "supermarket";
  if (kind === "airport") return "airport";
  if (kind === "trainstation" || kind === "busterminal" || kind === "garage") return "station";
  if (kind === "stadium") return "stadium";
  if (kind === "bank") return "bank";
  if (kind === "techhub" || kind === "hub") return "techhub";
  if (kind === "church") return "church";
  if (kind === "mosque" || id === "palace") return "mosque";
  if (kind === "club") return "club";
  if (kind === "lounge") return "lounge";
  if (kind === "buka") return "buka";
  if (kind === "inec") return "inec";
  if (kind === "viewing") return "viewing";
  if (kind === "hotel") return "hotel";
  if (kind === "townhall" || kind === "govhouse") return "hall";
  if (kind === "school" || kind === "campus" || kind === "poly" || kind === "kwasu") return "classroom";
  if (kind === "office" || kind === "tower" || kind === "hub" || kind === "workshop") return "office";
  // A state's landmark has a visitor centre: a gallery with art on the walls.
  if (kind.startsWith("lm-")) return "gallery";
  return "shop";
}
