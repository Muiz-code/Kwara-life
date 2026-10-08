// Inside a place, in 3D: a cut-away room (two walls standing, two left low so you can see in) with what
// belongs there, the player, and people doing what people do there. Your home starts as a fresh move-in
// (a mattress on the floor, a bucket, a cooler, cartons) and fills up with the furniture you buy.
import {
  AmbientLight, Color, DirectionalLight, DoubleSide, HemisphereLight, Mesh, MeshLambertMaterial, PerspectiveCamera,
  MOUSE, PointLight, Scene, TorusGeometry, TOUCH, WebGLRenderer, BoxGeometry, MeshBasicMaterial, Plane, Raycaster, Vector2, Vector3, type Object3D,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { attireFor } from "../data/attire";
import { gestureFor, type GesturePose } from "../data/gestures";
import { outfitAttire } from "../data/shops";
import { LGA } from "../data/geography";
import type { GameStoreApi } from "../store/game";
import { Avatar, loadPeople, type People, type Pose } from "./avatar";
import { FloorPlan, type P } from "./floorplan";
import { car, figure, tree, type BuildCtx } from "./buildings";
import { homeLook, homeRoom, type Own, type Spot } from "./home";
import { homeClass } from "../data/homestyle";
import { Kit } from "./kit";
import { rng } from "./coords";
import { listenForTaps } from "./tap";

export type Room =
  | "home" | "church" | "mosque" | "club" | "lounge" | "buka" | "office" | "classroom" | "inec" | "viewing" | "hotel" | "hall" | "shop"
  | "airport" | "station" | "stadium" | "bank" | "techhub" | "showroom" | "boutique" | "supermarket";

/** The room for a place, by its kind (and a few places by name). */
export function roomFor(kind: string, id: string): Room {
  if (id === "home" || kind === "house" || kind === "estate" || kind === "oldtown" || kind === "flyover") return "home";
  if (id === "cardealer") return "showroom";
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
  return "shop";
}

/** The floor, for working out where a tap lands. */
const FLOOR = new Plane(new Vector3(0, 1, 0), 0);

/** Room sizes: width, depth and wall height. Churches and mosques are big halls with a gallery upstairs. */
export function dims(room: Room): [number, number, number] {
  if (room === "church" || room === "mosque") return [20, 16, 7];
  if (room === "airport" || room === "stadium") return [24, 16, 8];
  if (room === "station") return [20, 12, 6];
  if (room === "bank" || room === "showroom" || room === "supermarket") return [16, 12, 5];
  if (room === "techhub") return [16, 12, 4.2];
  if (room === "club") return [14, 12, 3.8];
  return [12, 10, 3.4];
}

interface Crowd {
  x: number;
  z: number;
  turn: number;
  g: "m" | "f" | "h";
  pose?: "dance" | "sit" | "talk";
}

/** A place's room: walls, floor, what is in it, and where people are. */
export function furnish(kit: Kit, room: Room, own: Own): { crowd: Crowd[]; lights: [number, number, number, string][]; spots: Spot[] } {
  const [W, D, H] = dims(room);
  const R = rng(room.length * 7919);
  const ctx = { kit, biome: "savanna" as const, district: "mixed", rnd: R };
  const crowd: Crowd[] = [];
  const CLOTH = ["#F4F1EA", "#2F7D7A", "#8C2F5A", "#26355E", "#B5532E", "#3F6B3A", "#C9A227", "#C0392B"];
  /** A simple seated person, for the rows behind the real ones: a full hall that still runs on a phone. */
  const seated = (x: number, z: number, turn: number, y: number) => {
    kit.frame.makeRotationY(turn).setPosition(x, y, z);
    figure(ctx, 0, 0, CLOTH[Math.floor(R() * CLOTH.length)], 1, true);
    kit.frame.identity();
  };
  /** Upstairs: a gallery along the left wall on pillars, with its railing, stairs and people seated. */
  const gallery = (kind: "church" | "mosque") => {
    const y = 3.4;
    const gx = -W / 2 + 2;
    kit.box(4, 0.3, D - 3, gx, y, -1.5, "#8C6A4A");
    for (let z = -D / 2 + 1; z < D / 2 - 2; z += 3) kit.cyl(0.18, 0.2, y, gx + 1.8, 0, z, "#E6E2D8", 10);
    kit.box(0.08, 1.0, D - 3, gx + 2, y + 0.3, -1.5, "#5A3A22");
    for (let z = -D / 2 + 1.5; z < D / 2 - 3; z += 0.5) kit.box(0.05, 1.0, 0.05, gx + 2, y + 0.3, z, "#5A3A22");
    // The stairs up, by the door.
    for (let i = 0; i < 10; i++) kit.box(1.2, 0.34 * (i + 1), 0.4, -W / 2 + 0.7, 0, D / 2 - 1.2 - i * 0.4, "#9C8F7A");
    for (let r = 0; r < 3; r++)
      for (let z = -D / 2 + 1.5; z < D / 2 - 3.5; z += 1.1) {
        if (R() > 0.8) continue;
        if (kind === "church") kit.box(0.5, 0.42, 0.5, gx - 1.2 + r * 1.1, y + 0.3, z, "#6B4A2E");
        kit.frame.makeRotationY(Math.PI / 2).setPosition(gx - 1.2 + r * 1.1, y + 0.3 + (kind === "church" ? 0.25 : 0), z);
        // Upstairs in the mosque is the women's section.
        const women = ["#26355E", "#8C2F5A", "#2F7D7A", "#F4F1EA"];
        figure(ctx, 0, 0, kind === "mosque" ? women[Math.floor(R() * 4)] : CLOTH[Math.floor(R() * CLOTH.length)], 1, true);
        kit.frame.identity();
      }
  };
  const lights: [number, number, number, string][] = [];
  const spots: Spot[] = [];
  const walls = {
    home: homeLook(own).wall,
    church: "#F4EFE4", mosque: "#F1EEE6", club: "#16161E", lounge: "#E6D3AE", buka: "#C8B79A", office: "#E8ECEF",
    classroom: "#F0E2C4", inec: "#EEF3EC", viewing: "#D8CDB8", hotel: "#EFE6D2", hall: "#E8DCC4", shop: "#ECE3D0",
    airport: "#E8EEF2", station: "#D8CDB8", stadium: "#C9C3B6", bank: "#F2EEE6", techhub: "#1F2433", showroom: "#F4F1EA", boutique: "#F2D9C8", supermarket: "#F2F2EE",
  }[room];
  const floorA = { home: homeLook(own).floor[0] as string, church: "#B07A4F", mosque: "#2E7D4F", club: "#0E0E14", lounge: "#A98E6A", buka: "#8F877C", office: "#C9C3B6", classroom: "#9C8F7A", inec: "#C9C3B6", viewing: "#8F877C", hotel: "#B07A4F", hall: "#B9A88C", shop: "#C9C3B6" , airport: "#D8DDE2", station: "#B9B1A4", stadium: "#3F7A33", bank: "#E8E2D6", techhub: "#2B2F3A", showroom: "#E8E8E8", boutique: "#B07A4F", supermarket: "#E2E2DC" }[room];
  const floorB = room === "bank" || room === "airport" ? "#F4F1EA" : room === "home" ? homeLook(own).floor[1] : room === "club" ? "#1C1C28" : room === "mosque" ? "#2A7449" : floorA;

  // Floor tiles, the back and left walls full height, the front and right walls cut low.
  for (let x = 0; x < W; x += 2) for (let z = 0; z < D; z += 2) kit.box(2, 0.1, 2, x - W / 2 + 1, -0.1, z - D / 2 + 1, ((x + z) / 2) % 2 ? floorA : floorB);
  kit.box(W + 0.4, H, 0.2, 0, 0, -D / 2 - 0.1, walls);
  kit.box(0.2, H, D, -W / 2 - 0.1, 0, 0, walls);
  kit.box(W + 0.4, 0.5, 0.2, 0, 0, D / 2 + 0.1, walls);
  kit.box(0.2, 0.5, D, W / 2 + 0.1, 0, 0, walls);
  kit.box(W + 0.4, 0.12, 0.25, 0, 0, -D / 2 + 0.02, "#7A6A58");
  // A door in the left wall and a window in the back wall, with burglary-proof bars.
  if (room !== "home") kit.box(0.12, 2.2, 1.1, -W / 2 + 0.02, 0, D / 2 - 2, "#5A3A22");
  if (room !== "home") kit.box(2.2, 1.3, 0.06, 2.5, 1.2, -D / 2 + 0.02, room === "club" ? "#000" : "#9ED0E6");
  if (room !== "club" && room !== "home") for (let i = 0; i < 7; i++) kit.box(0.04, 1.3, 0.08, 1.5 + i * 0.33, 1.2, -D / 2 + 0.08, "#2B2F36");

  switch (room) {
    case "home": {
      spots.push(...homeRoom(kit, own));
      lights.push([1.5, H - 0.4, -1, "#FFE4B0"], [-3.5, H - 0.4, -2.6, "#FFE4B0"]);
      break;
    }
    case "church": {
      // The altar on a raised platform at the far end, pews down both sides of the aisle, the band to
      // the right, a gallery upstairs along the left wall.
      kit.box(10, 0.6, 3.2, 0, 0, -D / 2 + 1.8, "#8C6A4A");
      kit.box(1.8, 1.0, 0.7, 0, 0.6, -D / 2 + 1.6, "#F4EFE4");
      kit.box(0.8, 1.3, 0.6, -2.6, 0.6, -D / 2 + 2.4, "#6B4A2E");
      kit.box(0.2, 3.0, 0.08, 0, 2.6, -D / 2 + 0.06, "#D4AF37");
      kit.box(1.6, 0.2, 0.08, 0, 4.4, -D / 2 + 0.06, "#D4AF37");
      for (const x of [-6, 6]) kit.box(1.2, 3.4, 0.06, x, 2.0, -D / 2 + 0.06, x < 0 ? "#8C2F5A" : "#26355E");
      kit.box(1.6, 0.9, 0.6, 4.2, 0.6, -D / 2 + 2.2, "#2B2F36");
      for (const [x, r] of [[3.2, 0.32], [3.7, 0.24], [2.8, 0.26]] as const) kit.cyl(r, r, 0.32, x, 0.6, -D / 2 + 3.0, "#C0392B", 12);
      crowd.push({ x: 0, z: -D / 2 + 2.4, turn: 0, g: "m", pose: "talk" });
      // Pews: eight rows each side. The front rows are real people; behind them the church is packed.
      for (let r = 0; r < 8; r++) {
        const z = -D / 2 + 5 + r * 1.3;
        for (const x of [-4.4, 4.4]) {
          kit.box(6.4, 0.45, 0.5, x, 0, z, "#6B4A2E");
          kit.box(6.4, 0.55, 0.08, x, 0.45, z + 0.25, "#6B4A2E");
          for (let k = 0; k < 5; k++) {
            const px = x - 2.6 + k * 1.3;
            if (R() > 0.85) continue;
            if (r < 2 && k % 2 === 0) crowd.push({ x: px, z, turn: Math.PI, g: R() < 0.55 ? "f" : "m", pose: "sit" });
            else seated(px, z, Math.PI, 0.25);
          }
        }
      }
      gallery("church");
      lights.push([-4, H - 0.5, -2, "#FFF2D6"], [4, H - 0.5, 2, "#FFF2D6"], [0, H - 0.5, -6, "#FFF2D6"]);
      break;
    }
    case "mosque": {
      // The mihrab niche in the qibla wall, the minbar beside it, gold calligraphy round the hall, prayer
      // rows on the carpet packed with men, the women's section upstairs in the gallery.
      for (let r = 0; r < 8; r++) kit.box(W - 1, 0.012, 0.08, 0, 0.001, -D / 2 + 3.4 + r * 1.4, "#D4AF37");
      kit.box(2.4, 4.2, 0.4, 0, 0, -D / 2 + 0.2, "#2E7D4F");
      kit.box(1.8, 3.6, 0.42, 0, 0, -D / 2 + 0.2, "#1F5C3A");
      kit.ball(0.9, 0, 3.6, -D / 2 + 0.25, "#D4AF37", 1, 1);
      for (let i = 0; i < 6; i++) kit.box(1.0, 0.3 + i * 0.3, 0.45, 2.6, 0, -D / 2 + 3.0 - i * 0.45, "#6B4A2E");
      kit.box(W, 0.4, 0.05, 0, H - 1.2, -D / 2 + 0.06, "#D4AF37");
      kit.box(0.05, 0.4, D, -W / 2 + 0.06, H - 1.2, 0, "#D4AF37");
      crowd.push({ x: 0, z: -D / 2 + 2.0, turn: 0, g: "m", pose: "talk" });
      for (let r = 0; r < 7; r++)
        for (let k = 0; k < 11; k++) {
          const x = -7.5 + k * 1.5;
          const z = -D / 2 + 3.9 + r * 1.4;
          if (R() > 0.9) continue;
          if (r === 0 && k % 2 === 0) crowd.push({ x, z, turn: Math.PI, g: "m", pose: "sit" });
          else seated(x, z, Math.PI, 0);
        }
      gallery("mosque");
      lights.push([0, H - 0.6, -2, "#FFF2D6"], [-5, H - 0.6, 3, "#FFF2D6"], [5, H - 0.6, 3, "#FFF2D6"]);
      break;
    }
    case "club": {
      // The dance floor in coloured squares, the DJ on the back wall, the bar on the left, VIP couches.
      for (let x = -2; x <= 2; x++) for (let z = -1; z <= 2; z++) kit.box(1.6, 0.02, 1.6, x * 1.6, 0.01, z * 1.6, ["#FF2D95", "#8A2BE2", "#00E5FF", "#FFB000"][(x + z + 8) % 4]);
      kit.box(3.0, 1.1, 0.9, 0, 0, -4.1, "#2B2F36");
      kit.box(2.6, 0.08, 0.6, 0, 1.1, -4.1, "#111");
      for (const x of [-2.2, 2.2]) kit.box(0.8, 1.8, 0.7, x, 0, -4.2, "#111");
      kit.box(0.8, 1.1, 5.0, -5.2, 0, 0.5, "#3A2A1E");
      for (let i = 0; i < 8; i++) kit.cyl(0.05, 0.06, 0.32, -5.4, 1.1, -1.4 + i * 0.5, ["#2E7D4F", "#B5532E", "#F2B705"][i % 3], 6);
      for (let i = 0; i < 4; i++) kit.cyl(0.18, 0.15, 0.7, -4.4, 0, -1.0 + i * 1.1, "#C9A227", 10);
      kit.box(2.6, 0.45, 0.9, 4.6, 0, 3.6, "#8A2BE2");
      kit.box(0.9, 0.45, 2.4, 5.4, 0, 2.0, "#8A2BE2");
      for (let i = 0; i < 4; i++) kit.box(W, 0.06, 0.05, 0, 0.6 + i * 0.7, -D / 2 + 0.05, ["#FF2D95", "#00E5FF"][i % 2]);
      for (let i = 0; i < 7; i++) crowd.push({ x: -2.6 + (i % 4) * 1.7, z: -0.5 + Math.floor(i / 4) * 1.8, turn: R() * Math.PI * 2, g: i % 2 ? "f" : "m", pose: "dance" });
      crowd.push({ x: 0, z: -3.6, turn: 0, g: "m", pose: "dance" });
      lights.push([-3, H - 0.3, -1, "#FF2D95"], [3, H - 0.3, 1, "#00E5FF"], [0, H - 0.3, -3, "#8A2BE2"]);
      break;
    }
    case "airport": {
      // A terminal hall: glass wall onto the runway with a jet outside, check-in desks, the departures board,
      // rows of seats at the gate and travellers pulling luggage.
      kit.box(W, H - 1, 0.1, 0, 0.5, -D / 2 + 0.1, "#7FB3D5");
      for (let i = 0; i < 8; i++) kit.box(0.2, H, 0.2, -W / 2 + 1.5 + i * 3, 0, -D / 2 + 0.2, "#E6E2D8");
      kit.box(14, 2.2, 0.2, 0, H - 2.6, -D / 2 + 0.3, "#111418");
      for (let r = 0; r < 4; r++) kit.box(12, 0.25, 0.05, 0, H - 2.3 + r * 0.45, -D / 2 + 0.42, r % 2 ? "#F2B705" : "#F4F1EA");
      // A jet seen through the glass.
      kit.box(16, 1.8, 1.8, 2, 1.6, -D / 2 - 6, "#F4F1EA");
      kit.box(4, 0.3, 18, 0, 1.4, -D / 2 - 6, "#E6E2D8");
      kit.box(1.4, 3.2, 0.3, -6, 2.6, -D / 2 - 6, "#118A4F");
      // Check-in desks with the queue.
      for (let i = 0; i < 4; i++) {
        const x = -8 + i * 5.3;
        kit.box(3.6, 1.1, 0.9, x, 0, 4.5, "#E6E2D8");
        kit.box(3.4, 0.6, 0.1, x, 1.8, 4.05, "#2B5C9A");
        crowd.push({ x, z: 5.3, turn: Math.PI, g: i % 2 ? "f" : "m", pose: "talk" });
        for (let k = 0; k < 2; k++) {
          crowd.push({ x: x + (R() - 0.5), z: 3.0 - k * 1.1, turn: 0, g: ["m", "f", "h"][(i + k) % 3] as Crowd["g"] });
          kit.box(0.45, 0.6, 0.3, x + 0.6, 0, 3.0 - k * 1.1, ["#2B2F36", "#8C2F5A", "#2B5C9A"][(i + k) % 3]);
        }
      }
      // Gate seats facing the glass.
      for (let r = 0; r < 3; r++) for (let k = 0; k < 10; k++) {
        const x = -9 + k * 2;
        const z = -3.5 + r * 1.4;
        kit.box(0.5, 0.42, 0.5, x, 0, z, "#2B5C9A");
        if (R() < 0.45) seated(x, z, Math.PI, 0.2);
      }
      lights.push([-6, H - 0.6, 0, "#FFFFFF"], [6, H - 0.6, 0, "#FFFFFF"]);
      break;
    }
    case "station": {
      // A concourse onto the platforms: a train at the platform behind the railings, the ticket windows,
      // the timetable board, benches of travellers with their bags.
      kit.box(W, 0.6, 3, 0, 0, -D / 2 + 1.5, "#C9C3B6");
      for (const z of [-D / 2 - 0.6, -D / 2 - 1.8]) kit.box(W, 0.1, 0.12, 0, 0, z, "#6E6A64");
      kit.box(W - 2, 2.4, 1.6, 0, 0.3, -D / 2 - 1.2, "#2E7D4F");
      kit.box(W - 2, 0.5, 1.62, 0, 1.4, -D / 2 - 1.2, "#F4F1EA");
      for (let i = 0; i < 9; i++) kit.box(1.0, 0.5, 1.64, -8 + i * 2, 1.4, -D / 2 - 1.2, "#2F3D48");
      for (let x = -W / 2 + 0.5; x < W / 2; x += 0.6) kit.box(0.05, 1.0, 0.05, x, 0.6, -D / 2 + 3, "#3A3F45");
      for (let i = 0; i < 3; i++) {
        kit.box(2.4, 2.4, 0.4, -W / 2 + 0.3, 0, -1 + i * 2.6, "#E8DCC4", Math.PI / 2);
        kit.box(0.1, 0.8, 1.6, -W / 2 + 0.55, 1.1, -1 + i * 2.6, "#2F3D48");
        crowd.push({ x: -W / 2 + 1.8, z: -1 + i * 2.6, turn: -Math.PI / 2, g: ["m", "f", "h"][i] as Crowd["g"] });
      }
      kit.box(6, 1.8, 0.2, 3, H - 2.2, -D / 2 + 3.1, "#111418");
      for (let r = 0; r < 3; r++) kit.box(5.4, 0.22, 0.05, 3, H - 1.9 + r * 0.45, -D / 2 + 3.22, "#F2B705");
      for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
        const x = -2 + k * 3;
        const z = 1.5 + r * 2.2;
        kit.box(2.4, 0.42, 0.6, x, 0, z, "#8C6A4A");
        seated(x - 0.6, z, Math.PI, 0.2);
        if (R() < 0.6) seated(x + 0.6, z, Math.PI, 0.2);
        kit.box(0.5, 0.45, 0.3, x, 0, z - 0.6, ["#B5532E", "#2B5C9A", "#3F6B3A"][(r + k) % 3]);
      }
      lights.push([0, H - 0.5, 0, "#FFE4B0"]);
      break;
    }
    case "stadium": {
      // Inside the bowl: the pitch, a match on, the stands packed and roaring, the players on the grass.
      kit.box(W - 6, 0.06, D - 6, 0, 0, 0, "#4F9A3E");
      for (let i = 0; i < 6; i++) kit.box((W - 6) / 6, 0.07, D - 6, -(W - 6) / 2 + (W - 6) / 12 + (i * (W - 6)) / 6, 0, 0, i % 2 ? "#4F9A3E" : "#5BA848");
      kit.box(0.12, 0.08, D - 6, 0, 0.01, 0, "#F4F1EA");
      kit.add(new TorusGeometry(1.8, 0.05, 4, 32), "#F4F1EA", 0, 0.08, 0, 0, Math.PI / 2);
      for (const sgn of [-1, 1]) {
        const gx = sgn * ((W - 6) / 2 - 0.1);
        for (const k of [-1.6, 1.6]) kit.box(0.12, 1.6, 0.12, gx, 0, k, "#FFFFFF");
        kit.box(0.12, 0.12, 3.3, gx, 1.6, 0, "#FFFFFF");
      }
      // Tiered stands on all four sides, full of fans.
      for (let t = 0; t < 4; t++) {
        const off = 0.6 + t * 0.9;
        const y = t * 0.9;
        for (const [x, z, w, d] of [[0, -D / 2 + off, W, 0.9], [0, D / 2 - off, W, 0.9], [-W / 2 + off, 0, 0.9, D], [W / 2 - off, 0, 0.9, D]] as const) {
          kit.box(w, 0.9, d, x, y, z, t % 2 ? "#2E7D4F" : "#F4F1EA");
        }
        for (let k = 0; k < 12; k++) {
          if (R() < 0.25) continue;
          seated(-W / 2 + 2 + k * ((W - 4) / 11), -D / 2 + off, 0, y + 0.9);
          if (R() < 0.75) seated(-W / 2 + 2 + k * ((W - 4) / 11), D / 2 - off, Math.PI, y + 0.9);
        }
      }
      for (let i = 0; i < 8; i++) crowd.push({ x: -8 + (i % 4) * 5, z: -3 + Math.floor(i / 4) * 6, turn: R() * 6.28, g: "m", pose: i % 3 ? "dance" : undefined });
      lights.push([-8, H, -5, "#FFFFFF"], [8, H, 5, "#FFFFFF"], [-8, H, 5, "#FFFFFF"], [8, H, -5, "#FFFFFF"]);
      break;
    }
    case "bank": {
      // A banking hall: polished floor, teller windows behind glass, the queue rail, the customer service
      // desks, a wall of ATMs and the Klario teal everywhere.
      const teal = "#0FA3A3";
      kit.box(W - 2, 1.2, 0.8, 0, 0, -D / 2 + 2, "#E6E2D8");
      kit.box(W - 2, 1.4, 0.06, 0, 1.2, -D / 2 + 1.7, "#B9D6E0");
      for (let i = 0; i < 5; i++) {
        kit.box(0.1, 1.4, 0.8, -6 + i * 3, 1.2, -D / 2 + 2, "#C9C3B6");
        crowd.push({ x: -4.5 + i * 3, z: -D / 2 + 1.2, turn: 0, g: ["f", "m", "h"][i % 3] as Crowd["g"], pose: "talk" });
      }
      kit.box(W, 0.6, 0.1, 0, H - 1.2, -D / 2 + 0.06, teal);
      // The queue between its rails.
      for (const x of [-2, 2]) kit.box(0.06, 0.9, 6, x, 0, 1, "#C9A227");
      for (let k = 0; k < 5; k++) crowd.push({ x: 0, z: -1 + k * 1.1, turn: Math.PI, g: ["m", "f", "h", "m", "f"][k] as Crowd["g"] });
      // ATMs along the side and customer service.
      for (let i = 0; i < 3; i++) {
        kit.box(1.0, 2.0, 0.8, W / 2 - 0.6, 0, -1 + i * 1.8, teal);
        kit.box(0.05, 0.5, 0.6, W / 2 - 1.12, 1.0, -1 + i * 1.8, "#111418");
      }
      for (const z of [1.5, 4]) {
        kit.box(2, 0.75, 1, -W / 2 + 2, 0, z, "#F4F1EA");
        crowd.push({ x: -W / 2 + 1.2, z, turn: Math.PI / 2, g: "f", pose: "talk" });
      }
      lights.push([-4, H - 0.4, 0, "#FFFFFF"], [4, H - 0.4, 0, "#FFFFFF"]);
      break;
    }
    case "techhub": {
      // Raavon's floor: open-plan desks with big monitors, a glass meeting room, beanbags, the purple wall
      // with the logo, a pitch going on in the meeting room.
      const brand = "#6C3CE1";
      kit.box(W, 2.2, 0.1, 0, 0.8, -D / 2 + 0.06, brand);
      kit.box(3, 3, 0.12, 0, 0.6, -D / 2 + 0.14, "#F4F1EA");
      for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
        const x = -5 + k * 3.2;
        const z = -2 + r * 3;
        kit.box(2.6, 0.75, 1.1, x, 0, z, "#F4F1EA");
        for (const s of [-0.6, 0.6]) kit.box(0.8, 0.5, 0.05, x + s, 0.8, z - 0.3, "#111418");
        crowd.push({ x: x - 0.6, z: z + 0.7, turn: Math.PI, g: ["m", "f", "h"][(r + k) % 3] as Crowd["g"], pose: "sit" });
      }
      // The glass meeting room in the corner.
      kit.box(0.08, H - 0.4, 5, W / 2 - 4.5, 0, -D / 2 + 3, "#9ED0E6");
      kit.box(4.5, H - 0.4, 0.08, W / 2 - 2.25, 0, -D / 2 + 5.5, "#9ED0E6");
      kit.box(2.8, 0.75, 1.4, W / 2 - 2.2, 0, -D / 2 + 3, "#2B2F36");
      crowd.push({ x: W / 2 - 2.2, z: -D / 2 + 1.8, turn: 0, g: "m", pose: "talk" }, { x: W / 2 - 2.2, z: -D / 2 + 4.3, turn: Math.PI, g: "f", pose: "talk" });
      for (let i = 0; i < 3; i++) kit.ball(0.55, -W / 2 + 1.5 + i * 1.3, 0.35, D / 2 - 1.5, [brand, "#F2B705", "#2E7D4F"][i], 0.6);
      lights.push([-3, H - 0.4, 0, "#E9E4FF"], [3, H - 0.4, 0, "#E9E4FF"]);
      break;
    }
    case "showroom": {
      // A car showroom: glossy floor, cars on display with their prices, a salesman at his desk.
      kit.box(W, H - 1, 0.1, 0, 0.5, -D / 2 + 0.1, "#9ED0E6");
      const cols = ["#C0392B", "#F4F1EA", "#2B2F36", "#2B5C9A", "#C9A227"];
      const ctxCar: BuildCtx = { kit, biome: "savanna", district: "rich", rnd: R };
      for (let i = 0; i < 5; i++) {
        const x = -6 + (i % 3) * 6;
        const z = i < 3 ? -2 : 2.5;
        kit.cyl(1.8, 1.8, 0.12, x, 0, z, "#D8D8D8", 20);
        car(ctxCar, x, z, 0.5, cols[i]);
        kit.box(0.8, 0.5, 0.05, x + 1.6, 0.9, z + 1.0, "#F2B705");
      }
      kit.box(2.2, 0.75, 1, -W / 2 + 2, 0, D / 2 - 2, "#2B2F36");
      crowd.push({ x: -W / 2 + 2, z: D / 2 - 1.2, turn: Math.PI, g: "m", pose: "talk" }, { x: 0, z: 4.5, turn: Math.PI, g: "f" });
      lights.push([-4, H - 0.4, 0, "#FFFFFF"], [4, H - 0.4, 0, "#FFFFFF"]);
      break;
    }
    case "boutique": {
      // A fabric and fashion shop: rolls of aso-oke, ankara and lace on the shelves, outfits on mannequins,
      // a tailor at the sewing machine, a mirror.
      const fabrics = ["#C0392B", "#2E7D4F", "#C9A227", "#8C2F5A", "#2B5C9A", "#F4F1EA", "#E67E22"];
      for (let i = 0; i < 12; i++) {
        kit.box(0.5, 0.5, 0.9, -W / 2 + 0.5, 0.4 + (i % 4) * 0.6, -3 + Math.floor(i / 4) * 1.1, fabrics[i % fabrics.length]);
        kit.box(0.9, 0.5, 0.5, -4 + (i % 6) * 1.2, 0.4 + Math.floor(i / 6) * 0.7, -D / 2 + 0.4, fabrics[(i + 3) % fabrics.length]);
      }
      for (let i = 0; i < 4; i++) {
        const x = -2 + i * 2;
        kit.cyl(0.05, 0.05, 1.0, x, 0, 1, "#2B2F36", 6);
        kit.cyl(0.3, 0.45, 1.2, x, 0.9, 1, fabrics[i], 10);
        kit.ball(0.18, x, 2.3, 1, "#D8CDB8");
      }
      kit.box(1.2, 0.75, 0.7, 3.5, 0, -2.5, "#8C6A4A");
      kit.box(0.5, 0.3, 0.3, 3.5, 0.75, -2.5, "#2B2F36");
      crowd.push({ x: 3.5, z: -1.8, turn: Math.PI, g: "m", pose: "sit" }, { x: 0, z: 3, turn: 0, g: "f" });
      kit.box(1.2, 2, 0.06, W / 2 - 0.1, 0.2, 2, "#B9D6E0", Math.PI / 2);
      lights.push([0, H - 0.3, 0, "#FFE4B0"]);
      break;
    }
    case "supermarket": {
      // Aisles of shelves full of goods, fridges along the back, checkouts by the door, trolleys.
      const goods = ["#C0392B", "#F2B705", "#2E7D4F", "#2B5C9A", "#E67E22", "#F4F1EA", "#8C2F5A"];
      for (let a = 0; a < 4; a++) {
        const x = -5 + a * 3.2;
        kit.box(1.0, 1.9, 7, x, 0, -1, "#E6E2D8");
        for (let lvl = 0; lvl < 4; lvl++) for (let k = 0; k < 10; k++) {
          for (const side of [-0.52, 0.52]) kit.box(0.08, 0.3, 0.5, x + side, 0.25 + lvl * 0.45, -4.2 + k * 0.7, goods[(a + lvl + k) % goods.length]);
        }
      }
      for (let i = 0; i < 6; i++) {
        kit.box(1.8, 2.1, 0.8, -6 + i * 2.4, 0, -D / 2 + 0.5, "#F4F1EA");
        kit.box(1.6, 1.6, 0.05, -6 + i * 2.4, 0.3, -D / 2 + 0.92, "#9ED0E6");
      }
      for (let i = 0; i < 3; i++) {
        kit.box(1.4, 0.9, 0.6, -4 + i * 3, 0, D / 2 - 1.6, "#2B5C9A");
        crowd.push({ x: -4 + i * 3, z: D / 2 - 1.0, turn: Math.PI, g: i % 2 ? "m" : "f", pose: "talk" });
      }
      for (let i = 0; i < 4; i++) crowd.push({ x: -3.4 + (i % 2) * 6.4, z: -2 + i, turn: R() * 6.28, g: ["m", "f", "h"][i % 3] as Crowd["g"] });
      lights.push([-4, H - 0.4, 0, "#FFFFFF"], [4, H - 0.4, 0, "#FFFFFF"]);
      break;
    }
    case "lounge":
    case "viewing": {
      kit.box(4.4, 2.4, 0.15, 0, 0.6, -D / 2 + 0.2, "#111418");
      kit.box(4.1, 2.1, 0.02, 0, 0.75, -D / 2 + 0.29, "#2E7D4F");
      for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) {
        kit.box(0.5, 0.42, 0.5, -3 + k * 1.5, 0, -1 + r * 1.6, ["#F4F1EA", "#C0392B", "#2B5C9A"][(r + k) % 3]);
        if (R() < 0.65) crowd.push({ x: -3 + k * 1.5, z: -1 + r * 1.6, turn: Math.PI, g: R() < 0.7 ? "m" : "h", pose: "sit" });
      }
      if (room === "lounge") {
        kit.box(1.6, 0.9, 0.7, 4.6, 0, 3.8, "#3A3F45");
        kit.box(1.5, 0.05, 0.6, 4.6, 0.92, 3.8, "#C0392B");
      }
      lights.push([0, H - 0.3, 1, "#FFE4B0"]);
      break;
    }
    case "buka": {
      kit.box(4.0, 0.9, 0.8, -1.5, 0, -4.2, "#8C6A4A");
      for (let i = 0; i < 4; i++) kit.cyl(0.3, 0.26, 0.45, -3.0 + i * 1.0, 0.9, -4.2, "#2B2F36", 12);
      for (const [x, z] of [[-3, 0], [0, 0], [3, 0], [-1.5, 2.5], [1.5, 2.5]]) {
        kit.box(1.6, 0.75, 0.8, x, 0, z, ["#2B5C9A", "#C0392B", "#2E7D4F"][Math.abs(Math.round(x)) % 3]);
        kit.box(1.6, 0.42, 0.3, x, 0, z + 0.7, "#8C6A4A");
        if (R() < 0.7) crowd.push({ x, z: z + 0.7, turn: Math.PI, g: R() < 0.5 ? "m" : "f", pose: "sit" });
      }
      crowd.push({ x: -1.5, z: -3.4, turn: 0, g: "f", pose: "talk" });
      lights.push([0, H - 0.3, 0, "#FFE4B0"]);
      break;
    }
    case "classroom": {
      kit.box(4.0, 1.4, 0.06, 0, 0.9, -D / 2 + 0.05, "#1F3A2B");
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
        kit.box(1.0, 0.72, 0.6, -3.6 + k * 2.4, 0, -1.6 + r * 1.8, "#8C6A4A");
        kit.box(1.0, 0.42, 0.35, -3.6 + k * 2.4, 0, -1.0 + r * 1.8, "#6B4A2E");
        if (R() < 0.6) crowd.push({ x: -3.6 + k * 2.4, z: -1.0 + r * 1.8, turn: Math.PI, g: R() < 0.5 ? "m" : "f", pose: "sit" });
      }
      crowd.push({ x: 1.6, z: -4.0, turn: 0, g: "f", pose: "talk" });
      lights.push([0, H - 0.3, 0, "#FFF2D6"]);
      break;
    }
    case "inec": {
      kit.box(6, 1.0, 0.8, 0, 0, -2.6, "#2E7D4F");
      kit.box(0.4, 0.25, 0.3, -1.2, 1.0, -2.6, "#2B2F36");
      kit.box(0.4, 0.25, 0.3, 1.2, 1.0, -2.6, "#2B2F36");
      kit.box(5, 1.4, 0.06, 0, 1.4, -D / 2 + 0.05, "#118A4F");
      for (let i = 0; i < 2; i++) crowd.push({ x: -1.2 + i * 2.4, z: -3.4, turn: 0, g: i ? "f" : "m", pose: "talk" });
      for (let i = 0; i < 5; i++) crowd.push({ x: -0.6 + (i % 2) * 0.4, z: -1.4 + i * 1.0, turn: Math.PI, g: ["m", "f", "h"][i % 3] as Crowd["g"] });
      lights.push([0, H - 0.3, 0, "#FFF2D6"]);
      break;
    }
    case "office":
    case "hall":
    case "hotel":
    case "shop":
    default: {
      if (room === "hall") {
        kit.box(5, 0.5, 1.8, 0, 0, -3.9, "#8C6A4A");
        for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
          kit.box(0.5, 0.42, 0.5, -3.5 + k * 1.4, 0, -1.2 + r * 1.4, "#F4F1EA");
          if (R() < 0.55) crowd.push({ x: -3.5 + k * 1.4, z: -1.2 + r * 1.4, turn: Math.PI, g: ["m", "f", "h"][k % 3] as Crowd["g"], pose: "sit" });
        }
        crowd.push({ x: 0, z: -3.8, turn: 0, g: "m", pose: "talk" });
      } else if (room === "hotel") {
        kit.box(3.6, 1.1, 0.8, -1.5, 0, -3.6, "#6B4A2E");
        kit.box(2.4, 0.45, 0.9, 3.0, 0, 2.6, "#8C2F5A");
        crowd.push({ x: -1.5, z: -4.2, turn: 0, g: "f", pose: "talk" });
      } else if (room === "office") {
        for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
          const x = -3.6 + k * 3.2;
          const z = -2.4 + r * 3.0;
          kit.box(1.6, 0.75, 0.8, x, 0, z, "#C9C3B6");
          kit.box(0.6, 0.4, 0.05, x, 0.78, z - 0.2, "#111418");
          if (R() < 0.7) crowd.push({ x, z: z + 0.6, turn: Math.PI, g: ["m", "f", "h"][(r + k) % 3] as Crowd["g"], pose: "sit" });
        }
        kit.box(1.1, 0.4, 0.35, -3, 2.4, -D / 2 + 0.25, "#E8E8E8");
      } else {
        for (let i = 0; i < 4; i++) {
          kit.box(0.5, 2.2, 3.2, -5.4, 0, -3 + i * 0.1 + 0, "#8C6A4A");
          for (let y = 0; y < 4; y++) for (let k = 0; k < 5; k++) kit.box(0.3, 0.3, 0.4, -5.3, 0.3 + y * 0.5, -4.2 + k * 0.6, ["#C0392B", "#F2B705", "#2E7D4F", "#2B5C9A"][(y + k) % 4]);
        }
        kit.box(3, 1.0, 0.8, 1.5, 0, -2.8, "#6B4A2E");
        crowd.push({ x: 1.5, z: -3.5, turn: 0, g: "f", pose: "talk" });
      }
      lights.push([0, H - 0.3, 0, "#FFF2D6"]);
    }
  }
  // A plant in the corner by the door, for life.
  if (!["club", "mosque", "home", "stadium", "airport", "techhub"].includes(room)) tree({ ...ctx }, "palm", -5.2, 4.2, 0.35);
  void figure;
  return { crowd, lights, spots };
}

