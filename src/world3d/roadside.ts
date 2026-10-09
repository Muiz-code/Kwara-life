// Draws the advertising outside town (see world/roadside.ts for where it stands): classic billboards,
// giant unipoles, smart LED screens and poster grounds. Steel, timber and zinc are baked into one mesh.
// Every billboard is printed front and back, and each face runs its own carousel of booked ads
// (sim/carousel.ts), changing on the real clock; smart screens play video ads.
import {
  BoxGeometry, CanvasTexture, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial,
  PlaneGeometry, Quaternion, SRGBColorSpace, TextureLoader, Vector3, VideoTexture, type Texture,
} from "three";
import { BOARDS, type BoardFace } from "../data/boards";
import { boardTypeOf, type AdBooking } from "../sim/ads";
import { showing } from "../sim/carousel";
import { adsStore, faceQueue } from "../store/ads";
import { videoUrl } from "../store/ad-media";
import { roadsideSpots, type RoadsideKind, type RoadsideSpot } from "../world/roadside";
import { cellAt } from "../world/town";
import type { Facing, WorldMap } from "../world/types";
import { CELL, FACE_TURN } from "./coords";
import { Kit } from "./kit";

/** A printed face: its size, and where it hangs in the spot's own space (+z faces the road). */
interface Face {
  w: number;
  h: number;
  y: number;
  /** The front face; the back is `back` units behind it, turned round. */
  z: number;
  back?: number;
}

const FACES: Record<RoadsideKind, Face> = {
  billboard: { w: 10, h: 5, y: 11.1, z: 2.28, back: 0.56 },
  attention: { w: 13.4, h: 6.6, y: 18.1, z: 1.78, back: 0.56 },
  smart: { w: 12, h: 6, y: 11.3, z: 1.93, back: 0.86 },
  square: { w: 7.4, h: 7.4, y: 14.4, z: 1.78, back: 0.56 },
  tall: { w: 5, h: 8.9, y: 7.75, z: 1.93, back: 0.86 },
  posters: { w: 8.2, h: 2.2, y: 1.65, z: -0.88 },
};

const STEEL = "#4A4E54";
const FRAME = "#2B2F36";
const CONCRETE = "#B9B2A4";
const TIMBER = "#6B4A2E";
const ZINC = "#9AA3A8";
const CLEARED = "#C29B6E";
const BEZEL = "#0D0F12";
const LAMP = "#FFE9A8";

/** Videos playing at once, so a phone isn't asked to decode a dozen. Others show their poster frame. */
const MAX_PLAYING = 4;

export interface Roadside {
  /** Everything to add to the scene. */
  group: Group;
  /** Invisible tap targets, each with userData.board set to its spot's id. */
  hits: Mesh[];
  spots: RoadsideSpot[];
  /** Stop the carousels and videos and free their textures. */
  dispose: () => void;
}

/** One printed face of one board, and what it shows now. */
interface FaceSlot {
  boardId: string;
  face: BoardFace;
  mesh: Mesh;
  fallback: MeshBasicMaterial;
  ref: string | null;
}

/** How many "Place your ad here" boards stand on empty plots in a town. */
export const MAX_PLOT_BOARDS = 8;

/**
 * Boards on a few empty plots in town (the owner's call, 9 October 2026): spread out, each facing the road
 * beside its plot. Plots are world positions of empty grid cells (BuiltScene.emptyPlots).
 */
export function plotSpots(map: WorldMap, plots: { x: number; z: number }[]): RoadsideSpot[] {
  const g = map.grid;
  if (!g) return [];
  const ROAD = new Set(["a", "r", "t", "b"]);
  const STEP: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const sorted = [...plots].sort((a, b) => a.x - b.x || a.z - b.z);
  const out: RoadsideSpot[] = [];
  const stride = Math.max(1, Math.floor(sorted.length / MAX_PLOT_BOARDS));
  for (let i = 0; i < sorted.length && out.length < MAX_PLOT_BOARDS; i += stride) {
    const u = Math.round(sorted[i].x / CELL);
    const v = Math.round(sorted[i].z / CELL);
    const face = ([0, 1, 2, 3] as Facing[]).find((f) => ROAD.has(cellAt(g, u + STEP[f][0], v + STEP[f][1])));
    if (face === undefined || out.some((o) => Math.hypot(o.u - u, o.v - v) < 4)) continue;
    out.push({ id: `plot-${u}_${v}`, kind: "billboard", u, v, face });
  }
  return out;
}

