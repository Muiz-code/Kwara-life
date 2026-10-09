// Other real players on the town map (docs/DECISIONS.md, "Playing together"): the people at your place stand
// round it in a loose circle, dressed for their state, with their game name over their head. Nothing else
// about them shows: no real names, no chat bubbles. Positions are spread by a hash of their id, so everyone
// sees the same arrangement and nobody stands on anybody.
import { CanvasTexture, Group, Sprite, SpriteMaterial, type Object3D } from "three";
import { attireFor } from "../data/attire";
import { LGA } from "../data/geography";
import type { Player } from "../sim/together";
import { Avatar, type People } from "./avatar";
import { Character } from "./character";

interface Shown {
  player: Player;
  figure: Character | Avatar;
  tag: Sprite;
  angle: number;
  radius: number;
  sway: number;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};

/** A name tag: the game name on a dark pill, drawn once into a texture. */
function nameTag(text: string): Sprite {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.font = "bold 30px system-ui, sans-serif";
  const w = Math.min(248, g.measureText(text).width + 32);
  g.fillStyle = "rgba(15, 23, 48, 0.82)";
  g.beginPath();
  g.roundRect((256 - w) / 2, 8, w, 48, 24);
  g.fill();
  g.fillStyle = "#F7E7C1";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 33, 232);
  const s = new Sprite(new SpriteMaterial({ map: new CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(2.4, 0.6, 1);
  s.renderOrder = 10;
  return s;
}

export class OtherPlayers {
  readonly group = new Group();
  private shown = new Map<string, Shown>();

  constructor(private people: () => { set: People; clone: (o: Object3D) => Object3D } | null) {}

  /** Who should be standing here now. */
  set(players: Player[]) {
    const keep = new Set(players.map((p) => p.id));
    for (const [id, s] of this.shown)
      if (!keep.has(id)) {
        this.group.remove(s.figure.root, s.tag);
        s.figure.dispose();
        s.tag.material.map?.dispose();
        s.tag.material.dispose();
        this.shown.delete(id);
      }
    for (const p of players) {
      if (this.shown.has(p.id)) continue;
      const home = LGA[p.lgaCode]?.stateCode ?? "kwara";
      const attire = attireFor(home, p.look.g);
      const ppl = this.people();
      const figure = ppl ? new Avatar(ppl.set, p.look, attire, ppl.clone) : new Character(p.look, attire);
      const h = hash(p.id);
      const tag = nameTag(p.nickname);
      this.group.add(figure.root, tag);
      this.shown.set(p.id, { player: p, figure, tag, angle: ((h % 360) / 360) * Math.PI * 2, radius: 1.7 + ((h >>> 9) % 100) / 110, sway: (h >>> 17) % 1000 });
    }
  }

  /** Stand them round the place, facing in, idling. */
  update(dt: number, at: { x: number; z: number }, heightAt: (x: number, z: number) => number, still: boolean) {
    for (const s of this.shown.values()) {
      const x = at.x + Math.cos(s.angle) * s.radius;
      const z = at.z + Math.sin(s.angle) * s.radius;
      const y = heightAt(x, z);
      s.figure.root.position.set(x, y, z);
      s.figure.root.rotation.y = Math.atan2(at.x - x, at.z - z);
      if (s.figure instanceof Avatar) s.figure.update(dt, 0);
      else s.figure.update(dt, 0);
      s.tag.position.set(x, y + 2.35 + (still ? 0 : Math.sin((performance.now() + s.sway) / 700) * 0.04), z);
    }
  }

  dispose() {
    this.set([]);
  }
}
