// The town in 3D, drawn with three.js: turn it all the way round, tilt it, zoom from the whole town down
// to the street. Same job and same handle as the 2D GameMap: draws any grid town, follows the player,
// and only ever writes to the store by selecting a place.
import {
  AmbientLight, CanvasTexture, Color, ConeGeometry, DirectionalLight, DoubleSide, Fog, Group,
  HemisphereLight, Mesh, MeshBasicMaterial, MeshLambertMaterial, PCFShadowMap, PerspectiveCamera, Raycaster,
  MOUSE, RingGeometry, Scene, TOUCH, Sprite, SpriteMaterial, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
  BoxGeometry as Box, type BufferGeometry, type Object3D,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GameStore, GameStoreApi } from "../store/game";
import { debugMode } from "../store/clock";
import { easeInOut } from "../sim/world";
import { nightLevel, worldT } from "../sim/time";
import { standAt } from "../world/layout";
import { pointAlong, router, type MapRoute } from "../world/routing";
import type { Point, WorldMap } from "../world/types";
import type { MapCallbacks } from "../world/GameMap";
import { attireFor } from "../data/attire";
import { outfitAttire } from "../data/shops";
import { LGA } from "../data/geography";
import { Avatar, loadPeople, type People } from "./avatar";
import { Character, RUN_SPEED, WALK_SPEED } from "./character";
import { CELL, PLOT_H, toWorld } from "./coords";
import { listenForTaps } from "./tap";
import { StreetLife, vehicleGeometry, type VehicleKind } from "./life";
import { rng } from "./coords";

/** Which vehicle each way of travelling uses. Walking has none. */
const RIDE_VEHICLE: Record<string, VehicleKind> = { keke: "keke", okada: "okada", bus: "danfo", danfo: "danfo", ride: "car", suv: "car", horse: "horse" };
import { groundOf, step, type Spot } from "./roam";
import { cellAt, isLotCode } from "../world/town";
import { buildScene, type BuiltScene } from "./scene";
import { buildRoadside } from "./roadside";

const SKY = new Color("#BFD3DE");
const NIGHT_SKY = new Color("#1A2340");
const SIGN_BG = "#26355e";
const SIGN_TEXT = "#f7e7c1";

function cssFont(varName: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

/** A name sign as a sprite that always faces the camera and keeps its size on screen. */
function sign(text: string, font: string, big = false): Sprite {
  const scale = 2;
  const size = big ? 30 : 15;
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  g.font = `${size * scale}px ${font}`;
  const w = Math.ceil(g.measureText(text).width) + 26 * scale;
  const h = (size + 13) * scale;
  c.width = w;
  c.height = h;
  g.font = `${size * scale}px ${font}`;
  if (big) {
    g.lineWidth = 8 * scale;
    g.strokeStyle = SIGN_TEXT;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.strokeText(text, w / 2, h / 2);
    g.fillStyle = SIGN_BG;
    g.fillText(text, w / 2, h / 2);
  } else {
    g.fillStyle = SIGN_BG;
    g.strokeStyle = SIGN_TEXT;
    g.lineWidth = 1.5 * scale;
    g.beginPath();
    g.roundRect(1, 1, w - 2, h - 2, 6 * scale);
    g.fill();
    g.stroke();
    g.fillStyle = SIGN_TEXT;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + scale);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const s = new Sprite(new SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false, transparent: true }));
  const k = 0.0008 / scale;
  s.scale.set(w * k, h * k, 1);
  s.center.set(0.5, 0);
  s.renderOrder = 10;
  return s;
}