/** Build every billboard, unipole, smart screen and poster ground outside the town, and the boards on plots. */
export function buildRoadside(map: WorldMap, font: string, plots: RoadsideSpot[] = []): Roadside {
  const spots = [...roadsideSpots(map), ...plots];
  const group = new Group();
  const hits: Mesh[] = [];
  const noop = { group, hits, spots, dispose: () => {} };
  if (!spots.length) return noop;

  const kit = new Kit();
  const hidden = new MeshBasicMaterial({ visible: false });
  const posterAt: Matrix4[] = [];
  const turn = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const one = new Vector3(1, 1, 1);
  const planes: Partial<Record<RoadsideKind, PlaneGeometry>> = {};
  const art: Record<Exclude<RoadsideKind, "posters">, MeshBasicMaterial> = {
    billboard: new MeshBasicMaterial({ map: billboardArt(font, map.name) }),
    attention: new MeshBasicMaterial({ map: attentionArt(font, map.name) }),
    smart: new MeshBasicMaterial({ map: smartArt(font, map.name) }),
    square: new MeshBasicMaterial({ map: squareArt(font) }),
    tall: new MeshBasicMaterial({ map: tallArt(font) }),
  };
  const plotArt = new MeshBasicMaterial({ map: plotBoardArt(font) });
  const slots: FaceSlot[] = [];

  for (const s of spots) {
    const onPlot = s.id.startsWith("plot-");
    const X = s.u * CELL;
    const Z = s.v * CELL;
    const ry = FACE_TURN[s.face];
    kit.frame.makeRotationY(ry).setPosition(X, 0, Z);
    if (s.kind === "billboard") classic(kit);
    else if (s.kind === "attention") unipole(kit);
    else if (s.kind === "smart") smartScreen(kit);
    else if (s.kind === "square") squareBoard(kit);
    else if (s.kind === "tall") tallScreen(kit);
    else posterGround(kit);

    const f = FACES[s.kind];
    const place = (z: number, side: number) => new Matrix4().compose(new Vector3(X + Math.sin(ry) * z, f.y, Z + Math.cos(ry) * z), turn.setFromAxisAngle(up, ry + side).clone(), one);
    if (s.kind === "posters") {
      posterAt.push(place(f.z, 0));
    } else {
      // Front and back, each its own mesh so each runs its own carousel.
      const plane = (planes[s.kind] ??= new PlaneGeometry(f.w, f.h));
      for (const [face, z, side] of [["front", f.z, 0], ["back", f.z - (f.back ?? 0.5), Math.PI]] as const) {
        const fallback = onPlot ? plotArt : art[s.kind];
        const mesh = new Mesh(plane, fallback);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(place(z, side));
        mesh.userData.board = s.id;
        group.add(mesh);
        slots.push({ boardId: s.id, face, mesh, fallback, ref: null });
      }
    }

    const hit = new Mesh(new BoxGeometry(f.w + 0.4, f.y + f.h / 2, 2), hidden);
    hit.rotation.y = ry;
    hit.position.set(X, (f.y + f.h / 2) / 2, Z);
    hit.translateZ(f.z);
    hit.userData.board = s.id;
    hits.push(hit);
  }

  const solid = kit.merge();
  if (solid) {
    solid.computeBoundingSphere();
    const m = new Mesh(solid, new MeshLambertMaterial({ vertexColors: true }));
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  if (posterAt.length) {
    const f = FACES.posters;
    const faces = new InstancedMesh(new PlaneGeometry(f.w, f.h), new MeshBasicMaterial({ map: posterArt(font), side: DoubleSide }), posterAt.length);
    posterAt.forEach((m, i) => faces.setMatrixAt(i, m));
    faces.instanceMatrix.needsUpdate = true;
    faces.computeBoundingSphere();
    group.add(faces);
  }

  const carousel = runCarousels(map.id, slots);
  return {
    group,
    hits,
    spots,
    dispose: () => {
      carousel.stop();
      plotArt.map?.dispose();
      plotArt.dispose();
      for (const m of Object.values(art)) {
        m.map?.dispose();
        m.dispose();
      }
    },
  };
}

/**
 * Keep every face showing the ad whose turn it is. Checks once a second and whenever a booking is made;
 * an ad's picture or video is loaded once and shared by every face showing it.
 */
function runCarousels(mapId: string, slots: FaceSlot[]) {
  /** playing: the video texture is up, so a late-loading picture must not replace it. */
  type Entry = { mat: MeshBasicMaterial; tex: Texture | null; image: string; video?: HTMLVideoElement; playing?: boolean };
  const mats = new Map<string, Entry>();
  let stopped = false;

  /** Put the booking's picture (or a video's poster frame) on its material. */
  const showPicture = (entry: Entry) => {
    new TextureLoader().load(entry.image, (tex) => {
      if (stopped || entry.playing) return tex.dispose();
      tex.colorSpace = SRGBColorSpace;
      entry.tex?.dispose();
      entry.tex = tex;
      entry.mat.map = tex;
      entry.mat.color.set("#FFFFFF");
      entry.mat.needsUpdate = true;
    });
  };

  /** The material for a booking: its picture straight away, its video once loaded (if allowed to play). */
  const materialFor = (b: AdBooking): MeshBasicMaterial => {
    const have = mats.get(b.ref);
    if (have) return have.mat;
    const entry: Entry = { mat: new MeshBasicMaterial({ color: "#1B1F27" }), tex: null, image: b.image };
    mats.set(b.ref, entry);
    showPicture(entry);
    return entry.mat;
  };

  /** Swap a booking's picture for its playing video. */
  const startVideo = (b: AdBooking) => {
    const entry = mats.get(b.ref);
    if (!entry || entry.video || !b.video) return;
    const v = document.createElement("video");
    entry.video = v;
    // Muted, inline and looping: browsers only autoplay muted video, and a billboard has no sound anyway.
    Object.assign(v, { muted: true, loop: true, playsInline: true, preload: "auto" });
    void videoUrl(b.video).then((url) => {
      if (stopped || !url || entry.video !== v) return;
      v.src = url;
      v.play()
        .then(() => {
          if (stopped || entry.video !== v) return;
          const tex = new VideoTexture(v);
          tex.colorSpace = SRGBColorSpace;
          entry.playing = true;
          entry.tex?.dispose();
          entry.tex = tex;
          entry.mat.map = tex;
          entry.mat.color.set("#FFFFFF");
          entry.mat.needsUpdate = true;
        })
        .catch(() => {
          // Autoplay refused (power saving): the poster frame stays up.
        });
    });
  };

  /** Stop a video; a face still showing it goes back to its poster frame. */
  const stopVideo = (ref: string) => {
    const entry = mats.get(ref);
    if (!entry?.video) return;
    entry.video.pause();
    entry.video.removeAttribute("src");
    entry.video.load();
    entry.video = undefined;
    entry.playing = false;
    if (!stopped) showPicture(entry);
  };

  const update = () => {
    if (stopped) return;
    const queue = adsStore.getState().queue;
    const now = Date.now();
    const onScreen = new Map<string, AdBooking>();
    for (const slot of slots) {
      const spec = BOARDS[boardTypeOf(slot.boardId)];
      const { ad } = showing(faceQueue(queue, mapId, slot.boardId, slot.face, now), now, spec.slotMs);
      if (ad) onScreen.set(ad.ref, ad);
      const ref = ad?.ref ?? null;
      if (ref === slot.ref) continue;
      slot.ref = ref;
      slot.mesh.material = ad ? materialFor(ad) : slot.fallback;
    }
    // Play the videos on screen, up to the cap; stop the rest.
    const wanted = [...onScreen.values()].filter((b) => b.video && BOARDS[b.type ?? "classic"].video).slice(0, MAX_PLAYING);
    const keep = new Set(wanted.map((b) => b.ref));
    for (const [ref, e] of mats) if (e.video && !keep.has(ref)) stopVideo(ref);
    for (const b of wanted) startVideo(b);
    // Drop pictures nobody is showing.
    for (const [ref, e] of mats) {
      if (onScreen.has(ref) || e.video) continue;
      e.tex?.dispose();
      e.mat.dispose();
      mats.delete(ref);
    }
  };

  update();
  const timer = setInterval(update, 1000);
  const unsub = adsStore.subscribe(update);
  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
      unsub();
      for (const ref of [...mats.keys()]) stopVideo(ref);
      for (const e of mats.values()) {
        e.tex?.dispose();
        e.mat.dispose();
      }
      mats.clear();
    },
  };
}

