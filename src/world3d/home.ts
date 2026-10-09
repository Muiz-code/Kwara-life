// Your home, inside: a proper flat, arranged the way Nigerian homes are. The sitting room is set round the
// TV (sofa, armchairs, centre table, rug), the dining table stands by the kitchen, and the bedroom and the
// bathroom are walled off at the back either side of the front door. What is there depends on your class
// and on what you have bought; how it looks (paint, floor, sofa, accents) is yours to style.
// Things you can use are spots: tap one and you walk over and use it.
import { defaultStyle, styleColours, type HomeStyle } from "../data/homestyle";
import type { ClassId } from "../data/jobs";
import type { Kit } from "./kit";

/** How the player uses a thing: lying on it, sitting at it, or working at it, at a place and facing. */
export interface Use {
  pose: "lie" | "sit" | "work" | "talk";
  x: number;
  y: number;
  z: number;
  turn: number;
}

export interface Spot {
  /**
   * The home actions this thing offers (sleep and nap for a bed, cook for a stove...). Seats also carry a
   * marker: "@dine" for a dining chair, "@eat" for a seat where you eat what you bought.
   */
  actions: string[];
  /** Halfway through, get up and go to a seat with this marker (cook at the stove, then eat at the table). */
  after?: string;
  use: Use;
  /** What it is, for the hint. */
  label: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** Where you stand to use it. */
  stand: [number, number];
}

export interface Own {
  furniture: string[];
  tv: boolean;
  radio: boolean;
  cls: string;
  /** How the player has styled the place; unstyled, it looks the way their class would have it. */
  style?: HomeStyle | null;
  /** The place serves food you sit down to eat: make sure it has somewhere to sit. */
  dine?: boolean;
}

/** The home's colours: the paint, the floor tiles, the sofa and the accents. */
export const homeLook = (own: Own) => styleColours(own.style ?? defaultStyle(own.cls as ClassId));

const H = 3.4;
const BACK = -5;
const WOOD = "#6B4A2E";
const DARK = "#3A2A1E";

// ---- Furniture, built in its own frame: front towards +z, centred on (0, 0), then turned into place ----

/** Build something at (x, z) turned by `turn` (its front, +z, ends up facing that way). */
function placed(kit: Kit, x: number, z: number, turn: number, draw: () => void) {
  kit.frame.makeRotationY(turn).setPosition(x, 0, z);
  draw();
  kit.frame.identity();
}

/** Four legs under a w by d top at height h, tapering a little. */
function legs(kit: Kit, w: number, d: number, h: number, col: string, r = 0.035, inset = 0.08) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.cyl(r * 0.75, r, h, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), col, 8);
}

/** A cushion: a soft block with its top edge eased (a slightly smaller layer on top). */
function cushion(kit: Kit, w: number, h: number, d: number, x: number, y: number, z: number, col: string, ry = 0) {
  kit.box(w, h * 0.72, d, x, y, z, col, ry);
  kit.box(w - 0.06, h * 0.28, d - 0.06, x, y + h * 0.72, z, col, ry);
}

/** A sofa (seats > 1) or armchair: legs, a base, seat and back cushions, rolled arms, throw pillows. */
function sofa(kit: Kit, seats: number, col: string, accent: string, rich: boolean) {
  const sw = 0.72;
  const W = seats * sw + 0.42;
  const D = 0.9;
  const leg = rich ? "#C9A227" : DARK;
  legs(kit, W, D, 0.12, leg, 0.03, 0.12);
  kit.box(W, 0.24, D, 0, 0.12, 0, col);
  for (let i = 0; i < seats; i++) {
    const x = -((seats - 1) * sw) / 2 + i * sw;
    cushion(kit, sw - 0.03, 0.17, D - 0.26, x, 0.36, 0.1, col);
    cushion(kit, sw - 0.05, 0.46, 0.17, x, 0.5, -0.24, col, 0);
  }
  kit.box(W - 0.36, 0.56, 0.2, 0, 0.36, -D / 2 + 0.1, col);
  for (const s of [-1, 1]) {
    // A rolled arm: an upright with a round top running front to back.
    kit.box(0.18, 0.3, D, s * (W / 2 - 0.09), 0.36, 0, col);
    kit.cyl(0.11, 0.11, D, s * (W / 2 - 0.09), 0.66 - D / 2, 0, col, 12, Math.PI / 2);
  }
  // Throw pillows in the corners.
  for (const s of seats > 1 ? [-1, 1] : [0]) cushion(kit, 0.36, 0.34, 0.12, s * (W / 2 - 0.42), 0.53, -0.12, accent, s * 0.25);
}