export class Town3D {
  private renderer!: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(42, 1, 1, 4000);
  private controls!: OrbitControls;
  private sun = new DirectionalLight("#FFF1D6", 2.4);
  private hemi = new HemisphereLight("#E4EEF5", "#8A7556", 1.4);
  private ambient = new AmbientLight("#ffffff", 0.25);
  private built!: BuiltScene;
  private hits = new Group();
  /** The edge billboards: their carousel timer, ads subscription and videos stop with the town. */
  private roadside: ReturnType<typeof buildRoadside> | null = null;
  private signs = new Group();
  private districts = new Group();
  private player = new Group();
  private figure: Character | Avatar | null = null;
  /** The real people models, once loaded; until then the player is drawn in code. */
  private people: { set: People; clone: (o: Object3D) => Object3D } | null = null;
  /** Where the player is walking freely, or null when they stand outside their place or ride. */
  private roam: { x: number; z: number } | null = null;
  private heading = 0;
  /** A spot tapped on the ground to walk to. */
  private walkTo: { x: number; z: number } | null = null;
  private keys = new Set<string>();
  private keyMap: Record<string, [number, number]> = {};
  private walkable: (x: number, z: number) => Spot = () => ({ kind: "free" });
  private lastFrame = performance.now();
  private arriving = false;
  private bumped: { id: string; at: number } | null = null;
  private marker = new Mesh(new ConeGeometry(0.45, 0.9, 4), new MeshBasicMaterial({ color: "#F2B705" }));
  private ring = new Mesh(new RingGeometry(4.0, 4.6, 40), new MeshBasicMaterial({ color: "#F2B705", transparent: true, side: DoubleSide }));
  private ray = new Raycaster();
  private route: ReturnType<typeof router> | null = null;
  private tripPath: { key: number; pts: Point[] } | null = null;
  private following = false;
  /** The camera is being dragged: do not pull it back to the player meanwhile. */
  private dragging = false;
  /** Where the camera is gliding to (centre on me), or null. */
  private glide: Vector3 | null = null;
  /** The opening swoop from high over the town down to the player. */
  private flyIn: { to: Vector3; t0: number; ms: number } | null = null;
  private lastShadow = new Vector3(1e9, 0, 0);
  private lastTarget = new Vector3();
  private life: StreetLife | null = null;
  private rideKind: VehicleKind | null = null;
  private rideMesh: Mesh | null = null;
  private rideGeos = new Map<VehicleKind, BufferGeometry>();
  private lastNight = -1;
  private unsub: (() => void)[] = [];
  private resize: ResizeObserver | null = null;
  private destroyed = false;
  private host!: HTMLElement;
  private lookKey = "";

  private constructor(
    private store: GameStoreApi,
    private cb: MapCallbacks,
    private map: WorldMap,
  ) {}

  static async create(host: HTMLElement, store: GameStoreApi, cb: MapCallbacks, map: WorldMap): Promise<Town3D> {
    const t = new Town3D(store, cb, map);
    await t.init(host);
    return t;
  }

  private get grid() {
    return this.map.grid!;
  }

  private ground(p: Point) {
    return toWorld(this.grid, p);
  }

