"use client";
// The feel of town: harmattan dust in the air from November, overheard Pidgin as you walk about, and sound
// made right here in the browser (no files to download on mobile data). Sound starts low; the menu mutes it.
import { MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { dayOfWeek, hourOf, worldT } from "@/sim";
import { roomFor } from "@/data/rooms";
import { tripPhase } from "@/sim/travel";
import { PLACE as ILORIN_PLACE } from "@/data/ilorin/places";
import { getGameStore, useGame } from "@/store";
import { useNow } from "./ui";

// ---- Sound on or off, remembered per device ----

const SOUND_KEY = "nv:sound";
const listeners = new Set<(on: boolean) => void>();

export function soundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l(on));
}

export function useSoundOn(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(soundOn);
  useEffect(() => {
    listeners.add(setOn);
    return () => void listeners.delete(setOn);
  }, []);
  return [on, setSoundOn];
}

// ---- Harmattan ----

/** Harmattan from November to February, thickest in the morning. 0 to 1. */
export function hazeLevel(now: number, hour: number): number {
  const m = new Date(now + 3600_000).getUTCMonth(); // WAT
  if (!(m >= 10 || m <= 1)) return 0;
  return hour < 11 ? 1 : hour < 16 ? 0.6 : 0.8;
}

function Haze() {
  const t = useGame((s) => s.game.t);
  const inside = useGame((s) => s.game.inside);
  const now = useNow(60_000);
  const level = inside ? 0 : hazeLevel(now, hourOf(worldT({ t })));
  if (!level) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[2] transition-opacity duration-[3000ms]"
      style={{ opacity: 0.22 * level, background: "linear-gradient(180deg, #E9D3A6 0%, #E2C796 45%, rgba(226,199,150,0.4) 100%)" }}
    />
  );
}

// ---- Overheard ----

/** Things people say as you pass. Never a party or a real person. */
export const OVERHEARD = [
  "Fuel don cost again o!",
  "Who get charger? My phone don die.",
  "Na today NEPA no take light. God dey!",
  "Make una register o. PVC na your power.",
  "This sun no be here at all.",
  "Abeg shift small, make I pass.",
  "Mama Ngozi, your bread don ready?",
  "That junction traffic ehn, I spend one hour.",
  "The jollof wey I chop yesterday sweet die.",
  "Election na 14 November. Make we vote wisely.",
  "Oga, last price? Ah, you no go kill me.",
  "Una hear say dem dey hire for Sync?",
  "My keke man no get change again.",
  "Rain fit fall today o, carry umbrella.",
  "Na who dey owe me money I dey find.",
  "Small chops dey that owambe, make we go.",
  "Una don collect una PVC?",
  "This harmattan dey crack my lips.",
  "Generator noise no let me sleep.",
  "Football tonight! Who dey go viewing centre?",
];

function Overheard() {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    let hide: ReturnType<typeof setTimeout> | null = null;
    const id = setInterval(() => {
      const st = getGameStore().getState();
      // Only out on the street, with nothing else going on.
      if (st.game.inside || st.activity || st.service || st.game.notes.length || !st.game.citizen || st.paused) return;
      if (Math.random() > 0.6) return;
      setLine(OVERHEARD[Math.floor(Math.random() * OVERHEARD.length)]);
      if (hide) clearTimeout(hide);
      hide = setTimeout(() => setLine(null), 5500);
    }, 35_000);
    return () => {
      clearInterval(id);
      if (hide) clearTimeout(hide);
    };
  }, []);
  if (!line) return null;
  return (
    <div className="pointer-events-none mx-auto w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-panel/95 px-3 py-2 text-sm text-ink shadow-lg" role="status">
      <span className="mr-1 inline-flex items-center gap-1 text-xs font-bold text-ink-soft">
        <MessageCircle aria-hidden className="h-3.5 w-3.5" />
        Overheard
      </span>
      &ldquo;{line}&rdquo;
    </div>
  );
}

// ---- Sound ----