/** A white plastic chair: four splayed legs, a seat, a slatted back. Every compound has a stack of them. */
function plasticChair(kit: Kit, col: string) {
  legs(kit, 0.46, 0.46, 0.42, col, 0.025, 0.03);
  kit.box(0.48, 0.04, 0.46, 0, 0.42, 0, col);
  for (const s of [-1, 1]) kit.box(0.04, 0.42, 0.04, s * 0.21, 0.46, -0.21, col);
  for (let i = 0; i < 3; i++) kit.box(0.42, 0.06, 0.03, 0, 0.6 + i * 0.1, -0.22, col);
  for (const s of [-1, 1]) kit.box(0.04, 0.03, 0.42, s * 0.23, 0.62, -0.01, col);
}

/** A table: a top with an eased edge on legs, an optional shelf below. */
function table(kit: Kit, w: number, d: number, h: number, top: string, leg: string, shelf = false) {
  kit.box(w, 0.04, d, 0, h - 0.06, 0, top);
  kit.box(w - 0.04, 0.03, d - 0.04, 0, h - 0.03, 0, top);
  legs(kit, w, d, h - 0.06, leg, 0.03, 0.06);
  if (shelf) kit.box(w - 0.12, 0.03, d - 0.12, 0, 0.16, 0, top);
}

/** A round side table on a pedestal. */
function sideTable(kit: Kit, col: string) {
  kit.cyl(0.24, 0.24, 0.04, 0, 0.52, 0, col, 16);
  kit.cyl(0.04, 0.05, 0.5, 0, 0.02, 0, col, 8);
  kit.cyl(0.16, 0.18, 0.03, 0, 0, 0, col, 12);
}

/** A table lamp: base, stem, shade. */
function lamp(kit: Kit, y: number) {
  kit.cyl(0.07, 0.09, 0.05, 0, y, 0, "#2B2F36", 10);
  kit.cyl(0.015, 0.015, 0.28, 0, y + 0.05, 0, "#C9A227", 6);
  kit.cyl(0.11, 0.18, 0.22, 0, y + 0.3, 0, "#F4EFE4", 14);
}

/** A cabinet run: base units with doors and handles under a worktop. */
function counter(kit: Kit, len: number, body: string, top: string, h = 0.9) {
  kit.box(0.62, 0.08, len, 0.02, 0, 0, DARK);
  kit.box(0.6, h - 0.12, len, 0, 0.08, 0, body);
  kit.box(0.66, 0.05, len + 0.04, 0.03, h - 0.04, 0, top);
  const doors = Math.max(1, Math.round(len / 0.6));
  for (let i = 0; i < doors; i++) {
    const z = -len / 2 + (len / doors) * (i + 0.5);
    kit.box(0.02, h - 0.24, len / doors - 0.04, 0.31, 0.14, z, body);
    kit.box(0.03, 0.12, 0.02, 0.33, h - 0.32, z + len / doors / 2 - 0.08, "#9AA3AD");
  }
}

/** A gas cylinder: the green or blue bottle with its valve. */
function gasBottle(kit: Kit, x: number, z: number, col = "#2E7D4F") {
  kit.cyl(0.16, 0.16, 0.42, x, 0.04, z, col, 14);
  kit.ball(0.16, x, 0.46, z, col, 0.5, 1);
  kit.cyl(0.04, 0.04, 0.1, x, 0.5, z, "#9AA3AD", 8);
  kit.cyl(0.13, 0.15, 0.05, x, 0, z, "#2B2F36", 12);
}

/** Burners on a hob: a ring and a grate. */
function burner(kit: Kit, x: number, y: number, z: number, r = 0.07) {
  kit.cyl(r, r, 0.02, x, y, z, "#2B2F36", 12);
  kit.cyl(r * 0.5, r * 0.5, 0.025, x, y + 0.01, z, "#6E757C", 10);
  for (const a of [0, Math.PI / 2]) kit.box(0.02, 0.02, r * 2.4, x, y + 0.03, z, "#1B1D21", a);
}

/** What each class already has when the game starts: the rich move into a furnished house. */
const STARTING: Record<string, string[]> = {
  poor: [],
  middle: ["bed", "table", "fan", "curtains", "sofa"],
  rich: ["bed", "wardrobe", "table", "sofa", "rug", "fan", "cabinet", "cooker", "fridge", "curtains"],
};

/** Build the flat into the kit; returns the things you can use. The outer walls and floor are drawn by the caller. */
/** A seat you can tap and sit on for these actions; you walk to stand first. */
function sitSpot(label: string, actions: string[], x: number, z: number, turn: number, stand: [number, number]): Spot {
  return { actions, use: { pose: "sit", x, y: 0, z, turn }, label, x, z, w: 0.6, d: 0.6, h: 0.9, stand };
}

