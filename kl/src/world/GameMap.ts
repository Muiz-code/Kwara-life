// The Pixi world map: building tiles, billboards, traffic, the player and the camera.
// Reads the game store; never writes game state except selecting a place.
import { Application, Assets, Container, Graphics, PerspectiveMesh, Sprite, Text, Texture, type Ticker } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { AD_SLOTS } from "../data/ilorin/billboards";
import { PLACE, PLACES } from "../data/ilorin/places";
import { ROADS } from "../data/ilorin/roads";
import type { GameStore, GameStoreApi } from "../store/game";
import { ADJ, WORLD_H, WORLD_W, easeInOut, nodePos, placePos, pointAlong, standPos } from "../sim/world";
import { nightLevel } from "../sim/time";
import type { ModeId } from "../sim/travel";
import {
  ALL_ART, AVATAR_ART, AVATAR_H, BILLBOARD_ART, BILLBOARD_FACE, BILLBOARD_W, TILE_ART, TILE_BASE, TILE_W,
  TRAFFIC_W, VEHICLE_ART, VEHICLE_W,
} from "./art";
import { buildGround } from "./ground";
import { billboardPositions, hitTest } from "./layout";

export interface MapCallbacks {
  onBillboard?: (slotId: string) => void;
}

interface Car {
  a: string;
  b: string;
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
function placeholderAd(font: string): Texture {
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
  ctx.fillText("Reach every Ilorin player", 256, 238);
  return Texture.from(c);
}

export class GameMap {
  private app = new Application();
  private viewport!: Viewport;
  private store: GameStoreApi;
  private cb: MapCallbacks;
  private unsub: (() => void)[] = [];

  private tileHeights: Record<string, number> = {};
  private boards = billboardPositions();
  private boardH = 0;
  private ring = new Graphics();
  private night = new Graphics();
  private glows: Record<string, Sprite> = {};
  private player = new Container();
  private walker!: Sprite;
  private vehicle = new Sprite();
  private bubble = new Container();
  private bubbleText!: Text;
  private bubbleBg = new Graphics();
  /** Bouncing marker above the player's head so you can always find yourself. */
  private marker = new Graphics();
  private cars: Car[] = [];
  private following = false;
  private lastNight = -1;
  private destroyed = false;

  private constructor(store: GameStoreApi, cb: MapCallbacks) {
    this.store = store;
    this.cb = cb;
  }

  static async create(host: HTMLElement, store: GameStoreApi, cb: MapCallbacks = {}): Promise<GameMap> {
    const m = new GameMap(store, cb);
    await m.init(host);
    return m;
  }

