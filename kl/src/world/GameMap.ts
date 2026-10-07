// The Pixi world map: building tiles, billboards, traffic, the player and the camera.
// Draws any WorldMap, so the hand-built Ilorin map, maps built from OpenStreetMap
// and generated maps all go through the same renderer.
// Reads the game store; never writes game state except selecting a place.
import { Application, Assets, Container, Graphics, PerspectiveMesh, Sprite, Text, Texture, type Ticker } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { BIOMES } from "../data/biomes";
import type { GameStore, GameStoreApi } from "../store/game";
import { easeInOut } from "../sim/world";
import { nightLevel } from "../sim/time";
import type { ModeId } from "../sim/travel";
import {
  AVATAR_ART, AVATAR_H, BILLBOARD_ART, BILLBOARD_FACE, BILLBOARD_W, TILE_BASE, TILE_W,
  TRAFFIC_W, VEHICLE_ART, VEHICLE_W,
} from "./art";
import { buildGround } from "./ground";
import { ilorinTown } from "./ilorin-town";
import { billboardPositions, hitTest, standAt, tileBase } from "./layout";
import { pointAlong, router, type MapRoute, type RoadGraph } from "./routing";
import { drawTile, KIND_ART } from "./tiles";
import { lookTile, sharedTile, tileFor, type LookTile } from "./tile-art";
import { drawShacks } from "./shacks";
import { buildTownGround } from "./town-ground";
import { Traffic } from "./traffic";
import type { MapPlace, Point, WorldMap } from "./types";
import { ALL_VEHICLE_ART } from "./vehicles";

/** Vehicle sprite for each transport mode on any map (danfo, ride-hailing and SUV reuse the nearest sprite). */
const SPRITE_FOR_MODE: Record<string, ModeId> = {
  walk: "walk", keke: "keke", okada: "okada", bus: "bus", horse: "horse", danfo: "bus", ride: "keke", suv: "keke",
};

export interface MapCallbacks {
  onBillboard?: (slotId: string) => void;
}

interface Car {
  /** Vertex the car came from and the one it is heading to. */
  a: number;
  b: number;
  t: number;
  speed: number;
  sprite: Sprite;
}

const SIGN_BG = 0x26355e;
const SIGN_TEXT = 0xf7e7c1;

function cssFont(varName: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

/** Warm round glow for lit buildings at night. */
function glowTexture(): Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,214,107,0.9)");
  grad.addColorStop(0.4, "rgba(255,190,80,0.35)");
  grad.addColorStop(1, "rgba(255,170,60,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return Texture.from(c);
}

/** What an unbooked billboard shows. */
function placeholderAd(font: string, where: string): Texture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#F2B705";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#26355E";
  ctx.fillRect(0, 196, 512, 60);
  ctx.textAlign = "center";
  ctx.fillStyle = "#26355E";
  ctx.font = `64px ${font}`;
  ctx.fillText("Your ad here", 256, 120);
  ctx.fillStyle = "#F7E7C1";
  ctx.font = `30px ${font}`;
  ctx.fillText(`Reach every ${where} player`, 256, 238);
  return Texture.from(c);
}

/**
 * While developing, a map can be dropped on the window before the canvas starts,
 * so any LGA map can be opened without wiring it through the UI. Never in production.
 */
function devMap(): WorldMap | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  return (window as unknown as { __naijaMap?: WorldMap }).__naijaMap;
}

/** A camera position for screenshots, set on the window before the canvas starts. Never in production. */
function devView(): { zoom: number; x?: number; y?: number } | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  return (window as unknown as { __naijaView?: { zoom: number; x?: number; y?: number } }).__naijaView;
}

export class GameMap {
  private app = new Application();
  private viewport!: Viewport;
  private store: GameStoreApi;
  private cb: MapCallbacks;
  private map: WorldMap;
  private graph!: RoadGraph;
  private unsub: (() => void)[] = [];