/** A big classic board on two steel legs, printed both sides, with a catwalk and lamps. */
function classic(kit: Kit) {
  for (const x of [-3.2, 3.2]) {
    kit.box(1.0, 0.4, 1.0, x, 0, 2, CONCRETE);
    kit.box(0.45, 8.6, 0.45, x, 0.4, 2, STEEL);
  }
  for (const y of [3.0, 6.0]) kit.box(6.4, 0.25, 0.25, 0, y, 2, STEEL);
  kit.box(10.4, 5.4, 0.5, 0, 8.4, 2, FRAME);
  kit.box(10.4, 0.15, 1.0, 0, 8.25, 2.75, STEEL);
  for (const x of [-3.5, 0, 3.5]) {
    kit.box(0.1, 0.1, 1.1, x, 13.9, 2.7, STEEL);
    kit.box(0.55, 0.06, 0.32, x, 13.85, 3.2, LAMP);
  }
}

/** A giant unipole: one thick pole, a huge two-sided head, a catwalk and lamps that light it at night. */
function unipole(kit: Kit) {
  kit.cyl(1.3, 1.4, 0.6, 0, 0, 1.5, CONCRETE, 12);
  kit.cyl(0.6, 0.72, 14.4, 0, 0.6, 1.5, STEEL, 12);
  kit.box(14, 7.2, 0.5, 0, 14.5, 1.5, FRAME);
  kit.box(14, 0.15, 1.2, 0, 14.35, 2.45, STEEL);
  for (const x of [-5, 0, 5]) {
    kit.box(0.12, 0.12, 1.4, x, 21.7, 2.25, STEEL);
    kit.box(0.7, 0.3, 0.45, x, 21.55, 2.95, "#1F2226");
    kit.box(0.6, 0.06, 0.35, x, 21.52, 2.95, LAMP);
  }
}