/** Everything you can hear right now, worked out from the game. */
interface Scene {
  outside: boolean;
  room: string | null;
  noLight: boolean;
  riding: string | null;
  bells: boolean;
}

const BUSY_ROOMS = new Set(["buka", "takeaway", "supermarket", "station", "airport", "bank", "inec", "viewing", "stadium", "hall"]);
const PARTY_ROOMS = new Set(["club", "lounge"]);

function sceneNow(): Scene {
  const st = getGameStore().getState();
  const g = st.game;
  const w = worldT(g);
  const kind = st.world?.places.find((p) => p.id === g.loc)?.kind ?? ILORIN_PLACE[g.loc]?.kind ?? "";
  const a = st.activity;
  return {
    outside: !g.inside,
    room: g.inside ? roomFor(kind, g.loc) : null,
    noLight: !g.light,
    riding: a?.kind === "trip" && a.trip.mode !== "walk" ? a.trip.mode : null,
    bells: !g.inside && dayOfWeek(w) === 6 && hourOf(w) >= 7 && hourOf(w) < 9,
  };
}

type HornKind = "keke" | "okada" | "car" | "danfo";

/** Which horn your ride has. */
export const HORN_FOR: Record<string, HornKind> = { keke: "keke", okada: "okada", bus: "danfo", danfo: "danfo", ride: "car", suv: "car", drive: "car", hire: "car" };

/** A small mixer of generated sounds, each faded in and out to match the scene. */
class Ambience {
  private ctx: AudioContext;
  private master: GainNode;
  private layers = new Map<string, GainNode>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private scene: Scene = { outside: true, room: null, noLight: false, riding: null, bells: false };