  private async init(host: HTMLElement) {
    this.host = host;
    const slow = (navigator.hardwareConcurrency ?? 8) <= 4;
    const r = new WebGLRenderer({ antialias: !slow, powerPreference: "high-performance" });
    this.renderer = r;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, slow ? 1.25 : 2));
    r.setSize(host.clientWidth, host.clientHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFShadowMap;
    r.shadowMap.autoUpdate = false;
    host.appendChild(r.domElement);
    r.domElement.style.touchAction = "none";
    r.domElement.style.display = "block";

    const sign1 = cssFont("--font-lilita", "'Lilita One', 'Arial Black', sans-serif");
    await document.fonts?.load(`16px ${sign1}`).catch(() => {});
    // Let the loading screen paint before the town is built.
    await new Promise((done) => setTimeout(done, 60));
    if (this.destroyed) return;

    // The town itself, baked into chunks.
    const t0 = performance.now();
    this.built = buildScene(this.map);
    if (process.env.NODE_ENV !== "production") console.info(`3D town built in ${Math.round(performance.now() - t0)} ms`);
    const mat = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });
    for (const c of this.built.chunks) {
      c.geometry.computeBoundingSphere();
      const m = new Mesh(c.geometry, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    }

    // Light: a warm harmattan sun low in the west, and a sky that fills the shadows.
    this.scene.background = SKY.clone();
    this.scene.fog = new Fog(SKY.clone(), 300, 900);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(slow ? 1024 : 2048, slow ? 1024 : 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target, this.hemi, this.ambient);

    // Invisible boxes to tap places by, and their name signs.
    const hidden = new MeshBasicMaterial({ visible: false });
    for (const p of this.built.places) {
      const box = new Mesh(new Box(9, Math.max(4, p.top), 9), hidden);
      box.position.set(p.x, Math.max(4, p.top) / 2, p.z);
      box.userData.id = p.id;
      this.hits.add(box);
      const place = this.map.places.find((q) => q.id === p.id)!;
      // Your home is labelled Home, wherever it is (in Ilorin, a room in Tanke Compound).
      const s = sign(p.id === "home" ? "Home" : place.name, sign1);
      s.position.set(p.x, p.top + 1.2, p.z);
      this.signs.add(s);
    }
    // Names written on the map: a shore road, a promenade, the lagoon.
    for (const l of this.map.labels ?? []) {
      const s = sign(l.text, sign1, true);
      const w = this.ground(l);
      s.position.set(w.x, 6, w.z);
      this.districts.add(s);
      const small = sign(l.text, sign1);
      small.position.set(w.x, 3, w.z);
      this.signs.add(small);
    }
    // Names for things that are not places you visit: a campus senate, student hostels.
    for (const l of this.built.labels) {
      const s = sign(l.text, sign1);
      s.position.set(l.x, l.y, l.z);
      this.signs.add(s);
    }
    this.scene.add(this.hits, this.signs);
    for (const d of this.map.districts ?? []) {
      const s = sign(d.name.toUpperCase(), sign1, true);
      const w = this.ground(d);
      s.position.set(w.x, 30, w.z);
      this.districts.add(s);
    }
    this.scene.add(this.districts);
    // Ads stand only on open land outside town (the owner's rule): billboards, giant unipoles, smart
    // screens and poster grounds, each face running its own carousel of booked ads.
    const roadside = (this.roadside = buildRoadside(this.map, sign1));
    this.scene.add(roadside.group);
    if (roadside.hits.length) this.hits.add(...roadside.hits);
    // ?debug in a dev build: reach the camera from the console or a screenshot script.
    if (debugMode()) (window as unknown as { town3d?: Town3D }).town3d = this;

    this.ring.rotation.x = -Math.PI / 2;
    this.scene.add(this.ring);
    this.marker.rotation.x = Math.PI;
    this.player.add(this.marker);
    this.scene.add(this.player);
    this.setLook(this.store.getState());

    // Camera: drag to move, twist or right-drag to turn round, pinch or scroll to zoom, tilt by turning up.
    const c = new OrbitControls(this.camera, r.domElement);
    this.controls = c;
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.screenSpacePanning = false;
    c.minDistance = 18;
    c.maxDistance = 520;
    c.minPolarAngle = 0.25;
    c.maxPolarAngle = 1.32;
    // Drag (one finger) slides the map, right-drag (two-finger twist) turns it round, wheel or pinch zooms.
    c.mouseButtons = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE };
    c.touches = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE };
    c.zoomToCursor = true;
    c.addEventListener("end", () => (this.dragging = false));
    c.addEventListener("start", () => {
      this.dragging = true;
      this.following = false;
      this.glide = null;
      this.flyIn = null;
    });

    const start = this.ground(standAt(this.map, this.store.getState().game.loc));
    c.target.set(start.x, 0, start.z);
    this.camera.position.set(start.x + 55, 70, start.z + 55);
    // Open high over the whole town and swoop down to the player.
    if (!this.store.getState().reducedMotion && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.flyIn = { to: this.camera.position.clone(), t0: performance.now(), ms: 2600 };
    }
    this.onResize();
    c.update();

    this.route = router(this.map);
    this.life = new StreetLife({ scene: this.scene, map: this.map, graph: this.route.graph, fields: this.built.fields, slow });
    this.walkable = groundOf(this.map);
    this.listenForTaps();
    this.listenForKeys();
    this.resize = new ResizeObserver(() => this.onResize());
    this.resize.observe(host);
    this.unsub.push(
      this.store.subscribe((s, prev) => {
        if (s.game.char !== prev.game.char || s.game.citizen !== prev.game.citizen || s.game.outfit !== prev.game.outfit) this.setLook(s);
        if (s.activity?.kind === "trip" && prev.activity?.kind !== "trip") {
          this.following = true;
          this.roam = null;
        }
        // Moved by a trip or a journey, not by walking: stand outside the new place.
        if (s.game.loc !== prev.game.loc && !this.arriving) this.roam = null;
        if (s.selected !== prev.selected) {
          const p = this.built.places.find((q) => q.id === s.selected);
          const t = this.controls.target;
          if (p && Math.hypot(p.x - t.x, p.z - t.z) > 40) this.glide = new Vector3(p.x, 0, p.z);
        }
      }),
    );
    r.setAnimationLoop(this.frame);
    // Swap in the real person once the models arrive.
    Promise.all([loadPeople(), import("three/examples/jsm/utils/SkeletonUtils.js")])
      .then(([set, { clone }]) => {
        if (this.destroyed) return;
        this.people = { set, clone };
        this.life?.setPeople(set, clone);
        this.lookKey = "";
        this.setLook(this.store.getState());
      })
      .catch(() => {
        // No models (offline, or not built): the drawn figure stays.
      });
  }

  private onResize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** A tap (not a drag) on a place selects it. */
  private listenForTaps() {
    const el = this.renderer.domElement;
    const onTap = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const ndc = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.ray.setFromCamera(ndc, this.camera);
      const hit = this.ray.intersectObjects(this.hits.children, false)[0];
      if (hit?.object.userData.board) this.cb.onBillboard?.(hit.object.userData.board as string);
      else if (hit) this.store.getState().select(hit.object.userData.id as string);
      // Open ground does nothing: on the town map you walk with the keys, and a drag pans (the owner's call).
    };
    this.unsub.push(listenForTaps(el, onTap));
  }

  private setLook(s: GameStore) {
    const ch = s.game.char;
    // Dressed for their home state; the hand-built Ilorin map is in Kwara.
    const home = s.game.citizen ? LGA[s.game.citizen.lgaCode]?.stateCode ?? "kwara" : "kwara";
    const key = `${ch?.g}|${ch?.cloth}|${ch?.skin}|${home}|${s.game.outfit}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    if (this.figure) {
      this.player.remove(this.figure.root);
      this.figure.dispose();
    }
    const look = { g: ch?.g ?? "m", skin: ch?.skin ?? "#6B3E26", cloth: ch?.cloth ?? "#2F7D7A" };
    const attire = outfitAttire(s.game.outfit, look.g) ?? attireFor(home, look.g);
    this.figure = this.people ? new Avatar(this.people.set, look, attire, this.people.clone) : new Character(look, attire);
    this.player.add(this.figure.root);
  }

  /** The trip's path along this town's streets. */
  private pathFor(from: string, to: string, key: number, fallback: Point[]): Point[] {
    if (this.tripPath?.key === key) return this.tripPath.pts;
    let pts = fallback;
    try {
      const r: MapRoute | undefined = this.route?.route(from, to);
      if (r) pts = [standAt(this.map, from), ...r.pts.slice(1, -1), standAt(this.map, to)];
    } catch {
      // A place this map does not have: use the sim's own line.
    }
    this.tripPath = { key, pts };
    return pts;
  }

  private frame = () => {
    if (this.destroyed) return;
    const st = this.store.getState();
    const now = performance.now();
    const c = this.controls;

    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    // The player: on a trip, walking freely, or standing outside a place.
    const a = st.activity;
    let pos = standAt(this.map, st.game.loc);
    let heading: number | null = null;
    /** The vehicle you booked, while you ride it. */
    let ride: VehicleKind | null = null;
    let speed = this.walk(st, dt);
    if (a?.kind === "trip") {
      const p = Math.min(1, Math.max(0, (now - a.startedAt) / a.ms));
      const path = this.pathFor(st.game.loc, a.trip.dest, a.startedAt, a.trip.route.pts);
      const at = pointAlong(path, easeInOut(p));
      pos = at;
      const ahead = this.ground(pointAlong(path, Math.min(1, easeInOut(p) + 0.01)));
      const here = this.ground(at);
      if (Math.hypot(ahead.x - here.x, ahead.z - here.z) > 0.01) heading = Math.atan2(ahead.x - here.x, ahead.z - here.z);
      speed = WALK_SPEED;
      ride = RIDE_VEHICLE[a.trip.mode] ?? null;
    }
    const g = this.roam && a?.kind !== "trip" ? this.roam : this.ground(pos);
    this.player.position.set(g.x, this.heightAt(g.x, g.z), g.z);
    if (heading !== null) this.heading = heading;
    if (this.figure) {
      this.figure.root.rotation.y = this.heading;
      this.figure.update(dt, st.reducedMotion ? 0 : speed);
      // Riding: you are inside (or on) the vehicle, which carries its own rider.
      this.figure.root.visible = !ride;
    }
    this.showRide(ride);
    this.player.visible = !(a?.kind === "action" && a.plan.action.goal === "fly");
    this.marker.position.y = 2.7 + (st.reducedMotion ? 0 : Math.sin(now / 200) * 0.25);

    // Camera follows trips until you drag away, and glides when asked to centre.
    if (this.following && a?.kind === "trip") this.panTo(g.x, g.z, 0.08);
    else if (!a) this.following = false;
    // Follow the player while they walk; once they stop, the camera stays where you leave it.
    if (this.roam && speed > 0 && !this.dragging) this.panTo(g.x, g.z, 0.3);
    if (this.glide) {
      this.panTo(this.glide.x, this.glide.z, 0.12);
      if (Math.hypot(c.target.x - this.glide.x, c.target.z - this.glide.z) < 0.3) this.glide = null;
    }
    // The opening swoop: from high and turned a quarter round, easing down to the street.
    if (this.flyIn) {
      const p = Math.min(1, (now - this.flyIn.t0) / this.flyIn.ms);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const off = this.flyIn.to.clone().sub(c.target);
      off.multiplyScalar(1 + (1 - e) * 4.5);
      off.y += (1 - e) * 260;
      off.applyAxisAngle(new Vector3(0, 1, 0), (1 - e) * 1.2);
      this.camera.position.copy(c.target).add(off);
      if (p >= 1) this.flyIn = null;
    }
    c.update();
    // Keep the camera over the town. Done after the controls' own smoothing, so the two never fight.
    const b = this.built.bounds;
    const cx = Math.min(b.maxX, Math.max(b.minX, c.target.x));
    const cz = Math.min(b.maxZ, Math.max(b.minZ, c.target.z));
    if (cx !== c.target.x || cz !== c.target.z) this.panTo(cx, cz, 1);

    // Traffic, herds, townspeople and football carry on unless the game is paused or a note is open.
    this.life?.update(dt, c.target, !st.paused && st.game.notes.length === 0 && !st.reducedMotion);

    // Selection ring.
    const sel = this.built.places.find((p) => p.id === st.selected);
    this.ring.visible = !!sel;
    if (sel) {
      this.ring.position.set(sel.x, 0.42, sel.z);
      (this.ring.material as MeshBasicMaterial).opacity = 0.6 + 0.4 * Math.sin(now / 250);
    }

    // Names: place signs up close, district names from high up.
    const dist = this.camera.position.distanceTo(c.target);
    this.signs.visible = dist < 260;
    this.districts.visible = dist > 200;
    const fog = this.scene.fog as Fog;
    fog.near = dist * 1.6;
    fog.far = dist * 4.5;
    fog.color.copy(this.scene.background as Color);

    // Depth range to suit the zoom: a near plane too close for the distance makes thin layers
    // (road paint, pavements, yards) flicker through each other.
    const near = Math.min(20, Math.max(0.5, dist * 0.02));
    if (Math.abs(this.camera.near - near) > near * 0.1) {
      this.camera.near = near;
      this.camera.far = dist * 10 + 800;
      this.camera.updateProjectionMatrix();
    }

    // The sun's shadow covers the view. Its size goes in steps and its centre snaps to whole shadow
    // pixels, so shadows hold still as you pan instead of shimmering or jumping.
    // From high up shadows are too small to see and too coarse to look clean: switch them off.
    // A gap between switching off and on again, so hovering at the edge never flips them every frame
    // (each flip rebuilds the shaders, which is what stutters).
    const shadows = this.sun.castShadow ? dist < 260 : dist < 200;
    if (this.sun.castShadow !== shadows) {
      this.sun.castShadow = shadows;
      this.renderer.shadowMap.needsUpdate = true;
    }
    const span = Math.pow(1.25, Math.round(Math.log(Math.min(320, Math.max(50, dist * 1.3))) / Math.log(1.25)));
    const texel = (2 * span) / this.sun.shadow.mapSize.x;
    const sx = Math.round(c.target.x / texel) * texel;
    const sz = Math.round(c.target.z / texel) * texel;
    // Redrawing shadows is the heaviest thing a frame can do, so never while the camera is moving: a
    // drag stays smooth and the shadows catch up the moment it settles.
    const moving = this.dragging || Math.hypot(c.target.x - this.lastTarget.x, c.target.z - this.lastTarget.z) > 0.02;
    this.lastTarget.copy(c.target);
    const due = Math.hypot(this.lastShadow.x - sx, this.lastShadow.z - sz) > span * 0.05 || this.sun.shadow.camera.right !== span;
    if (due && !moving) {
      this.lastShadow.set(sx, 0, sz);
      const sc = this.sun.shadow.camera;
      sc.left = -span;
      sc.right = span;
      sc.top = span;
      sc.bottom = -span;
      sc.near = 1;
      sc.far = 600;
      sc.updateProjectionMatrix();
      this.sun.position.set(sx - 120, 200, sz + 70);
      this.sun.target.position.set(sx, 0, sz);
      this.sun.target.updateMatrixWorld();
      // Push the shadow test out by about two shadow pixels, so flat ground does not shade itself in
      // stripes (shadow acne) when each pixel covers a lot of ground.
      this.sun.shadow.normalBias = texel * 2.2;
      this.sun.shadow.bias = -0.0004;
      this.renderer.shadowMap.needsUpdate = true;
    }

    // Day and night.
    const nl = nightLevel(worldT(st.game));
    if (Math.abs(nl - this.lastNight) > 0.01) {
      this.lastNight = nl;
      this.sun.intensity = 2.4 * (1 - 0.9 * nl);
      this.hemi.intensity = 1.4 * (1 - 0.6 * nl);
      (this.scene.background as Color).copy(SKY).lerp(NIGHT_SKY, nl);
    }

    this.renderer.render(this.scene, this.camera);
  };

  /** The vehicle under the player for this ride, built once per kind. */
  private showRide(kind: VehicleKind | null) {
    if (this.rideKind === kind) {
      if (this.rideMesh) this.rideMesh.rotation.y = this.heading;
      return;
    }
    this.rideKind = kind;
    if (this.rideMesh) this.player.remove(this.rideMesh);
    this.rideMesh = null;
    if (!kind) return;
    let geo = this.rideGeos.get(kind);
    if (!geo) {
      const colour = kind === "keke" ? "#F2B705" : kind === "okada" ? "#C0392B" : "#2B5C9A";
      this.rideGeos.set(kind, (geo = vehicleGeometry(kind, colour, rng(7))));
    }
    this.rideMesh = new Mesh(geo, new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }));
    this.rideMesh.castShadow = true;
    this.rideMesh.rotation.y = this.heading;
    this.player.add(this.rideMesh);
  }

  /** Ground height: plots are raised above the road. */
  private heightAt(x: number, z: number) {
    return isLotCode(cellAt(this.grid, Math.round(x / CELL), Math.round(z / CELL))) ? PLOT_H : 0.03;
  }

  private listenForKeys() {
    this.keyMap = {
      KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
      KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
    };
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    const down = (e: KeyboardEvent) => {
      if (typing(e) || !(e.code in this.keyMap || e.code.startsWith("Shift"))) return;
      this.keys.add(e.code);
      if (e.code.startsWith("Arrow")) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const blur = () => this.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    this.unsub.push(() => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    });
  }

  /**
   * Walk or run the player: with the keys (relative to where the camera looks), or to a spot tapped on
   * the ground. Stepping onto a place's plot goes in, under the game's own walking rules. Returns the
   * speed moved at.
   */
  private walk(st: GameStore, dt: number): number {
    let x = 0;
    let y = 0;
    for (const k of this.keys) {
      const d = this.keyMap[k];
      if (d) {
        x += d[0];
        y += d[1];
      }
    }
    const busy = !!st.activity || st.game.notes.length > 0 || !st.game.char || !!st.journey;
    const keyed = Math.hypot(x, y) > 0.1;
    if (busy || (!keyed && !this.walkTo)) {
      if (busy) this.walkTo = null;
      return 0;
    }
    if (!this.roam) {
      const g = this.ground(standAt(this.map, st.game.loc));
      this.roam = { x: g.x, z: g.z };
    }
    const run = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const speed = run ? RUN_SPEED : WALK_SPEED;
    let dx: number;
    let dz: number;
    if (keyed) {
      this.walkTo = null;
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
      // Forward is the way the camera looks, flattened onto the ground.
      const f = this.controls.target.clone().sub(this.camera.position);
      f.y = 0;
      f.normalize();
      dx = (f.x * y - f.z * x) * speed * dt;
      dz = (f.z * y + f.x * x) * speed * dt;
    } else {
      const to = this.walkTo!;
      const gx = to.x - this.roam.x;
      const gz = to.z - this.roam.z;
      const far = Math.hypot(gx, gz);
      if (far < 0.3) {
        this.walkTo = null;
        return 0;
      }
      const s = Math.min(far, speed * dt) / far;
      dx = gx * s;
      dz = gz * s;
    }
    this.heading = Math.atan2(dx, dz);
    const r = step(this.walkable, this.roam.x, this.roam.z, dx, dz);
    // Walked into a wall on the way to a tapped spot: stop rather than push against it.
    if (!keyed && r.x === this.roam.x && r.z === this.roam.z) this.walkTo = null;
    this.roam.x = r.x;
    this.roam.z = r.z;
    if (r.place && r.place !== st.game.loc) {
      this.walkTo = null;
      this.walkInto(r.place);
    }
    return speed;
  }

  /** Walked onto a place's plot: go in, or say why not (once, not every frame you push against it). */
  private walkInto(id: string) {
    const now = performance.now();
    if (this.bumped?.id === id && now - this.bumped.at < 2500) return;
    this.bumped = { id, at: now };
    this.arriving = true;
    const why = this.store.getState().arrive(id);
    this.arriving = false;
    if (why && why !== "Wait a moment") this.store.setState({ toasts: [...this.store.getState().toasts, why] });
  }

  /** Move the camera and what it looks at together, a share of the way there. */
  private panTo(x: number, z: number, k: number) {
    const c = this.controls;
    const dx = (x - c.target.x) * k;
    const dz = (z - c.target.z) * k;
    c.target.x += dx;
    c.target.z += dz;
    this.camera.position.x += dx;
    this.camera.position.z += dz;
  }

  zoomBy(factor: number) {
    const c = this.controls;
    const off = this.camera.position.clone().sub(c.target).multiplyScalar(1 / factor);
    const d = Math.min(c.maxDistance, Math.max(c.minDistance, off.length()));
    this.camera.position.copy(c.target).add(off.setLength(d));
  }

  /** Turn the view round the point it looks at. */
  rotateBy(radians: number) {
    const c = this.controls;
    const off = this.camera.position.clone().sub(c.target);
    off.applyAxisAngle(new Vector3(0, 1, 0), radians);
    this.camera.position.copy(c.target).add(off);
  }

  centerOnMe() {
    const st = this.store.getState();
    const g = this.ground(standAt(this.map, st.game.loc));
    this.glide = new Vector3(g.x, 0, g.z);
    if (st.reducedMotion) {
      this.panTo(g.x, g.z, 1);
      this.glide = null;
    }
  }

  setActive(active: boolean) {
    this.renderer?.setAnimationLoop(active ? this.frame : null);
  }

  destroy() {
    this.destroyed = true;
    this.roadside?.dispose();
    this.unsub.forEach((u) => u());
    this.resize?.disconnect();
    this.figure?.dispose();
    this.life?.dispose();
    this.controls?.dispose();
    this.renderer?.setAnimationLoop(null);
    this.scene.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