/** A smart LED screen: two clad pillars carrying a deep black cabinet, a screen each side. */
/** A square board high on one pole, for logos and square pictures. */
function squareBoard(kit: Kit) {
  kit.cyl(1.1, 1.2, 0.6, 0, 0, 1.5, CONCRETE, 12);
  kit.cyl(0.5, 0.6, 9.8, 0, 0.6, 1.5, STEEL, 12);
  kit.box(8, 8, 0.5, 0, 10.4, 1.5, FRAME);
  kit.box(8, 0.15, 1.1, 0, 10.25, 2.4, STEEL);
  for (const x of [-2.5, 2.5]) {
    kit.box(0.12, 0.12, 1.4, x, 18.5, 2.25, STEEL);
    kit.box(0.6, 0.06, 0.35, x, 18.42, 2.95, LAMP);
  }
}

/** A tall portrait LED screen on a plinth, for posters and phone videos filmed upright. */
function tallScreen(kit: Kit) {
  kit.box(3.2, 3.2, 1.6, 0, 0, 1.5, "#D8D2C6");
  kit.box(3.3, 0.14, 1.7, 0, 2.2, 1.5, "#2E7D4F");
  kit.box(5.4, 9.5, 0.8, 0, 3.0, 1.5, BEZEL);
  kit.box(5.4, 0.2, 0.9, 0, 12.5, 1.5, "#2E7D4F");
}

function smartScreen(kit: Kit) {
  for (const x of [-4.6, 4.6]) {
    kit.box(1.4, 0.4, 1.4, x, 0, 1.5, CONCRETE);
    kit.box(0.9, 8.0, 0.9, x, 0.4, 1.5, "#D8D2C6");
    kit.box(0.92, 0.12, 0.92, x, 6.2, 1.5, "#2E7D4F");
  }
  kit.box(12.6, 6.6, 0.8, 0, 8.0, 1.5, BEZEL);
  kit.box(12.6, 0.2, 0.9, 0, 14.6, 1.5, "#2E7D4F");
  kit.box(1.4, 0.5, 0.82, 5.2, 7.5, 1.5, BEZEL);
}