  private tileHeights: Record<string, number> = {};
  private boards: Record<string, Point> = {};
  private boardH = 0;
  private ring = new Graphics();
  private night = new Graphics();
  private glows: Record<string, Sprite> = {};
  private lit: Record<string, Graphics> = {};
  private player = new Container();
  private walker!: Sprite;
  private vehicle = new Sprite();
  private bubble = new Container();
  private bubbleText!: Text;
  private bubbleBg = new Graphics();
  /** Bouncing marker above the player's head so you can always find yourself. */
  private marker = new Graphics();
  private cars: Car[] = [];
  private traffic: Traffic | null = null;
  private loaded = new Set<string>();
  private route: ReturnType<typeof router> | null = null;
  /** The path the current trip is drawn along, worked out once per trip. */
  private tripPath: { key: number; pts: Point[] } | null = null;
  /** District names: shown when zoomed out, like neighbourhood names on a map. */
  private districtLabels = new Container();
  private following = false;
  private lastNight = -1;
  private destroyed = false;

  private constructor(store: GameStoreApi, cb: MapCallbacks, map: WorldMap) {
    this.store = store;
    this.cb = cb;
    this.map = map;
  }

  /** The map defaults to Ilorin, now built as a grid town like every other LGA. */
  static async create(host: HTMLElement, store: GameStoreApi, cb: MapCallbacks = {}, map?: WorldMap): Promise<GameMap> {
    const m = new GameMap(store, cb, map ?? devMap() ?? ilorinTown());
    await m.init(host);
    return m;
  }

  private place(id: string): MapPlace | undefined {
    return this.map.places.find((p) => p.id === id);
  }

  private tilePos(id: string): Point {
    const p = this.place(id);
    return p ? { x: p.x, y: p.y } : { x: 0, y: 0 };
  }