  constructor() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);
    this.layers.set("street", this.noiseLayer(350, 0.5, 0.15));
    this.layers.set("crowd", this.noiseLayer(900, 2.5, 0.6));
    this.layers.set("generator", this.humLayer(50, 380));
    this.layers.set("engine", this.humLayer(85, 600, 9));
    this.timers.push(setInterval(() => this.horn(), 9000));
    this.timers.push(setInterval(() => this.bell(), 2800));
    this.timers.push(setInterval(() => this.beat(), 500));
  }

  resume() {
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  set(scene: Scene, on: boolean) {
    this.scene = scene;
    const level = (name: string, v: number) => this.layers.get(name)!.gain.setTargetAtTime(on ? v : 0, this.ctx.currentTime, 0.8);
    level("street", scene.outside ? 0.35 : 0.05);
    level("crowd", scene.room && BUSY_ROOMS.has(scene.room) ? 0.5 : 0);
    level("generator", scene.noLight ? (scene.outside ? 0.12 : 0.22) : 0);
    level("engine", scene.riding ? (scene.riding === "keke" || scene.riding === "okada" ? 0.35 : 0.18) : 0);
    this.master.gain.setTargetAtTime(on ? 0.18 : 0, this.ctx.currentTime, 0.3);
  }

  private noise(): AudioBufferSourceNode {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // Brown noise: a soft rumble, not a hiss.
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  /** Filtered noise with a slow wobble: traffic, or the chatter of a room. */
  private noiseLayer(freq: number, wobbleHz: number, wobble: number): GainNode {
    const src = this.noise();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 0.7;
    const amp = this.ctx.createGain();
    amp.gain.value = 1 - wobble / 2;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = wobbleHz;
    const depth = this.ctx.createGain();
    depth.gain.value = wobble / 2;
    lfo.connect(depth).connect(amp.gain);
    const out = this.ctx.createGain();
    out.gain.value = 0;
    src.connect(filter).connect(amp).connect(out).connect(this.master);
    src.start();
    lfo.start();
    return out;
  }

  /** A buzzing motor: a generator, or the engine under you. */
  private humLayer(hz: number, cutoff: number, chug = 0): GainNode {
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = hz;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const amp = this.ctx.createGain();
    amp.gain.value = 0.5;
    if (chug) {
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = chug;
      const depth = this.ctx.createGain();
      depth.gain.value = 0.25;
      lfo.connect(depth).connect(amp.gain);
      lfo.start();
    }
    const out = this.ctx.createGain();
    out.gain.value = 0;
    osc.connect(filter).connect(amp).connect(out).connect(this.master);
    osc.start();
    return out;
  }

  private tone(freq: number, at: number, len: number, vol: number, type: OscillatorType = "sine") {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + len + 0.05);
  }

  /** Now and then on the street somebody horns: a keke, an okada, a car or a danfo. */
  private horn() {
    if (!this.scene.outside || Math.random() > 0.6) return;
    const kinds: HornKind[] = ["keke", "keke", "okada", "car", "car", "danfo"];
    this.honk(kinds[Math.floor(Math.random() * kinds.length)], 0.6 + Math.random() * 0.4);
  }

  /** One vehicle's horn. A keke goes pim-pim, an okada beeps, a car has two tones, a danfo blasts. */
  honk(kind: HornKind, near = 1) {
    const t = this.ctx.currentTime;
    const v = 0.06 * near;
    switch (kind) {
      case "keke":
        this.tone(780, t, 0.09, v, "square");
        this.tone(780, t + 0.14, 0.09, v, "square");
        break;
      case "okada":
        this.tone(980, t, 0.07, v * 0.8, "square");
        break;
      case "car":
        this.tone(420, t, 0.3, v, "square");
        this.tone(530, t, 0.3, v * 0.7, "square");
        break;
      case "danfo":
        this.tone(330, t, 0.7, v, "sawtooth");
        this.tone(415, t, 0.7, v * 0.6, "sawtooth");
        break;
    }
  }

  /** Sunday morning church bells. */
  private bell() {
    if (!this.scene.bells) return;
    const t = this.ctx.currentTime;
    for (const [m, v] of [[1, 0.08], [2.76, 0.03], [5.4, 0.015]] as const) this.tone(392 * m, t, 2.5, v);
  }

  /** A party beat in the club. */
  private step = 0;
  private beat() {
    if (!this.scene.room || !PARTY_ROOMS.has(this.scene.room)) return;
    const t = this.ctx.currentTime;
    this.tone(60, t, 0.25, 0.25, "sine");
    if (this.step++ % 2) this.tone(2200, t + 0.25, 0.05, 0.02, "square");
  }

  destroy() {
    this.timers.forEach(clearInterval);
    void this.ctx.close();
  }
}

function Sound() {
  const [on] = useSoundOn();
  const amb = useRef<Ambience | null>(null);
  useEffect(() => {
    // Browsers only allow sound after the player touches the page.
    const start = () => {
      if (!amb.current) {
        try {
          amb.current = new Ambience();
        } catch {
          return;
        }
      }
      amb.current.resume();
    };
    window.addEventListener("pointerdown", start);
    // Your ride horns as it pulls up for you.
    let lastPhase: string | null = null;
    const id = setInterval(() => {
      amb.current?.set(sceneNow(), soundOn());
      const a = getGameStore().getState().activity;
      const phase = a?.kind === "trip" ? tripPhase(a.timing, performance.now() - a.startedAt).phase : null;
      if (lastPhase === "wait" && phase === "board" && a?.kind === "trip" && HORN_FOR[a.trip.mode] && soundOn()) amb.current?.honk(HORN_FOR[a.trip.mode]);
      lastPhase = phase;
    }, 250);
    return () => {
      window.removeEventListener("pointerdown", start);
      clearInterval(id);
      amb.current?.destroy();
      amb.current = null;
    };
  }, []);
  useEffect(() => {
    amb.current?.set(sceneNow(), on);
  }, [on]);
  return null;
}

/** The haze over the map, and the sound. Mount once, under the HUD. */
export function Atmosphere() {
  return (
    <>
      <Haze />
      <Sound />
    </>
  );
}

/** Overheard lines, shown above the bottom of the HUD. */
export { Overheard };