/**
 * A poster ground: cleared earth with a timber-and-zinc hoarding at the back for flyers and civic
 * posters, and two stakes out front where more go up.
 */
function posterGround(kit: Kit) {
  kit.box(CELL - 0.6, 0.04, CELL - 0.6, 0, -0.02, 0, CLEARED);
  for (let x = -4.2; x <= 4.21; x += 2.1) kit.box(0.22, 3.1, 0.22, x, 0, -1.15, TIMBER);
  kit.box(8.7, 2.7, 0.12, 0, 0.3, -1.0, ZINC);
  kit.box(8.9, 0.14, 0.4, 0, 3.0, -1.0, TIMBER);
  const stake = (x: number, z: number, panel: string) => {
    kit.box(0.12, 1.7, 0.12, x, 0, z, TIMBER);
    kit.box(1.3, 0.9, 0.05, x, 1.2, z + 0.09, panel);
  };
  stake(-2.6, 2.4, "#2E7D4F");
  stake(2.9, 3.1, "#F4F1EA");
  for (const [x, z] of [[-3.6, 1.2], [1.4, 3.6], [3.8, 0.4]]) kit.box(0.5, 0.25, 0.4, x, 0, z, "#A89F90");
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function texture(c: HTMLCanvasElement) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** An empty plot's board before anyone books it: a framed box that says place your ad here. */
function plotBoardArt(font: string) {
  const { c, g } = canvas(1024, 512);
  g.fillStyle = "#F4F1EA";
  g.fillRect(0, 0, 1024, 512);
  g.strokeStyle = "#0E7A4B";
  g.lineWidth = 22;
  g.setLineDash([44, 26]);
  g.strokeRect(40, 40, 944, 432);
  g.setLineDash([]);
  g.fillStyle = "#0E7A4B";
  g.textAlign = "center";
  g.font = `112px ${font}`;
  g.fillText("Place your ad here", 512, 250);
  g.fillStyle = "#26355E";
  g.font = `46px ${font}`;
  g.fillText("Tap to book this plot. From ₦10,000 a day", 512, 350);
  return texture(c);
}

function billboardArt(font: string, town: string) {
  const { c, g } = canvas(1024, 512);
  const grad = g.createLinearGradient(0, 0, 1024, 512);
  grad.addColorStop(0, "#F2B705");
  grad.addColorStop(1, "#E67E22");
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "#26355E";
  g.textAlign = "center";
  g.font = `128px ${font}`;
  g.fillText("Your ad here", 512, 240);
  g.font = `52px ${font}`;
  g.fillText(`Reach everyone in ${town}`, 512, 340);
  g.font = `38px ${font}`;
  g.fillText("Tap to book. Shared by up to 6 businesses", 512, 430);
  return texture(c);
}

function attentionArt(font: string, town: string) {
  const { c, g } = canvas(1024, 504);
  g.fillStyle = "#14213D";
  g.fillRect(0, 0, 1024, 504);
  g.strokeStyle = "#F2B705";
  g.lineWidth = 14;
  g.strokeRect(18, 18, 988, 468);
  g.textAlign = "center";
  g.fillStyle = "#F2B705";
  g.font = `40px ${font}`;
  g.fillText("PRIME SPOT", 512, 110);
  g.fillStyle = "#FFFFFF";
  g.font = `112px ${font}`;
  g.fillText("Welcome to", 512, 240);
  g.fillText(fit(g, town, 900, 112, font), 512, 360);
  g.fillStyle = "#C9D3E6";
  g.font = `34px ${font}`;
  g.fillText("Everyone coming into town sees this board. Tap to advertise", 512, 440);
  return texture(c);
}

function squareArt(font: string) {
  const { c, g } = canvas(768, 768);
  g.fillStyle = "#F4F1EA";
  g.fillRect(0, 0, 768, 768);
  g.strokeStyle = "#26355E";
  g.lineWidth = 18;
  g.strokeRect(40, 40, 688, 688);
  g.fillStyle = "#26355E";
  g.textAlign = "center";
  g.font = `110px ${font}`;
  g.fillText("Your logo", 384, 330);
  g.fillText("here", 384, 450);
  g.font = `40px ${font}`;
  g.fillText("Square pictures fit perfectly. Tap to book", 384, 600);
  return texture(c);
}

function tallArt(font: string) {
  const { c, g } = canvas(576, 1024);
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, "#0B1F3A");
  grad.addColorStop(1, "#5A1846");
  g.fillStyle = grad;
  g.fillRect(0, 0, 576, 1024);
  g.fillStyle = "rgba(255,255,255,0.05)";
  for (let x = 0; x < 576; x += 8) g.fillRect(x, 0, 2, 1024);
  for (let y = 0; y < 1024; y += 8) g.fillRect(0, y, 576, 2);
  g.textAlign = "center";
  g.fillStyle = "#FFB3D9";
  g.font = `40px ${font}`;
  g.fillText("TALL SCREEN", 288, 260);
  g.fillStyle = "#FFFFFF";
  g.font = `92px ${font}`;
  g.fillText("Your", 288, 430);
  g.fillText("phone", 288, 530);
  g.fillText("video", 288, 630);
  g.fillStyle = "#E8D2E0";
  g.font = `34px ${font}`;
  g.fillText("Filmed upright? It fits", 288, 760);
  g.fillText("Tap to book", 288, 820);
  return texture(c);
}