  private async init(host: HTMLElement) {
    const map = this.map;
    const W = map.width;
    const H = map.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    await this.app.init({
      resizeTo: host,
      resolution: dpr,
      autoDensity: true,
      antialias: dpr < 2,
      background: parseInt(BIOMES[map.biome].ground.replace("#", ""), 16),
      preference: "webgl",
      powerPreference: "low-power",
    });
    if (this.destroyed) return;
    // Mid-range phones: 30fps is plenty for a city map and saves battery.
    if ((navigator.hardwareConcurrency ?? 8) <= 4) this.app.ticker.maxFPS = 30;
    host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = "none";

    const ui = cssFont("--font-figtree", "Figtree, system-ui, sans-serif");
    const sign = cssFont("--font-lilita", "'Lilita One', 'Arial Black', sans-serif");
    await Promise.all([document.fonts?.load(`16px ${sign}`), document.fonts?.load(`800 13px ${ui}`)]).catch(() => {});
    // Only the art this map actually uses, so a phone on mobile data loads less.
    // A file that is missing or fails is simply drawn in code instead.
    const art = new Set<string>([...Object.values(AVATAR_ART), ...Object.values(VEHICLE_ART), BILLBOARD_ART]);
    for (const p of map.places) {
      const src = this.artFor(p);
      if (src) art.add(src);
    }
    for (const b of map.buildings ?? []) if (b.art ?? this.buildingArt(b.kind)) art.add((b.art ?? this.buildingArt(b.kind))!);
    if (map.grid) for (const v of ALL_VEHICLE_ART) art.add(v);
    const results = await Promise.allSettled([...art].map((src) => Assets.load(src).then(() => src)));
    for (const r of results) if (r.status === "fulfilled") this.loaded.add(r.value);
    if (this.destroyed) return;

    this.route = router(map);
    this.graph = this.route.graph;
    this.boards = billboardPositions(map);

    const vp = new Viewport({
      screenWidth: host.clientWidth,
      screenHeight: host.clientHeight,
      worldWidth: W,
      worldHeight: H,
      events: this.app.renderer.events,
      passiveWheel: false,
    });
    this.viewport = vp;
    this.app.stage.addChild(vp);
    vp.drag()
      .pinch()
      .wheel({ smooth: 4 })
      .decelerate({ friction: 0.93 })
      .clampZoom({ minWidth: 420, maxWidth: Math.max(W, H / 0.7) * 1.02 })
      .clamp({ left: -200, right: W + 200, top: -200, bottom: H + 200, underflow: "center" });
    vp.on("drag-start", () => (this.following = false));
    vp.on("pinch-start", () => (this.following = false));
    vp.on("clicked", (e) => this.onTap(e.world.x, e.world.y));
    this.app.renderer.on("resize", (w: number, h: number) => vp.resize(w, h, W, H));

    vp.addChild(map.grid ? buildTownGround(map, { ui, sign }) : buildGround(map, { ui }));
    vp.addChild(this.ring);

    // Buildings and billboards share one layer, drawn back to front.
    const things = new Container();
    things.sortableChildren = true;
    vp.addChild(things);
    const biome = BIOMES[map.biome];
    const base = tileBase(map);
    // The town's ordinary buildings, each on its own plot, turned to face its street.
    for (const b of map.buildings ?? []) {
      const src = b.art ?? this.buildingArt(b.kind);
      const c = new Container();
      if (src && this.loaded.has(src)) {
        const s = new Sprite(Texture.from(src));
        s.anchor.set(0.5, 1);
        const k = TILE_W / s.texture.width;
        s.scale.set(b.flip ? -k : k, k);
        s.position.set(0, base);
        c.addChild(s);
      } else if (b.kind === "shacks") {
        const g = new Graphics();
        drawShacks(g, Math.round(b.x * 7 + b.y * 13));
        g.position.set(0, base - 18);
        c.addChild(g);
      } else {
        const g = new Graphics();
        drawTile(g, "house", biome);
        g.position.set(0, base - TILE_BASE);
        c.addChild(g);
      }
      c.position.set(b.x, b.y);
      c.zIndex = b.y + base;
      c.cullable = true;
      things.addChild(c);
    }
    for (const p of map.places) {
      const src = this.artFor(p);
      const c = new Container();
      let height = TILE_W;
      if (src && this.loaded.has(src)) {
        const s = new Sprite(Texture.from(src));
        s.anchor.set(0.5, 1);
        const k = TILE_W / s.texture.width;
        s.scale.set(p.flip ? -k : k, k);
        s.position.set(0, base);
        c.addChild(s);
        height = s.height;
      } else {
        // No art for this kind yet, so draw a clean tile in code.
        const g = new Graphics();
        const drawn = drawTile(g, p.kind, biome, p.variant ? { variant: p.variant } : {});
        c.addChild(g);
        height = -drawn.top;
        if (drawn.glow.length) {
          const lit = new Graphics();
          for (const w of drawn.glow) lit.rect(w.x, w.y, w.w, w.h).fill(0xffd66b);
          lit.alpha = 0;
          c.addChild(lit);
          this.lit[p.id] = lit;
        }
      }
      if (!(src && this.loaded.has(src))) c.children[0]?.position.set(0, base - TILE_BASE);
      c.position.set(p.x, p.y);
      c.zIndex = p.y + base;
      c.cullable = true;
      things.addChild(c);
      this.tileHeights[p.id] = height;
    }

    const adFace = placeholderAd(sign, map.name);
    for (const b of Object.values(this.boards)) {
      const board = new Container();
      const s = new Sprite(Texture.from(BILLBOARD_ART));
      const k = BILLBOARD_W / s.texture.width;
      s.anchor.set(0.5, 1);
      s.scale.set(k);
      board.addChild(s);
      // Ad picture warped onto the board face.
      const ox = -s.texture.width / 2;
      const oy = -s.texture.height;
      const [tl, tr, br, bl] = BILLBOARD_FACE.map(([x, y]) => [(x + ox) * k, (y + oy) * k]);
      board.addChild(
        new PerspectiveMesh({
          texture: adFace, verticesX: 6, verticesY: 6,
          x0: tl[0], y0: tl[1], x1: tr[0], y1: tr[1], x2: br[0], y2: br[1], x3: bl[0], y3: bl[1],
        }),
      );
      board.position.set(b.x, b.y);
      board.zIndex = b.y;
      board.cullable = true;
      things.addChild(board);
      this.boardH = s.height;
    }

    // Night shade, then window glow on top of it.
    this.night.rect(-3000, -3000, W + 6000, H + 6000).fill(0x0d1838);
    this.night.alpha = 0;
    vp.addChild(this.night);
    const glowTex = glowTexture();
    const glowLayer = new Container();
    vp.addChild(glowLayer);
    for (const p of map.places) {
      const gs = new Sprite(glowTex);
      gs.anchor.set(0.5);
      gs.blendMode = "add";
      gs.width = 280;
      gs.height = 190;
      gs.position.set(p.x, p.y - 30);
      gs.alpha = 0;
      glowLayer.addChild(gs);
      this.glows[p.id] = gs;
    }

    // Traffic is depth-sorted with the buildings so tiles hide cars passing behind them.
    if (map.grid) {
      const lightsLayer = new Container();
      this.traffic = new Traffic(map, this.graph, things, lightsLayer, (src) => this.loaded.has(src));
      things.addChild(lightsLayer);
      lightsLayer.zIndex = 1e9;
    } else this.initTraffic(things);

    // Place name signs stay readable above buildings.
    const signs = new Container();
    vp.addChild(signs);
    for (const p of map.places) {
      const top = p.y + base - this.tileHeights[p.id];
      const t = new Text({ text: p.name, style: { fontFamily: sign, fontSize: 15, fill: SIGN_TEXT } });
      t.anchor.set(0.5);
      const w = Math.max(92, t.width + 26);
      const bg = new Graphics().roundRect(-w / 2, -13, w, 26, 5).fill(SIGN_BG).stroke({ width: 1.5, color: SIGN_TEXT });
      const c = new Container();
      c.addChild(bg, t);
      c.position.set(p.x, Math.max(top + 4, p.y - 150));
      c.cullable = true;
      signs.addChild(c);
    }

    for (const d of map.districts ?? []) {
      const t = new Text({
        text: d.name.toUpperCase(),
        style: { fontFamily: sign, fontSize: 64, fill: 0x26355e, letterSpacing: 6, stroke: { color: 0xf7e7c1, width: 10 } },
      });
      t.anchor.set(0.5);
      t.position.set(d.x, d.y);
      this.districtLabels.addChild(t);
    }
    this.districtLabels.alpha = 0;
    vp.addChild(this.districtLabels);

    // The player.
    this.walker = new Sprite(Texture.from(AVATAR_ART.m));
    this.walker.anchor.set(0.5, 1);
    const shadow = new Graphics().ellipse(0, 0, 14, 4).fill({ color: 0x000000, alpha: 0.25 });
    this.vehicle.anchor.set(0.5, 1);
    this.vehicle.visible = false;
    this.bubbleText = new Text({ text: "", style: { fontFamily: ui, fontWeight: "700", fontSize: 13, fill: SIGN_BG } });
    this.bubbleText.anchor.set(0.5);
    this.bubble.addChild(this.bubbleBg, this.bubbleText);
    this.bubble.visible = false;
    this.marker.poly([-9, -14, 9, -14, 0, 0]).fill(0xf2b705).stroke({ width: 2, color: SIGN_BG });
    this.player.addChild(shadow, this.vehicle, this.walker, this.marker, this.bubble);
    vp.addChild(this.player);
    this.setLook(this.store.getState());


    // Start the camera on the player.
    const start = standAt(map, this.store.getState().game.loc);
    vp.setZoom(Math.min(1.2, Math.max(0.35, host.clientWidth / Math.min(1100, Math.max(620, host.clientWidth * 1.6)))));
    vp.moveCenter(start.x, start.y - 30);
    // While developing, a screenshot can ask for the whole town in view.
    const look = devView();
    if (look) {
      vp.clampZoom({ minWidth: 200, maxWidth: W * 4 });
      vp.setZoom(look.zoom);
      vp.moveCenter(look.x ?? W / 2, look.y ?? H / 2);
    }

    this.unsub.push(
      this.store.subscribe((s, prev) => {
        if (s.game.char !== prev.game.char) this.setLook(s);
        if (s.activity?.kind === "trip" && prev.activity?.kind !== "trip") this.following = true;
      }),
    );
    this.app.ticker.add(this.frame);
  }