/** The avatar animation that best plays a gesture's pose (the library has no lie, kneel or eat clips). */
function clipFor(pose: GesturePose): Pose | undefined {
  switch (pose) {
    case "lie":
    case "sit":
    case "kneel":
    case "pray":
    case "eat":
    case "drink":
    case "read":
    case "phone":
    case "look":
      return "sit";
    case "type":
    case "wash":
    case "cook":
    case "lift":
      return "work";
    case "dance":
    case "clap":
      return "dance";
    case "talk":
      return "talk";
    default:
      return undefined;
  }
}

export interface InteriorOptions {
  kind: string;
  placeId: string;
  /** Tapped something you can use: show its choices (sleep or nap...) near the tap. */
  onSpot?: (spot: Spot, x: number, y: number) => void;
}

export class Interior3D {
  private renderer!: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(45, 1, 0.1, 200);
  private controls!: OrbitControls;
  private people: { a: Avatar; pose?: Pose }[] = [];
  private plan!: FloorPlan;
  private size: [number, number, number] = [12, 10, 3.4];
  private player: Avatar | null = null;
  private party: PointLight[] = [];
  /** Things you can tap to use, and the floor to walk on. */
  private spots: Spot[] = [];
  private hits: Mesh[] = [];
  private ray = new Raycaster();
  /** Where the player stands, where they are walking to, and what they will do there. */
  private me = { x: 0.5, z: 3.6, turn: Math.PI, path: [] as P[], then: null as null | { spot: Spot; action: string; already?: boolean } };
  /** The action whose gesture the player is acting out (started from the place card or a spot). */
  private acting: string | null = null;
  /** Screens that light up when switched on (the TV, the radio), by spot. */
  private screens = new Map<Spot, Mesh>();
  /** Using a thing: lying on the bed, working at the stove. Ends when the action does. */
  private using: null | { spot: Spot; action: string; started: boolean; t0: number; already?: boolean } = null;
  private unsub: (() => void)[] = [];
  private last = performance.now();
  private resize: ResizeObserver | null = null;
  private destroyed = false;
  readonly room: Room;