  private async init(host: HTMLElement) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    await this.app.init({
      resizeTo: host,
      resolution: dpr,
      autoDensity: true,
      antialias: dpr < 2,
      background: 0xd3b67f,
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
    await Assets.load(ALL_ART);
    if (this.destroyed) return;

    const vp = new Viewport({
      screenWidth: host.clientWidth,
      screenHeight: host.clientHeight,
      worldWidth: WORLD_W,
      worldHeight: WORLD_H,
      events: this.app.renderer.events,
      passiveWheel: false,
    });
    this.viewport = vp;
    this.app.stage.addChild(vp);
    vp.drag()
      .pinch()
      .wheel({ smooth: 4 })
      .decelerate({ friction: 0.93 })
      .clampZoom({ minWidth: 420, maxWidth: Math.max(WORLD_W, WORLD_H / 0.7) * 1.02 })
      .clamp({ left: -200, right: WORLD_W + 200, top: -200, bottom: WORLD_H + 200, underflow: "center" });
    vp.on("drag-start", () => (this.following = false));
    vp.on("pinch-start", () => (this.following = false));
    vp.on("clicked", (e) => this.onTap(e.world.x, e.world.y));
    this.app.renderer.on("resize", (w: number, h: number) => vp.resize(w, h, WORLD_W, WORLD_H));

    vp.addChild(buildGround({ ui }));
    vp.addChild(this.ring);

    // Buildings and billboards share one layer, drawn back to front.
    const things = new Container();
    things.sortableChildren = true;
    vp.addChild(things);
    for (const p of PLACES) {
      const pos = placePos(p.id);
      const s = new Sprite(Texture.from(TILE_ART[p.id]));
      s.anchor.set(0.5, 1);
      s.scale.set(TILE_W / s.texture.width);
      s.position.set(pos.x, pos.y + TILE_BASE);
      s.zIndex = pos.y + TILE_BASE;
      s.cullable = true;
      things.addChild(s);
      this.tileHeights[p.id] = s.height;
    }
    const adFace = placeholderAd(sign);
    for (const slot of AD_SLOTS) {
      const b = this.boards[slot.id];
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
    this.night.rect(-3000, -3000, WORLD_W + 6000, WORLD_H + 6000).fill(0x0d1838);
    this.night.alpha = 0;
    vp.addChild(this.night);
    const glowTex = glowTexture();
    const glowLayer = new Container();
    vp.addChild(glowLayer);
    for (const p of PLACES) {
      const pos = placePos(p.id);
      const gs = new Sprite(glowTex);
      gs.anchor.set(0.5);
      gs.blendMode = "add";
      gs.width = 280;
      gs.height = 190;
      gs.position.set(pos.x, pos.y - 30);
      gs.alpha = 0;
      glowLayer.addChild(gs);
      this.glows[p.id] = gs;
    }

    // Traffic is depth-sorted with the buildings so tiles hide cars passing behind them.
    this.initTraffic(things);

    // Place name signs stay readable above buildings.
    const signs = new Container();
    vp.addChild(signs);
    for (const p of PLACES) {
      const pos = placePos(p.id);
      const top = pos.y + TILE_BASE - this.tileHeights[p.id];
      const t = new Text({ text: p.name, style: { fontFamily: sign, fontSize: 15, fill: SIGN_TEXT } });
      t.anchor.set(0.5);
      const w = Math.max(92, t.width + 26);
      const bg = new Graphics().roundRect(-w / 2, -13, w, 26, 5).fill(SIGN_BG).stroke({ width: 1.5, color: SIGN_TEXT });
      const c = new Container();
      c.addChild(bg, t);
      c.position.set(pos.x, Math.max(top + 4, pos.y - 150));
      signs.addChild(c);
    }

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
    const start = standPos(this.store.getState().game.loc);
    vp.setZoom(Math.min(1.2, Math.max(0.35, host.clientWidth / Math.min(1100, Math.max(620, host.clientWidth * 1.6)))));
    vp.moveCenter(start.x, start.y - 30);

    this.unsub.push(
      this.store.subscribe((s, prev) => {
        if (s.game.char !== prev.game.char) this.setLook(s);
        if (s.activity?.kind === "trip" && prev.activity?.kind !== "trip") this.following = true;
      }),
    );
    this.app.ticker.add(this.frame);
  }

  private setLook(s: GameStore) {
    const tex = Texture.from(AVATAR_ART[s.game.char?.g ?? "m"]);
    this.walker.texture = tex;
    this.walker.scale.set(AVATAR_H / tex.height);
  }

  private initTraffic(layer: Container) {
    const kinds: ("keke" | "okada" | "bus")[] = ["keke", "keke", "keke", "okada", "okada", "bus", "keke", "okada", "bus", "keke", "keke", "okada", "keke", "bus"];
    kinds.forEach((k, i) => {
      const e = ROADS[(i * 5) % ROADS.length];
      const s = new Sprite(Texture.from(VEHICLE_ART[k]));
      s.anchor.set(0.5, 0.85);
      s.scale.set(TRAFFIC_W[k] / s.texture.width);
      s.cullable = true;
      layer.addChild(s);
      const base = k === "okada" ? 0.00016 : k === "bus" ? 0.0001 : 0.00013;
      this.cars.push({ a: e.a, b: e.b, t: ((i * 37) % 100) / 100, speed: base * (0.8 + ((i * 13) % 10) / 25), sprite: s });
    });
  }

  private frame = (ticker: Ticker) => {
    const st = this.store.getState();
    const now = performance.now();
    const dt = Math.min(50, ticker.deltaMS);

    // Traffic keeps moving unless the game is paused or a note is open.
    const running = !st.paused && st.game.notes.length === 0 && !st.reducedMotion;
    if (running) {
      for (const c of this.cars) {
        const p = nodePos(c.a);
        const q = nodePos(c.b);
        const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        c.t += c.speed * dt * (300 / len) * 3;
        if (c.t >= 1) {
          c.t = 0;
          const prev = c.a;
          c.a = c.b;
          const opts = ADJ[c.a].filter((n) => n !== prev);
          const list = opts.length ? opts : ADJ[c.a];
          c.b = list[Math.floor(Math.random() * list.length)];
        }
        const P = nodePos(c.a);
        const Q = nodePos(c.b);
        const ang = Math.atan2(Q.y - P.y, Q.x - P.x);
        // Keep right: offset to one side of the centre line.
        c.sprite.position.set(P.x + (Q.x - P.x) * c.t - Math.sin(ang) * 7, P.y + (Q.y - P.y) * c.t + Math.cos(ang) * 7);
        c.sprite.scale.x = Math.abs(c.sprite.scale.x) * (Q.x < P.x ? -1 : 1);
        c.sprite.zIndex = c.sprite.y;
      }
    }

    // The player: on a trip, doing something, or standing outside a place.
    const a = st.activity;
    let pos = standPos(st.game.loc);
    let mode: ModeId | null = null;
    let dx = 1;
    if (a?.kind === "trip") {
      const p = Math.min(1, Math.max(0, (now - a.startedAt) / a.ms));
      const at = pointAlong(a.trip.route.pts, easeInOut(p));
      pos = at;
      dx = at.dx;
      mode = a.trip.mode;
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

    // Selection ring.
    const sel = placePos(st.selected);
    this.ring.clear().ellipse(sel.x, sel.y + 34, 118, 30).stroke({ width: 4, color: 0xf2b705, alpha: 0.6 + 0.4 * Math.sin(now / 250) });

    // Day and night, and which buildings have light.
    const nl = nightLevel(st.game.t);
    const key = nl * 10 + (st.game.light ? 1 : 0);
    if (key !== this.lastNight) {
      this.lastNight = key;
      this.night.alpha = nl;
      const lit = nl > 0.15;
      for (const p of PLACES) this.glows[p.id].alpha = lit && (st.game.light || PLACE[p.id].gen) ? 0.75 : 0;
    }
  };

  private onTap(x: number, y: number) {
    const hit = hitTest({ x, y }, this.tileHeights, this.boards, this.boardH);
    if (!hit) return;
    if (hit.kind === "place") this.store.getState().select(hit.id);
    else this.cb.onBillboard?.(hit.id);
  }

  zoomBy(factor: number) {
    this.viewport.zoomPercent(factor - 1, true);
  }

  centerOnMe() {
    const st = this.store.getState();
    const p = standPos(st.game.loc);
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