  /** The tile for a place: its own art, else the town's art for its kind and look, else none. */
  private artFor(p: MapPlace): string | null {
    if (p.art) return p.art;
    if (this.map.grid) {
      const cls = p.variant === "rich" || p.variant === "middle" || p.variant === "poor" ? p.variant : undefined;
      return tileFor({ kind: p.kind, look: this.map.biome, state: this.map.state ?? "", ...(cls ? { cls } : {}) });
    }
    return KIND_ART[p.kind] ?? null;
  }

  private buildingArt(kind: string): string | null {
    const look: LookTile[] = ["duplex", "flats", "compound", "house", "market", "buka"];
    if (look.includes(kind as LookTile)) return lookTile(kind as LookTile, this.map.biome);
    if (kind === "office" || kind === "school") return sharedTile(kind);
    return null;
  }

  /** The trip's path along this map's own streets, from where the player stands to where they are going. */
  private pathFor(from: string, to: string, key: number, fallback: Point[]): Point[] {
    if (this.tripPath?.key === key) return this.tripPath.pts;
    let pts = fallback;
    try {
      const r: MapRoute | undefined = this.route?.route(from, to);
      if (r) pts = [standAt(this.map, from), ...r.pts.slice(1, -1), standAt(this.map, to)];
    } catch {
      // A place this map does not have: fall back to the sim's own line.
    }
    this.tripPath = { key, pts };
    return pts;
  }