  private constructor(private host: HTMLElement, private store: GameStoreApi, private opts: InteriorOptions) {
    this.room = roomFor(opts.kind, opts.placeId);
    this.size = dims(this.room);
    this.plan = new FloorPlan(this.size[0], this.size[1], 0.2);
  }

  static async create(host: HTMLElement, store: GameStoreApi, opts: InteriorOptions): Promise<Interior3D> {
    const r = new Interior3D(host, store, opts);
    await r.init();
    return r;
  }

  private async init() {
    const r = new WebGLRenderer({ antialias: true });
    this.renderer = r;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    this.host.appendChild(r.domElement);
    r.domElement.style.display = "block";
    r.domElement.style.touchAction = "none";

    const g = this.store.getState().game;
    const c = g.citizen;
    const kit = new Kit();
    const { crowd, lights, spots } = furnish(kit, this.room, {
      furniture: g.furniture ?? [],
      // The old Ilorin game has a TV at home without buying one.
      tv: c ? !!c.ownsTv : true,
      radio: !!c?.ownsRadio,
      cls: this.room === "home" ? homeClass(g) : (c?.cls ?? "poor"),
      style: g.homeStyle,
    });
    const geo = kit.merge();
    if (geo) {
      const room = new Mesh(geo, new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }));
      room.receiveShadow = true;
      room.castShadow = true;
      this.scene.add(room);
      // Everything standing in the room blocks the floor under it; people keep a body width clear.
      this.plan.markGeometry(geo);
    }
    for (const p of crowd) this.plan.markCircle(p.x, p.z, 0.25);
    this.plan.grow(1);
    const startAt = this.plan.nearestFree(this.me.x, this.me.z);
    if (startAt) Object.assign(this.me, startAt);

    const dark = this.room === "club";
    this.scene.background = new Color(dark ? "#07070C" : "#2A2F45");
    this.scene.add(new HemisphereLight(dark ? "#6A5ACD" : "#FFF6E4", "#4A3A2A", dark ? 0.6 : 1.6));
    this.scene.add(new AmbientLight("#ffffff", dark ? 0.15 : 0.35));
    const sun = new DirectionalLight("#FFF1D6", dark ? 0.3 : 1.4);
    sun.position.set(-4, 9, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    this.scene.add(sun);
    for (const [x, y, z, col] of lights) {
      const l = new PointLight(col, dark ? 18 : 6, 14, 1.6);
      l.position.set(x, y, z);
      this.scene.add(l);
      if (dark) this.party.push(l);
    }

    this.camera.position.set(this.size[0] * 0.75, this.size[2] + 5.5, this.size[1] * 1.2);
    const ctl = new OrbitControls(this.camera, r.domElement);
    this.controls = ctl;
    ctl.target.set(0, 1, 0);
    ctl.enableDamping = true;
    ctl.minDistance = 6;
    ctl.maxDistance = Math.max(24, this.size[0] * 2);
    ctl.minPolarAngle = 0.3;
    ctl.maxPolarAngle = 1.3;
    ctl.enablePan = false;
    ctl.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE };
    ctl.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE };
    ctl.update();
    this.onResize();
    this.resize = new ResizeObserver(() => this.onResize());
    this.resize.observe(this.host);
    r.setAnimationLoop(this.frame);
    this.spots = spots;
    // A screen for each thing that switches on: dark until it is used.
    for (const sp of spots) {
      if (!sp.actions.some((id) => gestureFor(id).switchOn)) continue;
      const tv = sp.actions.includes("tv");
      const screen = new Mesh(new BoxGeometry(tv ? 1.25 : 0.3, tv ? 0.68 : 0.12, 0.02), new MeshBasicMaterial({ color: "#10141A" }));
      screen.position.set(sp.x, tv ? 0.99 : sp.h + 0.05, sp.z + (tv ? 0.07 : 0.22));
      this.scene.add(screen);
      this.screens.set(sp, screen);
    }
    const hidden = new MeshBasicMaterial({ visible: false });
    for (const sp of spots) {
      const m = new Mesh(new BoxGeometry(sp.w + 0.3, sp.h + 0.3, sp.d + 0.3), hidden);
      m.position.set(sp.x, sp.h / 2, sp.z);
      m.userData.spot = sp;
      this.scene.add(m);
      this.hits.push(m);
    }
    this.listenForTaps();

    // People arrive once the models load: the player by the door, the crowd at their places.
    try {
      const [set, { clone }] = await Promise.all([loadPeople(), import("three/examples/jsm/utils/SkeletonUtils.js")]);
      if (this.destroyed) return;
      this.addPeople(set, clone, crowd);
    } catch {
      // No models: the room is still there to see.
    }
  }

  private addPeople(set: People, clone: (o: Object3D) => Object3D, crowd: Crowd[]) {
    const g = this.store.getState().game;
    const home = g.citizen ? LGA[g.citizen.lgaCode]?.stateCode ?? "kwara" : "kwara";
    const ch = g.char;
    const R = rng(this.opts.placeId.length * 31 + 7);
    const SKINS = ["#8D5524", "#6B3E26", "#4A2A18", "#A86B3C"];
    const CLOTH = ["#F4F1EA", "#2F7D7A", "#8C2F5A", "#26355E", "#B5532E", "#3F6B3A", "#C9A227"];
    for (const p of crowd.slice(0, 12)) {
      const look = { g: p.g, skin: SKINS[Math.floor(R() * SKINS.length)], cloth: CLOTH[Math.floor(R() * CLOTH.length)] };
      const a = new Avatar(set, look, attireFor(home, p.g), clone);
      a.root.position.set(p.x, p.pose === "sit" ? 0.05 : 0, p.z);
      a.root.rotation.y = p.turn;
      this.scene.add(a.root);
      this.people.push({ a, pose: p.pose });
    }
    if (ch) {
      const me = new Avatar(set, { g: ch.g, skin: ch.skin, cloth: ch.cloth }, outfitAttire(g.outfit, ch.g) ?? attireFor(home, ch.g), clone);
      me.root.position.set(this.me.x, 0, this.me.z);
      me.root.rotation.y = this.me.turn;
      this.scene.add(me.root);
      this.player = me;
    }
  }

  /** A tap (not a drag): on something you can use, walk to it and use it; on the floor, walk there. */
  private listenForTaps() {
    const el = this.renderer.domElement;
    const onTap = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      this.ray.setFromCamera(new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.camera);
      const hit = this.ray.intersectObjects(this.hits, false)[0];
      if (this.using) return;
      if (hit) {
        const sp = hit.object.userData.spot as Spot;
        if (this.opts.onSpot) this.opts.onSpot(sp, e.clientX, e.clientY);
        else this.use(sp, sp.actions[0]);
        return;
      }
      const p = new Vector3();
      if (this.ray.ray.intersectPlane(FLOOR, p)) this.walkTo({ x: p.x, z: p.z }, null);
    };
    this.unsub.push(listenForTaps(el, onTap));
  }

  private walkTo(to: P, then: { spot: Spot; action: string } | null) {
    this.me.path = this.plan.path(this.me, to);
    this.me.then = then;
    // Already there (or nowhere to go): do it straight away.
    if (!this.me.path.length && then) this.startUse();
  }

  /** Walk to a thing and use it for this action (sleep, nap, cook...). */
  use(spot: Spot, action: string) {
    if (this.using || this.store.getState().activity) return;
    this.walkTo({ x: spot.stand[0], z: spot.stand[1] }, { spot, action });
  }

  /** Take up the pose at the thing (lie on the bed, face the stove) and do the action. */
  private startUse() {
    const t = this.me.then;
    this.me.then = null;
    if (!t || !this.player) return;
    const u = t.spot.use;
    const r = this.player.root;
    r.position.set(u.x, u.y + (u.pose === 'lie' ? 0.14 : 0), u.z);
    r.rotation.set(u.pose === 'lie' ? -Math.PI / 2 : 0, u.turn, 0, 'YXZ');
    this.using = { ...t, started: !!t.already, t0: performance.now() };
    this.acting = t.action;
    // Started from the place card: the action is already running, only the gesture was missing.
    if (!t.already) this.store.getState().doAction(t.action, performance.now());
  }

  /** Get up when the action is over (or was not allowed), back to where you stood. */
  private endUse() {
    const u = this.using;
    this.using = null;
    if (!u || !this.player) return;
    const stand = this.plan.nearestFree(u.spot.stand[0], u.spot.stand[1]) ?? this.me;
    this.me.x = stand.x;
    this.me.z = stand.z;
    this.player.root.position.set(stand.x, 0, stand.z);
    this.player.root.rotation.set(0, this.me.turn, 0);
  }

  /** Step the player along their path round the furniture. Returns the speed moved at. */
  private walkMe(dt: number): number {
    const m = this.me;
    if (this.using || this.store.getState().activity || !this.player || !m.path.length) return 0;
    const speed = 2.6;
    let left = speed * dt;
    while (left > 0 && m.path.length) {
      const to = m.path[0];
      const dx = to.x - m.x;
      const dz = to.z - m.z;
      const far = Math.hypot(dx, dz);
      if (far <= left) {
        m.x = to.x;
        m.z = to.z;
        m.path.shift();
        left -= far;
      } else {
        m.x += (dx / far) * left;
        m.z += (dz / far) * left;
        left = 0;
      }
      if (far > 0.01) m.turn = Math.atan2(dx, dz);
    }
    this.player.root.position.set(m.x, 0, m.z);
    this.player.root.rotation.set(0, m.turn, 0);
    if (!m.path.length && m.then) this.startUse();
    return speed;
  }

  private onResize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame = () => {
    if (this.destroyed) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const st = this.store.getState();
    for (const p of this.people) p.a.update(dt, 0, p.pose);
    // The player joins in: dancing at the club, sitting for a service, prayer or the TV.
    const a = st.activity?.kind === "action" ? st.activity.plan.action : null;
    // An action started from the place card: walk to the thing it uses and act it out.
    const running = st.activity?.kind === "action" ? st.activity.plan.action.id : null;
    if (running && running !== this.acting && !this.using) {
      this.acting = running;
      const spot = this.spots.find((s) => s.actions.includes(running));
      if (spot) {
        this.me.path = this.plan.path(this.me, { x: spot.stand[0], z: spot.stand[1] });
        this.me.then = { spot, action: running, already: true };
        if (!this.me.path.length) this.startUse();
      }
    }
    if (!running && !this.using) this.acting = null;
    // Screens glow, flickering, while switched on.
    for (const [sp, screen] of this.screens) {
      const on = this.using?.spot === sp && gestureFor(this.using.action).switchOn;
      (screen.material as MeshBasicMaterial).color.set(on ? (Math.sin(now / 120) > 0 ? "#6FB7E6" : "#4F97C6") : "#10141A");
    }
    if (this.using) {
      if (st.activity) this.using.started = true;
      else if (this.using.started || now - this.using.t0 > 700) this.endUse();
    }
    const gesture = a ? gestureFor(a.id, this.opts.kind, a.label) : null;
    const pose: Pose | undefined = this.using
      ? this.using.spot.use.pose
      : this.me.path.length
        ? undefined
        : gesture
          ? clipFor(gesture.pose)
          : !a ? undefined : this.room === "club" && a.id === "dance" ? "dance" : a.media || /pray|service|jummah|tafsir|vigil|match|suya|eat|edu|debate/.test(a.id) ? "sit" : "talk";
    this.player?.update(dt, this.walkMe(dt), pose);
    // Club lights pulse with the music.
    this.party.forEach((l, i) => (l.intensity = 10 + 10 * Math.max(0, Math.sin(now / 180 + i * 2.1))));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  destroy() {
    this.destroyed = true;
    this.renderer?.setAnimationLoop(null);
    this.resize?.disconnect();
    this.unsub.forEach((u) => u());
    this.controls?.dispose();
    for (const p of this.people) p.a.dispose();
    this.player?.dispose();
    this.scene.traverse((o) => {
      if (o instanceof Mesh && !(o as { isSkinnedMesh?: boolean }).isSkinnedMesh) o.geometry.dispose();
    });
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