function smartArt(font: string, town: string) {
  const { c, g } = canvas(1024, 512);
  const grad = g.createLinearGradient(0, 0, 1024, 512);
  grad.addColorStop(0, "#0B1F3A");
  grad.addColorStop(1, "#0E5A3C");
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  // The LED grid, faintly.
  g.fillStyle = "rgba(255,255,255,0.05)";
  for (let x = 0; x < 1024; x += 8) g.fillRect(x, 0, 2, 512);
  for (let y = 0; y < 512; y += 8) g.fillRect(0, y, 1024, 2);
  g.textAlign = "center";
  g.fillStyle = "#4BE38A";
  g.font = `44px ${font}`;
  g.fillText("SMART SCREEN", 512, 120);
  g.fillStyle = "#FFFFFF";
  g.font = `104px ${font}`;
  g.fillText("Your video here", 512, 260);
  g.fillStyle = "#C9E8D6";
  g.font = `40px ${font}`;
  g.fillText(`Video ads up to 15 seconds, day and night in ${town}`, 512, 360);
  g.font = `34px ${font}`;
  g.fillText("Tap to book", 512, 440);
  return texture(c);
}

/** Neutral civic posters and empty spaces for flyers. Never a party: see the neutrality rules. */
function posterArt(font: string) {
  const { c, g } = canvas(1024, 268);
  g.fillStyle = "#9AA3A8";
  g.fillRect(0, 0, 1024, 268);
  const posters: [string, string, string, string][] = [
    ["#2E7D4F", "#FFFFFF", "GET YOUR", "PVC"],
    ["#F4F1EA", "#14213D", "YOUR FLYER", "HERE"],
    ["#14213D", "#F2B705", "VOTE", "14 NOV"],
    ["#F4F1EA", "#14213D", "YOUR FLYER", "HERE"],
    ["#C0392B", "#FFFFFF", "KNOW YOUR", "POLLING UNIT"],
  ];
  const w = 1024 / posters.length;
  posters.forEach(([bg, ink, top, big], i) => {
    const x = i * w + 10;
    const tilt = ((i * 37) % 7) - 3;
    g.save();
    g.translate(x + (w - 20) / 2, 134);
    g.rotate((tilt * Math.PI) / 180);
    g.fillStyle = bg;
    g.fillRect(-(w - 20) / 2, -116, w - 20, 232);
    g.strokeStyle = "rgba(0,0,0,0.25)";
    g.lineWidth = 3;
    g.strokeRect(-(w - 20) / 2, -116, w - 20, 232);
    g.fillStyle = ink;
    g.textAlign = "center";
    g.font = `30px ${font}`;
    g.fillText(top, 0, -40);
    g.font = `${big.length > 8 ? 30 : 54}px ${font}`;
    g.fillText(big, 0, 30);
    g.restore();
  });
  return texture(c);
}

/** The town's name, shrunk until it fits the board. */
function fit(g: CanvasRenderingContext2D, text: string, max: number, size: number, font: string) {
  let s = size;
  g.font = `${s}px ${font}`;
  while (s > 40 && g.measureText(text).width > max) g.font = `${(s -= 6)}px ${font}`;
  return text;
}