/** A dining chair: eat a take-away there, sit down to eat after cooking, or scroll your phone. */
const diningSeat = (x: number, z: number, turn: number) =>
  sitSpot("Dining table", ["eat-takeaway", "phone", "@dine"], x, z, turn, [x, turn ? z + 0.7 : z - 0.7]);

export function homeRoom(kit: Kit, own: Own): Spot[] {
  const owned = new Set([...own.furniture, ...(STARTING[own.cls] ?? [])]);
  const has = (f: string) => owned.has(f);
  const rich = own.cls === "rich";
  const look = homeLook(own);
  const spots: Spot[] = [];

  // ---- Inner walls: the bedroom (back left, x -6..-1) and the bathroom (back right, x 3.5..6) ----
  kit.box(0.16, H, 3.8, -1.0, 0, BACK + 1.9, look.wall); // bedroom side wall, doorway at its front end
  kit.box(0.16, 0.6, 1.2, -1.0, H - 0.6, -0.6, look.wall);
  kit.box(5.0, H, 0.16, -3.5, 0, 0, look.wall); // bedroom front wall
  kit.box(5.0, 0.12, 0.06, -3.5, 0, 0.1, DARK);
  kit.box(0.16, H, 1.6, 3.5, 0, -4.2, look.wall); // bathroom side wall, doorway in the middle
  kit.box(0.16, H, 0.5, 3.5, 0, -2.25, look.wall);
  kit.box(0.16, 0.6, 0.9, 3.5, H - 0.6, -2.95, look.wall);
  kit.box(2.6, H, 0.16, 4.75, 0, -2.0, look.wall); // bathroom front wall, behind the TV

  // ---- Front door, windows, clock and pictures ----
  kit.box(1.0, 2.2, 0.08, 1.2, 0, BACK + 0.05, "#5A3A22");
  kit.box(0.06, 0.06, 0.06, 1.55, 1.05, BACK + 0.11, "#D4AF37");
  for (const [x, w] of [[-3.5, 1.8], [2.65, 0.8]] as const) {
    kit.box(w, 1.2, 0.06, x, 1.3, BACK + 0.03, "#9ED0E6");
    for (let i = 0; i <= Math.round(w / 0.3); i++) kit.box(0.04, 1.2, 0.06, x - w / 2 + i * 0.3, 1.3, BACK + 0.1, "#2B2F36");
    if (has("curtains")) for (const s of [-1, 1]) kit.box(0.45, 1.7, 0.06, x + s * (w / 2 + 0.1), 1.0, BACK + 0.18, look.accent);
  }
  kit.cyl(0.22, 0.22, 0.05, -0.3, 2.7, BACK + 0.04, "#F4F1EA", 16, Math.PI / 2);
  kit.box(0.02, 0.15, 0.02, -0.3, 2.7, BACK + 0.08, "#111");
  // On the sitting-room side of the bedroom wall: the family photo, a calendar, art in a rich home.
  kit.box(0.8, 0.6, 0.04, -3.5, 1.8, 0.1, WOOD);
  kit.box(0.66, 0.48, 0.045, -3.5, 1.86, 0.11, "#9C7A55");
  kit.box(0.5, 0.7, 0.04, -1.4, 1.5, 0.1, "#F4F1EA");
  kit.box(0.5, 0.2, 0.045, -1.4, 2.0, 0.11, "#118A4F");
  if (rich)
    for (const [x, col] of [[-4.8, "#C0392B"], [-2.2, "#2B5C9A"]] as const) {
      kit.box(1.0, 0.9, 0.06, x, 1.7, 0.1, "#C9A227");
      kit.box(0.84, 0.74, 0.07, x, 1.78, 0.11, col);
    }
  // A bulb in each room; a chandelier over the sitting room for the rich.
  for (const [x, z] of [[-3.5, -2.5], [4.75, -3.5], [-3.6, 2.8], [1.2, -2.5]] as const) {
    kit.box(0.02, 0.6, 0.02, x, H - 0.6, z, "#222");
    kit.ball(0.11, x, H - 0.72, z, "#FFF3C4", 1);
  }
  if (rich) {
    kit.box(0.04, 0.8, 0.04, 4.0, H - 0.8, 1.6, "#C9A227");
    kit.cyl(0.6, 0.2, 0.3, 4.0, H - 1.1, 1.6, "#C9A227", 12);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      kit.ball(0.12, 4.0 + Math.cos(a) * 0.55, H - 1.0, 1.6 + Math.sin(a) * 0.55, "#FFF3C4", 1);
    }
  } else {
    kit.box(0.02, 0.6, 0.02, 4.0, H - 0.6, 1.6, "#222");
    kit.ball(0.11, 4.0, H - 0.72, 1.6, "#FFF3C4", 1);
  }

  // ---- Bedroom ----
  if (has("bed")) {
    // A bed on legs: frame, mattress with eased edges, a padded headboard, pillows, a folded cover.
    placed(kit, -3.5, BACK + 1.35, 0, () => {
      legs(kit, 2.1, 2.5, 0.22, WOOD, 0.05, 0.1);
      kit.box(2.1, 0.2, 2.5, 0, 0.2, 0, WOOD);
      cushion(kit, 1.96, 0.3, 2.36, 0, 0.4, 0.02, "#F4F1EA");
      kit.box(2.2, 1.25, 0.1, 0, 0, -1.22, WOOD);
      for (const x of [-0.55, 0, 0.55]) cushion(kit, 0.5, 0.55, 0.08, x, 0.55, -1.13, rich ? look.accent : "#8C6A4A");
      for (const x of [-0.48, 0.48]) {
        cushion(kit, 0.7, 0.14, 0.38, x, 0.7, -0.88, "#FFFFFF");
      }
      cushion(kit, 2.0, 0.08, 1.2, 0, 0.7, 0.45, look.accent);
      kit.box(2.02, 0.32, 0.04, 0, 0.42, 1.2, look.accent);
    });
    for (const x of [-4.95, -2.05])
      placed(kit, x, BACK + 0.4, 0, () => {
        table(kit, 0.48, 0.42, 0.55, WOOD, DARK);
        kit.box(0.42, 0.22, 0.02, 0, 0.26, 0.21, WOOD);
        kit.box(0.08, 0.02, 0.02, 0, 0.37, 0.225, "#C9A227");
        lamp(kit, 0.55);
      });
    spots.push({ actions: ["sleep", "nap"], use: { pose: "lie", x: -3.5, y: 0.76, z: BACK + 1.6, turn: 0 }, label: "Bed", x: -3.5, z: BACK + 1.35, w: 2.1, d: 2.5, h: 1.0, stand: [-2.1, BACK + 2.95] });
  } else {
    kit.box(1.9, 0.2, 2.3, -3.5, 0, BACK + 1.4, "#E8E0CC");
    kit.box(1.8, 0.04, 1.2, -3.5, 0.2, BACK + 1.9, "#3F6B3A");
    kit.box(0.6, 0.12, 0.35, -3.9, 0.2, BACK + 0.5, "#FFFFFF");
    spots.push({ actions: ["sleep", "nap"], use: { pose: "lie", x: -3.5, y: 0.22, z: BACK + 1.6, turn: 0 }, label: "Mattress", x: -3.5, z: BACK + 1.4, w: 1.9, d: 2.3, h: 0.5, stand: [-2.1, BACK + 2.95] });
  }
  if (has("wardrobe")) {
    // A wardrobe: plinth, two panelled doors with handles, a cornice on top.
    placed(kit, -5.6, -1.4, Math.PI / 2, () => {
      kit.box(1.8, 0.1, 0.62, 0, 0, 0, DARK);
      kit.box(1.8, 2.1, 0.6, 0, 0.1, 0, "#7A5C3E");
      kit.box(1.88, 0.08, 0.66, 0, 2.2, 0, DARK);
      for (const s of [-1, 1]) {
        kit.box(0.84, 1.9, 0.02, s * 0.45, 0.2, 0.3, "#8A6A4A");
        kit.box(0.02, 0.22, 0.03, s * 0.06, 1.1, 0.32, "#C9A227");
      }
    });
  } else {
    // A clothes line and a Ghana-must-go bag.
    kit.box(0.03, 0.03, 1.8, -5.8, 1.9, -1.4, "#DDD");
    for (let i = 0; i < 3; i++) kit.box(0.06, 0.65, 0.45, -5.8, 1.25, -2.0 + i * 0.6, ["#2F7D7A", "#C0392B", "#F2B705"][i]);
    kit.box(0.7, 0.45, 0.4, -5.5, 0, -0.5, "#C0392B");
  }
  // Dressing table on legs, a drawer, an oval mirror and a stool.
  placed(kit, -1.33, -3.2, -Math.PI / 2, () => {
    table(kit, 1.0, 0.45, 0.75, WOOD, DARK);
    kit.box(0.9, 0.14, 0.4, 0, 0.55, 0, WOOD);
    kit.box(0.1, 0.02, 0.02, 0, 0.62, 0.21, "#C9A227");
    kit.cyl(0.32, 0.32, 0.03, 0, 1.18, -0.2, WOOD, 20, Math.PI / 2);
    kit.cyl(0.28, 0.28, 0.035, 0, 1.18, -0.19, "#B9D6E0", 20, Math.PI / 2);
    for (const x of [-0.25, 0.1, 0.3]) kit.cyl(0.03, 0.035, 0.12 + (x + 0.3) * 0.1, x, 0.75, -0.1, ["#C0392B", "#F2B705", "#8C2F5A"][Math.round((x + 0.25) * 4) % 3], 8);
  });
  placed(kit, -1.85, -3.2, -Math.PI / 2, () => {
    kit.cyl(0.18, 0.18, 0.08, 0, 0.38, 0, look.accent, 14);
    kit.cyl(0.03, 0.05, 0.38, 0, 0, 0, DARK, 8);
  });

  // ---- Bathroom ----
  kit.box(0.5, 0.42, 0.65, 5.5, 0, BACK + 0.6, "#F4F1EA"); // WC
  kit.box(0.45, 0.5, 0.2, 5.5, 0.42, BACK + 0.2, "#F4F1EA");
  kit.box(0.6, 0.15, 0.45, 4.1, 0.85, BACK + 0.3, "#F4F1EA"); // basin and mirror
  kit.box(0.12, 0.85, 0.12, 4.1, 0, BACK + 0.3, "#E8E8E8");
  kit.box(0.5, 0.6, 0.04, 4.1, 1.4, BACK + 0.05, "#B9D6E0");
  kit.box(1.2, 0.08, 1.2, 5.2, 0, -2.9, "#C9CED3"); // shower tray and head
  kit.box(0.04, 2.1, 0.04, 5.75, 0, -2.4, "#9AA3AD");
  kit.cyl(0.1, 0.06, 0.05, 5.6, 2.05, -2.4, "#9AA3AD", 10);
  kit.cyl(0.24, 0.18, 0.4, 4.0, 0, -3.9, "#2B7FB8", 12); // the bucket, for when the tap no run
  spots.push({ actions: ["bath"], use: { pose: "work", x: 5.2, y: 0, z: -2.9, turn: Math.PI }, label: "Shower", x: 5.2, z: -2.9, w: 1.2, d: 1.2, h: 0.6, stand: [4.2, -2.95] });

  // ---- Kitchen (front left) ----
  // The kitchen runs along the left wall, facing into the room (+x).
  const fitted = has("cabinet") || rich;
  if (fitted) {
    // Fitted units: base cabinets under a stone worktop, a sink with its tap, wall cupboards above.
    placed(kit, -5.65, 2.8, 0, () => {
      counter(kit, 2.4, "#F4F1EA", "#5E6B73");
      kit.box(0.42, 0.04, 0.55, 0.05, 0.88, 0.4, "#9AA3AD");
      kit.box(0.36, 0.1, 0.48, 0.05, 0.8, 0.4, "#6E757C");
      kit.cyl(0.02, 0.02, 0.28, -0.2, 0.9, 0.4, "#C9CED3", 8);
      kit.box(0.16, 0.02, 0.02, -0.12, 1.17, 0.4, "#C9CED3");
      kit.box(0.4, 0.7, 2.4, -0.1, 1.55, 0, "#F4F1EA");
      for (let i = 0; i < 4; i++) kit.box(0.02, 0.12, 0.02, 0.11, 1.62, -0.9 + i * 0.6, DARK);
      kit.cyl(0.11, 0.1, 0.22, 0.1, 0.92, -0.7, "#C0392B", 12); // a pot of stew waiting
    });
  } else if (own.cls === "middle") {
    // A wooden counter with a curtain under it, basins and pots on top.
    placed(kit, -5.6, 2.8, 0, () => {
      kit.box(0.6, 0.06, 2.0, 0, 0.84, 0, WOOD);
      legs(kit, 0.6, 2.0, 0.84, DARK, 0.03, 0.05);
      kit.box(0.02, 0.7, 1.9, 0.29, 0.1, 0, look.accent);
      kit.cyl(0.22, 0.16, 0.12, 0, 0.9, 0.5, "#9AA3AD", 14);
      kit.cyl(0.12, 0.11, 0.2, 0, 0.9, -0.4, "#2B2F36", 12);
    });
    kit.cyl(0.32, 0.32, 0.8, -5.5, 0, 4.0, "#2B5C9A", 14);
  } else {
    // A mat on the floor, pots, a mortar and pestle, and the water drum.
    kit.box(1.0, 0.02, 0.8, -5.2, 0, 3.0, "#C9A227");
    kit.cyl(0.2, 0.17, 0.2, -5.3, 0.02, 2.9, "#2B2F36", 12);
    kit.cyl(0.18, 0.13, 0.42, -4.9, 0, 3.4, "#7A5C3E", 12);
    kit.cyl(0.03, 0.04, 0.7, -4.9, 0.3, 3.4, "#9C7A55", 6, 0.3);
    kit.cyl(0.32, 0.32, 0.8, -5.5, 0, 2.0, "#2B5C9A", 14);
    kit.cyl(0.33, 0.33, 0.04, -5.5, 0.8, 2.0, "#1F4A7A", 14);
  }
  // The cooker, by class: the big gas cooker with its oven in a rich home (or once you buy one), a two-burner
  // table-top on a stand for the middle class, a kerosene stove on a stool for the poor.
  const cooker = rich || (has("cooker") && own.cls !== "poor") ? "big" : own.cls === "middle" || has("cooker") ? "top" : "kero";
  if (cooker === "big") {
    placed(kit, -5.6, 1.0, Math.PI / 2, () => {
      kit.box(0.62, 0.86, 0.62, 0, 0.04, 0, "#E8E8E8");
      kit.box(0.5, 0.42, 0.02, 0, 0.18, 0.31, "#2B2F36"); // the oven door's glass
      kit.box(0.54, 0.46, 0.015, 0, 0.16, 0.315, "#C9CED3");
      kit.box(0.4, 0.025, 0.04, 0, 0.66, 0.33, "#9AA3AD"); // its handle
      for (let i = 0; i < 4; i++) kit.cyl(0.025, 0.025, 0.03, -0.21 + i * 0.14, 0.76, 0.31, "#2B2F36", 8, Math.PI / 2);
      kit.box(0.62, 0.02, 0.62, 0, 0.9, 0, "#2B2F36");
      for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) burner(kit, x, 0.92, z);
      kit.box(0.62, 0.5, 0.03, 0, 0.92, -0.3, "#C9CED3"); // the lid, standing up
      kit.cyl(0.13, 0.12, 0.16, 0.15, 0.95, 0.15, "#9AA3AD", 12); // a pot on the boil
    });
    gasBottle(kit, -5.65, 0.35);
    spots.push({ actions: ["cook"], after: "@dine", use: { pose: "work", x: -4.75, y: 0, z: 1.0, turn: -Math.PI / 2 }, label: "Gas cooker", x: -5.6, z: 1.0, w: 0.7, d: 0.7, h: 1.1, stand: [-4.6, 1.1] });
  } else if (cooker === "top") {
    placed(kit, -5.55, 1.0, Math.PI / 2, () => {
      table(kit, 0.7, 0.5, 0.72, "#9AA3AD", "#5E6B73");
      kit.box(0.6, 0.08, 0.38, 0, 0.72, 0, "#2B2F36");
      for (const x of [-0.15, 0.15]) burner(kit, x, 0.8, 0, 0.08);
      for (const x of [-0.15, 0.15]) kit.cyl(0.02, 0.02, 0.03, x, 0.74, 0.2, "#C9CED3", 8, Math.PI / 2);
      kit.cyl(0.12, 0.1, 0.18, -0.15, 0.83, 0, "#9AA3AD", 12);
    });
    gasBottle(kit, -5.65, 0.4, "#2B5C9A");
    spots.push({ actions: ["cook"], after: "@dine", use: { pose: "work", x: -4.75, y: 0, z: 1.0, turn: -Math.PI / 2 }, label: "Table-top gas cooker", x: -5.55, z: 1.0, w: 0.7, d: 0.6, h: 1.0, stand: [-4.6, 1.1] });
  } else {
    // A kerosene stove: a round blue tank with its wick ring and the pot stand, on a low wooden stool.
    placed(kit, -5.5, 1.0, Math.PI / 2, () => {
      kit.box(0.5, 0.05, 0.5, 0, 0.3, 0, WOOD);
      legs(kit, 0.5, 0.5, 0.3, DARK, 0.025, 0.05);
      kit.cyl(0.19, 0.2, 0.12, 0, 0.35, 0, "#2B5C9A", 16);
      kit.cyl(0.12, 0.15, 0.1, 0, 0.47, 0, "#9AA3AD", 14);
      kit.cyl(0.13, 0.13, 0.02, 0, 0.57, 0, "#2B2F36", 14);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        kit.box(0.03, 0.08, 0.03, Math.cos(a) * 0.15, 0.57, Math.sin(a) * 0.15, "#1B1D21");
      }
      kit.cyl(0.16, 0.13, 0.2, 0, 0.62, 0, "#6E757C", 14);
      kit.box(0.04, 0.04, 0.05, 0, 0.38, 0.21, "#C9A227"); // the wick knob
    });
    kit.box(0.2, 0.3, 0.14, -5.75, 0, 0.45, "#E0A526"); // the kerosene jerrycan
    spots.push({ actions: ["cook"], after: "@dine", use: { pose: "work", x: -4.75, y: 0, z: 1.0, turn: -Math.PI / 2 }, label: "Kerosene stove", x: -5.5, z: 1.0, w: 0.6, d: 0.6, h: 1.0, stand: [-4.6, 1.1] });
  }
  if (has("fridge")) {
    kit.box(0.7, 1.8, 0.7, -5.55, 0, 4.5, "#E8E8E8");
    kit.box(0.02, 0.5, 0.04, -5.19, 1.0, 4.3, "#9AA3AD");
  } else {
    // The cooler.
    kit.box(0.6, 0.45, 0.45, -5.4, 0, 4.5, "#2B5C9A");
    kit.box(0.62, 0.08, 0.47, -5.4, 0.45, 4.5, "#F4F1EA");
  }

  // ---- Dining, between the kitchen and the sitting room ----
  if (has("table")) {
    // A dining table on legs with a runner and a fruit bowl, four chairs with padded seats round it.
    placed(kit, -2.4, 2.8, 0, () => {
      table(kit, 1.5, 0.9, 0.76, WOOD, DARK);
      kit.box(0.4, 0.01, 0.86, 0, 0.765, 0, look.accent);
      kit.cyl(0.14, 0.09, 0.07, 0, 0.77, 0, "#F4F1EA", 14);
      for (const [x, c] of [[-0.05, "#F2B705"], [0.06, "#C0392B"], [0, "#3F6B2A"]] as const) kit.ball(0.05, x, 0.86, x * 2, c, 1, 1);
    });
    for (const [x, z, t] of [[-2.8, 2.0, 0], [-2.0, 2.0, 0], [-2.8, 3.6, Math.PI], [-2.0, 3.6, Math.PI]] as const) {
      spots.push(diningSeat(x, z, t));
      placed(kit, x, z, t, () => {
        legs(kit, 0.42, 0.42, 0.42, DARK, 0.022, 0.04);
        cushion(kit, 0.42, 0.08, 0.42, 0, 0.42, 0, look.sofa);
        for (const s of [-1, 1]) kit.box(0.04, 0.5, 0.04, s * 0.19, 0.48, -0.19, DARK);
        kit.box(0.42, 0.18, 0.03, 0, 0.78, -0.19, WOOD);
      });
    }
  } else {
    // A plastic table and chair.
    placed(kit, -2.4, 2.8, 0, () => table(kit, 0.7, 0.7, 0.68, "#2B5C9A", "#2B5C9A"));
    placed(kit, -2.4, 3.5, Math.PI, () => plasticChair(kit, "#C0392B"));
    spots.push(diningSeat(-2.4, 3.5, Math.PI));
  }

  // ---- Sitting room (front right), arranged round the TV ----
  if (has("rug") || rich) {
    // A rug with a border.
    kit.box(3.2, 0.015, 2.6, 4.0, 0.001, 1.8, look.accent);
    kit.box(2.9, 0.017, 2.3, 4.0, 0.001, 1.8, "#F4EFE4");
    kit.box(2.7, 0.019, 2.1, 4.0, 0.001, 1.8, look.accent);
  }
  // The centre table: a top on legs with a shelf, a vase of flowers.
  placed(kit, 4.0, 1.5, 0, () => {
    table(kit, 1.2, 0.65, 0.42, rich ? "#2B2F36" : "#8C6A4A", rich ? "#C9A227" : DARK, true);
    kit.cyl(0.06, 0.08, 0.22, -0.25, 0.42, 0, "#F4F1EA", 10);
    for (let i = 0; i < 3; i++) kit.ball(0.06, -0.25 + (i - 1) * 0.05, 0.68, (i - 1) * 0.03, ["#C0392B", "#F2B705", "#8C2F5A"][i], 1, 1);
    kit.box(0.3, 0.02, 0.22, 0.25, 0.43, 0.05, "#26355E"); // a magazine
  });
  // The TV unit against the bathroom wall, facing the sofa: a cabinet on legs with doors and a shelf.
  placed(kit, 4.3, -1.65, 0, () => {
    const body = rich ? "#2B2F36" : DARK;
    legs(kit, 1.9, 0.45, 0.12, rich ? "#C9A227" : "#2B2F36", 0.025, 0.08);
    kit.box(1.9, 0.45, 0.45, 0, 0.12, 0, body);
    for (const x of [-0.62, 0.62]) kit.box(0.6, 0.36, 0.02, x, 0.16, 0.23, rich ? "#3A3F45" : WOOD);
    kit.box(0.6, 0.02, 0.4, 0, 0.32, 0.02, "#111418"); // the open middle shelf, with the decoder
    kit.box(0.3, 0.06, 0.2, 0, 0.34, 0.02, "#1B1D21");
  });
  if (rich) kit.box(1.2, 0.35, 0.25, 4.3, 2.8, -1.8, "#F4F1EA"); // split AC above it
  if (own.tv) {
    const big = rich ? 1.6 : 1.3;
    kit.box(big + 0.1, big * 0.58, 0.06, 4.3, 0.6, -1.65, "#111418");
    spots.push({ actions: ["tv"], use: { pose: "sit", x: 4.0, y: 0, z: 3.55, turn: Math.PI }, label: "TV", x: 4.3, z: -1.6, w: 1.9, d: 0.5, h: 1.5, stand: [4.0, 2.65] });
  }
  // A three-seater facing the TV and an armchair either side (plastic chairs until you buy a sofa).
  // A three-seater facing the TV and an armchair either side (white plastic chairs until you buy a sofa).
  const seat = (x: number, z: number, turn: number, seats: number) =>
    placed(kit, x, z, turn, () => (has("sofa") ? sofa(kit, seats, look.sofa, look.accent, rich) : plasticChair(kit, "#F4F1EA")));
  seat(4.0, 3.55, Math.PI, 3);
  if (!has("sofa")) seat(3.3, 3.55, Math.PI, 1);
  seat(1.9, 1.5, Math.PI / 2, 1);
  seat(5.5, 1.5, -Math.PI / 2, 1);
  // Somewhere to sit with your phone: either end of the sofa (or the plastic chairs), and the armchairs.
  const chair = has("sofa") ? "Sofa" : "Chair";
  for (const x of has("sofa") ? [3.28, 4.72] : [3.3, 4.0]) spots.push(sitSpot(chair, ["phone"], x, 3.55, Math.PI, [x, 2.75]));
  spots.push(sitSpot(has("sofa") ? "Armchair" : "Chair", ["phone"], 1.9, 1.5, Math.PI / 2, [2.75, 1.5]));
  spots.push(sitSpot(has("sofa") ? "Armchair" : "Chair", ["phone"], 5.5, 1.5, -Math.PI / 2, [5.0, 2.45]));
  // A side table with a lamp, and the radio on another.
  placed(kit, 5.55, 3.6, 0, () => {
    sideTable(kit, WOOD);
    lamp(kit, 0.56);
  });
  if (own.radio) {
    placed(kit, 2.2, 3.6, 0, () => {
      sideTable(kit, WOOD);
      kit.box(0.4, 0.22, 0.14, 0, 0.56, 0, "#5E6B73");
      kit.cyl(0.06, 0.06, 0.02, -0.1, 0.62, 0.07, "#2B2F36", 12, Math.PI / 2);
      kit.cyl(0.01, 0.01, 0.4, 0.15, 0.78, -0.03, "#C9CED3", 6, 0, -0.4);
    });
    spots.push({ actions: ["radio"], use: { pose: "sit", x: 1.9, y: 0, z: 1.5, turn: Math.PI / 2 }, label: "Radio", x: 2.2, z: 3.6, w: 0.5, d: 0.5, h: 0.8, stand: [2.6, 2.5] });
  }
  if (has("fan")) {
    kit.cyl(0.25, 0.3, 0.06, 5.5, 0, -0.5, "#DDD", 10);
    kit.cyl(0.03, 0.03, 1.3, 5.5, 0.06, -0.5, "#DDD", 6);
    kit.cyl(0.36, 0.36, 0.08, 5.4, 1.45, -0.5, "#2B5C9A", 14, 0, Math.PI / 2);
  }
  if (rich)
    for (const [x, z] of [[0.3, 4.5], [5.5, 4.55], [-0.4, -4.5]] as const) {
      kit.cyl(0.3, 0.25, 0.5, x, 0, z, "#F4F1EA", 10);
      kit.ball(0.45, x, 0.9, z, "#3F6B2A", 1.2);
    }
  // Still in cartons: fewer as the place fills up.
  const cartons = Math.max(0, 4 - own.furniture.length - (STARTING[own.cls]?.length ?? 0));
  for (let i = 0; i < cartons; i++) kit.box(0.6, 0.45, 0.5, 0.4 - (i % 2) * 0.7, i > 1 ? 0.45 : 0, 4.4, "#B08D57");
  return spots;
}