  private setLook(s: GameStore) {
    const tex = Texture.from(AVATAR_ART[s.game.char?.g ?? "m"]);
    this.walker.texture = tex;
    this.walker.scale.set(AVATAR_H / tex.height);
  }

  /** Traffic drives the real road lines, turning at junctions. */
  private initTraffic(layer: Container) {
    const kinds: ("keke" | "okada" | "bus")[] = ["keke", "keke", "keke", "okada", "okada", "bus", "keke", "okada", "bus", "keke", "keke", "okada", "keke", "bus"];
    const busy = this.graph.verts.filter((v) => v.edges.length);
    if (!busy.length) return;
    kinds.forEach((k, i) => {
      const v = busy[(i * 5) % busy.length];
      const s = new Sprite(Texture.from(VEHICLE_ART[k]));
      s.anchor.set(0.5, 0.85);
      s.scale.set(TRAFFIC_W[k] / s.texture.width);
      s.cullable = true;
      layer.addChild(s);
      const base = k === "okada" ? 0.00016 : k === "bus" ? 0.0001 : 0.00013;
      this.cars.push({ a: v.id, b: v.edges[0].to, t: ((i * 37) % 100) / 100, speed: base * (0.8 + ((i * 13) % 10) / 25), sprite: s });
    });
  }

  private frame = (ticker: Ticker) => {
    const st = this.store.getState();
    const now = performance.now();
    const dt = Math.min(50, ticker.deltaMS);

    // Traffic keeps moving unless the game is paused or a note is open.
    const running = !st.paused && st.game.notes.length === 0 && !st.reducedMotion;
    this.traffic?.update(dt, now, running);
    if (running && this.cars.length) {
      for (const c of this.cars) {
        const p = this.graph.verts[c.a];
        const q = this.graph.verts[c.b];
        const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        c.t += c.speed * dt * (300 / len) * 3;
        if (c.t >= 1) {
          c.t = 0;
          const prev = c.a;
          c.a = c.b;
          const opts = this.graph.verts[c.a].edges.filter((e) => e.to !== prev);
          const list = opts.length ? opts : this.graph.verts[c.a].edges;
          if (!list.length) continue;
          c.b = list[Math.floor(Math.random() * list.length)].to;
        }
        const P = this.graph.verts[c.a];
        const Q = this.graph.verts[c.b];
        const ang = Math.atan2(Q.y - P.y, Q.x - P.x);
        // Keep right: offset to one side of the centre line.
        c.sprite.position.set(P.x + (Q.x - P.x) * c.t - Math.sin(ang) * 7, P.y + (Q.y - P.y) * c.t + Math.cos(ang) * 7);
        c.sprite.scale.x = Math.abs(c.sprite.scale.x) * (Q.x < P.x ? -1 : 1);
        c.sprite.zIndex = c.sprite.y;
      }
    }

    // The player: on a trip, doing something, or standing outside a place.
    const a = st.activity;
    let pos = standAt(this.map, st.game.loc);
    let mode: ModeId | null = null;
    let dx = 1;
    if (a?.kind === "trip") {
      const p = Math.min(1, Math.max(0, (now - a.startedAt) / a.ms));
      const path = this.pathFor(st.game.loc, a.trip.dest, a.startedAt, a.trip.route.pts);
      const at = pointAlong(path, easeInOut(p));
      pos = at;
      dx = at.dx;
      mode = SPRITE_FOR_MODE[a.trip.mode] ?? "keke";
    }
    this.player.position.set(pos.x, pos.y);
    this.player.visible = !(a?.kind === "action" && a.plan.action.goal === "fly");
    const riding = mode && mode !== "walk";
    this.vehicle.visible = !!riding;
    if (riding) {
      const tex = Texture.from(VEHICLE_ART[mode as Exclude<ModeId, "walk">]);
      if (this.vehicle.texture !== tex) this.vehicle.texture = tex;
      const k = VEHICLE_W[mode as Exclude<ModeId, "walk">] / tex.width;
      this.vehicle.scale.set(dx < 0 ? -k : k, k);
    }
    // Ride the horse; the other vehicles already have a driver and hide you inside.
    this.walker.visible = !riding || mode === "horse";
    const bob = mode === "walk" || mode === "horse" ? -Math.abs(Math.sin(now / 90)) * 3 : 0;
    this.walker.position.set(mode === "horse" ? 4 : 0, (mode === "horse" ? -38 : 0) + bob);
    this.walker.scale.x = Math.abs(this.walker.scale.x) * (dx < 0 ? -1 : 1);

    // Speech bubble while doing something.
    const label = a?.kind === "action" && !st.game.inside ? a.plan.action.bubble ?? a.plan.action.label : "";
    if (label !== this.bubbleText.text) {
      this.bubbleText.text = label;
      const w = Math.max(60, this.bubbleText.width + 24);
      this.bubbleBg.clear().roundRect(-w / 2, -12, w, 24, 12).fill(0xfbf4e6).stroke({ width: 2, color: SIGN_BG });
    }
    this.bubble.visible = !!label;
    this.marker.visible = !label;
    const top = riding && mode !== "horse" ? -this.vehicle.height - 8 : -AVATAR_H - (mode === "horse" ? 44 : 8);
    this.marker.position.set(0, top + (st.reducedMotion ? 0 : Math.sin(now / 200) * 3));
    this.bubble.position.set(0, top - 14);

    // Camera follows trips until the player drags away.
    if (this.following && a?.kind === "trip") {
      const c = this.viewport.center;
      this.viewport.moveCenter(c.x + (pos.x - c.x) * 0.12, c.y + (pos.y - 40 - c.y) * 0.12);
    } else if (!a) {
      this.following = false;
    }

    // District names fade in as you zoom out, and out as you zoom in to the streets.
    const z = this.viewport.scale.x;
    this.districtLabels.alpha = Math.max(0, Math.min(0.9, (0.45 - z) / 0.2));

    // Selection ring.
    const sel = this.tilePos(st.selected);
    this.ring.clear().ellipse(sel.x, sel.y + 34, 118, 30).stroke({ width: 4, color: 0xf2b705, alpha: 0.6 + 0.4 * Math.sin(now / 250) });

    // Day and night, and which buildings have light.
    const nl = nightLevel(st.game.t);
    const key = nl * 10 + (st.game.light ? 1 : 0);
    if (key !== this.lastNight) {
      this.lastNight = key;
      this.night.alpha = nl;
      const on = nl > 0.15;
      for (const p of this.map.places) {
        const bright = on && (st.game.light || p.gen);
        this.glows[p.id].alpha = bright ? 0.75 : 0;
        if (this.lit[p.id]) this.lit[p.id].alpha = bright ? 1 : 0;
      }
    }
  };

  private onTap(x: number, y: number) {
    const hit = hitTest(this.map, { x, y }, this.tileHeights, this.boards, this.boardH);
    if (!hit) return;
    if (hit.kind === "place") this.store.getState().select(hit.id);
    else this.cb.onBillboard?.(hit.id);
  }

  zoomBy(factor: number) {
    this.viewport.zoomPercent(factor - 1, true);
  }

  centerOnMe() {
    const st = this.store.getState();
    const p = standAt(this.map, st.game.loc);
    this.viewport.animate({ position: { x: p.x, y: p.y - 30 }, time: st.reducedMotion ? 0 : 450, ease: "easeOutCubic" });
  }

  /** Stop drawing while an interior is shown. */
  setActive(active: boolean) {
    if (!this.app.ticker) return;
    if (active) this.app.ticker.start();
    else this.app.ticker.stop();
  }

  destroy() {
    this.destroyed = true;
    this.unsub.forEach((u) => u());
    try {
      this.app.destroy(true, { children: true });
    } catch {
      // init may not have finished
    }
  }
}
