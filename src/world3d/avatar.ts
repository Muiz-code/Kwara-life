// Real people: the Quaternius base man and woman (CC0), rigged, with the Universal Animation Library's
// walk, run, idle and dance, dressed for their state. Fitted clothes (tops, trousers) are a thin layer
// drawn over the body and skinned to the same bones, so they bend as the body moves; flowing robes,
// wrappers and caps hang from the body. Built by scripts/build-avatars.mjs into public/models.
import {
  AnimationMixer, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, LatheGeometry, LoopRepeat, Mesh, MeshLambertMaterial, SkinnedMesh,
  Uint16BufferAttribute, Vector2,
  SphereGeometry, TorusGeometry, Vector3, type AnimationAction, type AnimationClip, type Bone,
  type Material, type Object3D, type Texture,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Attire } from "../data/attire";
import type { Gender } from "../data/character";
import { fabric, shade, type Weave } from "./fabric";

export interface People {
  man: GLTF;
  woman: GLTF;
  clips: AnimationClip[];
}

let loading: Promise<People> | null = null;

/** Load the people models once and share them. */
export function loadPeople(): Promise<People> {
  if (!loading) {
    loading = (async () => {
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/libs/meshopt_decoder.module.js"),
      ]);
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const [man, woman, anims] = await Promise.all(["/models/man.glb", "/models/woman.glb", "/models/anims.glb"].map((u) => loader.loadAsync(u)));
      return { man, woman, clips: anims.animations };
    })();
    loading.catch(() => (loading = null));
  }
  return loading;
}

/** What a person is doing in place: dancing, sitting, talking, working with their hands, lying down. */
export type Pose = "dance" | "sit" | "talk" | "work" | "lie";

export interface AvatarLook {
  g: Gender;
  skin: string;
  cloth: string;
}

/** The average colour of the model's own skin texture, which is light. */
const TEXTURE_SKIN = new Color("#D79E7E");

/** The tint that turns the model's light skin texture into the chosen skin tone. */
function skinTint(tone: string): Color {
  const want = new Color(tone);
  return new Color(
    Math.min(1, (want.r / TEXTURE_SKIN.r) * 1.15),
    Math.min(1, (want.g / TEXTURE_SKIN.g) * 1.15),
    Math.min(1, (want.b / TEXTURE_SKIN.b) * 1.15),
  );
}

/**
 * A fitted garment: a copy of the body, pushed out a little along its normals, showing only where the
 * garment covers (by height and reach in the body's rest pose), with the fabric projected onto it.
 */
function fitted(body: SkinnedMesh, map: Texture | null, colour: string, cover: { y0: number; y1: number; reach: number }, puff = 0.012): SkinnedMesh {
  const m = new MeshLambertMaterial({ color: map ? "#ffffff" : colour, side: DoubleSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.fabricMap = { value: map };
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRest;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvRest = position;\ntransformed += normal * ${puff.toFixed(4)};`);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vRest;\n${map ? "uniform sampler2D fabricMap;" : ""}`)
      .replace(
        "#include <map_fragment>",
        `if (vRest.y < ${cover.y0.toFixed(3)} || vRest.y > ${cover.y1.toFixed(3)} || abs(vRest.x) > ${cover.reach.toFixed(3)}) discard;
${map ? "diffuseColor.rgb *= texture2D(fabricMap, vec2(vRest.x * 3.0 + vRest.z * 2.0, vRest.y * 3.0)).rgb;" : ""}`,
      );
  };
  // One program per cut of garment (the shader code), shared by everyone wearing it; the cloth itself
  // is a uniform. A key per colour made every person compile their own, which stalled crowded rooms.
  m.customProgramCacheKey = () => `fitted-${cover.y0.toFixed(3)}-${cover.y1.toFixed(3)}-${cover.reach.toFixed(3)}-${map ? "map" : "plain"}`;
  const g = new SkinnedMesh(body.geometry, m);
  g.bind(body.skeleton, body.bindMatrix);
  g.castShadow = true;
  g.frustumCulled = false;
  return g;
}

/**
 * A garment cut from a profile (radius at each height, top to bottom, in the body's rest pose), turned
 * round the body, flattened by sx and sz, and sewn to the skeleton: above the hips it rides the spine and,
 * out where the sleeves are, the upper arms; below the hips it hangs from the pelvis and follows each
 * leg part of the way, more towards the hem, so it swings as you walk.
 */
function tailored(body: SkinnedMesh, profile: [number, number][], m: MeshLambertMaterial, sx: number, sz: number, hipY: number, pull = 0.5): SkinnedMesh {
  const pts = profile.map(([r, y]) => new Vector2(r, y));
  const g = new LatheGeometry(pts, 28);
  g.scale(sx, 1, sz);
  g.computeVertexNormals();
  const bones = body.skeleton.bones;
  const idx = (n: string) => Math.max(0, bones.findIndex((b) => b.name === n));
  // Which thigh is on the +x side, from where the bones sit in the rest pose.
  body.updateMatrixWorld(true);
  const rest = (n: string) => body.worldToLocal(bones[idx(n)].getWorldPosition(new Vector3()));
  const leftIsPlusX = rest("thigh_l").x > 0;
  const hemY = profile[profile.length - 1][1];
  const spine: [string, number][] = [["pelvis", hipY], ["spine_01", hipY + 0.1], ["spine_02", hipY + 0.22], ["spine_03", hipY + 0.36], ["neck_01", hipY + 0.55]];
  const pos = g.getAttribute("position");
  const n = pos.count;
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  const rx = Math.max(...profile.map(([r]) => r)) * sx;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const o = i * 4;
    if (y >= hipY) {
      // Ride the nearest spine bone; the wide sleeves of a robe follow the upper arms half way.
      let best = spine[0];
      for (const sb of spine) if (Math.abs(sb[1] - y) < Math.abs(best[1] - y)) best = sb;
      const arm = Math.abs(x) > 0.24 && y > hipY + 0.2 ? Math.min(0.5, (Math.abs(x) - 0.24) * 2) : 0;
      si[o] = idx(best[0]);
      sw[o] = 1 - arm;
      if (arm) {
        si[o + 1] = idx((x > 0) === leftIsPlusX ? "upperarm_l" : "upperarm_r");
        sw[o + 1] = arm;
      }
    } else {
      // Below the hips: the pelvis holds it, the legs pull the hem along.
      const t = Math.min(1, (hipY - y) / Math.max(0.01, hipY - hemY));
      const leg = t * pull;
      const side = Math.min(1, Math.max(0, 0.5 + x / (2 * rx)));
      const plus = (x > 0) === leftIsPlusX ? "l" : "r";
      const minus = plus === "l" ? "r" : "l";
      si[o] = idx("pelvis");
      sw[o] = 1 - leg;
      si[o + 1] = idx(`thigh_${plus}`);
      sw[o + 1] = leg * side;
      si[o + 2] = idx(`thigh_${minus}`);
      sw[o + 2] = leg * (1 - side);
    }
  }
  g.setAttribute("skinIndex", new Uint16BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new Float32BufferAttribute(sw, 4));
  const mesh = new SkinnedMesh(g, m);
  mesh.bind(body.skeleton, body.bindMatrix);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

export class Avatar {
  readonly root = new Group();
  private mixer: AnimationMixer;
  private actions = new Map<string, AnimationAction>();
  private current: AnimationAction | null = null;
  private sway: Object3D[] = [];
  private materials: Material[] = [];
  private t = 0;

  constructor(people: People, look: AvatarLook, attire: Attire, cloneSkinned: (o: Object3D) => Object3D) {
    const female = look.g !== "m";
    const model = cloneSkinned((female ? people.woman : people.man).scene);
    // The base bodies are built like superheroes: a little slimmer looks like everyday people.
    model.scale.set(0.86, 1, 0.9);
    // The models face -z; the game's people face +z, the way they walk.
    model.rotation.y = Math.PI;
    this.root.add(model);
    this.model = model;
    model.updateMatrixWorld(true);

    const bodies: SkinnedMesh[] = [];
    let head: Bone | null = null;
    let pelvis: Bone | null = null;
    model.traverse((o) => {
      if ((o as Bone).isBone && o.name === "Head") head = o as Bone;
      if ((o as Bone).isBone && o.name === "pelvis") pelvis = o as Bone;
      const mesh = o as SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      const mat = (mesh.material as MeshLambertMaterial).clone();
      this.materials.push(mat);
      mesh.material = mat;
      const name = mat.name || "";
      if (/Eyes/.test(name) && !this.eyes) this.eyes = mesh;
      if (/Superhero/.test(name)) {
        mat.color = skinTint(look.skin);
        bodies.push(mesh);
      }
      // Hair goes under a cap, gele or hijab; eyebrows stay.
      if (/Hair/.test(name) && !/brow/i.test(mesh.name) && attire.head) mesh.visible = false;
    });
    const body = bodies[0];
    const h = female ? 1.77 : 1.81;
    const main = look.cloth;
    const trim = shade(main, 0.7);
    const fab = (c: string, w: Weave) => {
      const t = fabric(w, c);
      return { map: t, colour: c };
    };

    // Fitted top: to the wrist with long sleeves, the elbow for a blouse.
    if (body) {
      const sleeve = attire.body === "wrapper" || attire.body === "iro" ? 0.42 : 0.72;
      const top = fab(main, attire.body === "abaya" ? "plain" : attire.pattern);
      const topY0 = attire.body === "abaya" ? 0.06 : h * 0.5;
      const shirt = fitted(body, top.map, top.colour, { y0: topY0, y1: h * 0.82, reach: sleeve });
      this.root.add(shirt);
      // Trousers, or bare legs under a wrapper or gown.
      if (attire.body === "agbada" || attire.body === "babbanriga" || attire.body === "kaftan" || attire.body === "isiagu") {
        const legs = fab(attire.body === "agbada" ? main : attire.body === "isiagu" ? "#1E1E22" : trim, attire.body === "agbada" ? attire.pattern : "plain");
        this.root.add(fitted(body, legs.map, legs.colour, { y0: h * 0.06, y1: h * 0.56, reach: 0.3 }, 0.01));
      }
    }

    const M = (c: string, w: Weave = "plain") => {
      const t = fabric(w, c);
      const m = new MeshLambertMaterial({ color: t ? "#ffffff" : c, map: t, side: DoubleSide });
      this.materials.push(m);
      return m;
    };
    this.root.add(this.dress);
    // Robes, gowns and wrappers: shaped from the body's own height, sewn to the same skeleton, so a
    // wrapper swings with each step and an agbada drapes from the shoulders over the arms.
    const k = h / 1.81;
    const P = (pts: [number, number][]) => pts.map(([r, y]) => [r, y * k] as [number, number]);
    if (body) {
      // pull: how far the hem follows the legs. A loose robe swings with them; a tight wrapper barely moves.
      const sew = (profile: [number, number][], m: MeshLambertMaterial, sx: number, sz: number, pull = 0.5) => {
        const g = tailored(body, profile, m, sx, sz, 0.95 * k, pull);
        this.root.add(g);
        return g;
      };
      switch (attire.body) {
        case 'agbada':
          sew(P([[0.12, 1.53], [0.25, 1.48], [0.3, 1.36], [0.33, 1.05], [0.4, 0.7], [0.44, 0.52]]), M(main, attire.pattern === 'asooke' ? 'asooke' : 'embroidery'), 2.0, 0.78);
          break;
        case 'babbanriga':
          sew(P([[0.12, 1.53], [0.24, 1.48], [0.28, 1.36], [0.29, 1.05], [0.33, 0.6], [0.36, 0.12]]), M(main, 'embroidery'), 1.5, 0.85, 0.4);
          break;
        case 'kaftan':
          sew(P([[0.185, 1.02], [0.205, 0.8], [0.225, 0.52]]), M(main, attire.pattern), 1.12, 0.92);
          break;
        case 'etibo':
          sew(P([[0.175, 0.98], [0.19, 0.6], [0.205, 0.08]]), M(trim, attire.pattern), 1.15, 1.0, 0.22);
          sew(P([[0.19, 1.04], [0.21, 0.8], [0.225, 0.55]]), M(main), 1.15, 0.95);
          break;
        case 'iro':
        case 'wrapper':
          sew(P([[0.17, 1.0], [0.185, 0.85], [0.195, 0.5], [0.205, 0.08]]), M(attire.body === 'iro' ? main : trim, attire.pattern), 1.18, 1.0, 0.22);
          break;
        case 'abaya':
          sew(P([[0.13, 1.42], [0.185, 1.3], [0.18, 1.0], [0.22, 0.5], [0.26, 0.07]]), M(main), 1.25, 1.0, 0.25);
          break;
      }
    }

    // Caps and head wraps ride on the head bone.
    if (head) this.hat(head, model, attire, main, trim, M, h);
    if (attire.beads && body) {
      const coral = M("#D9532B");
      for (const [r, y] of [[0.085, 0.825], [0.11, 0.81]] as const) {
        const ring = new Mesh(new TorusGeometry(r, 0.02, 6, 16), coral);
        ring.rotation.x = Math.PI / 2 + 0.25;
        ring.position.set(0, h * y, 0.02);
        this.dress.add(ring);
      }
    }
    void pelvis;

    this.mixer = new AnimationMixer(model);
    for (const clip of people.clips) {
      const a = this.mixer.clipAction(clip);
      a.setLoop(LoopRepeat, Infinity);
      this.actions.set(clip.name, a);
    }
    this.play("Idle_Loop", 0);
  }

  /** Put something on the head so it follows every nod and turn. */
  private hat(head: Bone, model: Object3D, attire: Attire, main: string, trim: string, M: (c: string, w?: Weave) => MeshLambertMaterial, h: number) {
    const top = new Group();
    const put = (mesh: Mesh, y: number, x = 0, z = 0) => {
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      top.add(mesh);
      return mesh;
    };
    const crown = h * 0.965;
    switch (attire.head) {
      case "fila": {
        const fila = put(new Mesh(new CylinderGeometry(0.1, 0.11, 0.11, 16), M(trim, attire.pattern === "asooke" ? "asooke" : "plain")), crown, 0.015);
        fila.rotation.z = -0.3;
        put(new Mesh(new SphereGeometry(0.06, 8, 6), M(trim)), crown + 0.04, 0.09);
        break;
      }
      case "hula":
        put(new Mesh(new CylinderGeometry(0.105, 0.105, 0.11, 18), M(attire.pattern === "anger" ? "#F2F0EA" : main, "embroidered-panel")), crown);
        break;
      case "okpu":
        put(new Mesh(new CylinderGeometry(0.1, 0.105, 0.12, 18), M("#B3261E", "okpu")), crown);
        break;
      case "bowler":
        put(new Mesh(new CylinderGeometry(0.18, 0.18, 0.015, 20), M("#2B2F36")), crown - 0.03);
        put(new Mesh(new SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M("#2B2F36")), crown - 0.03);
        break;
      case "gele": {
        const m = M(main, attire.pattern);
        for (const [x, y, s] of [[0, 0.02, 0.16], [-0.1, 0.06, 0.1], [0.11, 0.07, 0.1], [0, 0.11, 0.08]] as const) {
          const knot = put(new Mesh(new SphereGeometry(s, 14, 10), m), crown + y, x, -0.02);
          knot.scale.set(1.35, 0.7, 1.05);
        }
        break;
      }
      case "ichafu": {
        const m = M(main, attire.pattern);
        const wrap = put(new Mesh(new SphereGeometry(0.125, 14, 10), m), crown - 0.02, 0, -0.01);
        wrap.scale.set(1.05, 0.78, 1.12);
        put(new Mesh(new SphereGeometry(0.05, 8, 6), m), crown + 0.05, 0.06, -0.09);
        break;
      }
      case "mayafi":
      case "hijab": {
        const m = M(attire.head === "mayafi" ? shade(main, 1.25) : main);
        // Round the back and sides of the head, set back so the face shows in front (+z is the front).
        const veil = put(new Mesh(new SphereGeometry(0.13, 18, 12), m), crown - 0.05, 0, -0.085);
        veil.scale.set(1.1, 1.18, 0.95);
        put(new Mesh(new CylinderGeometry(0.11, attire.head === "mayafi" ? 0.3 : 0.22, attire.head === "mayafi" ? 0.55 : 0.22, 16, 1, true), m), h * (attire.head === "mayafi" ? 0.72 : 0.82));
        break;
      }
    }
    // Headwear is built round the head's centre with +z the face. Each frame it moves to the head and
    // turns to where the eyes look (see update), so it sits right whatever the animation does.
    model.updateMatrixWorld(true);
    const restY = this.root.worldToLocal(head.getWorldPosition(new Vector3())).y;
    for (const child of top.children) child.position.y -= restY;
    this.head = head;
    this.headwear = top;
    this.root.add(top);
  }

  private head: Bone | null = null;
  private eyes: SkinnedMesh | null = null;
  private headwear: Group | null = null;
  /** Robes, wrappers and beads: turned once to face the way the animated body faces. */
  private dress = new Group();
  /** Check which way the body faces after the next frame of a new clip. */
  private recheck = true;
  private model!: Object3D;
  private v = new Vector3();
  private w = new Vector3();

  /** Which way the face points, as a turn about y in the person's own space, from the animated eyes. */
  private faceTurn(at: Vector3): number | null {
    const e = this.eyes;
    if (!e) return null;
    const n = e.geometry.getAttribute("position").count;
    e.getVertexPosition(0, this.v);
    e.getVertexPosition(n - 1, this.w);
    this.v.add(this.w).multiplyScalar(0.5);
    this.root.worldToLocal(e.localToWorld(this.v));
    const dx = this.v.x - at.x;
    const dz = this.v.z - at.z;
    return Math.hypot(dx, dz) > 0.01 ? Math.atan2(dx, dz) : null;
  }

  private play(name: string, fade = 0.25) {
    const next = this.actions.get(name);
    if (!next || next === this.current) return;
    next.reset().play();
    this.recheck = true;
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  /** Walk, run or stand, matching the speed in ground units a second. pose overrides: dance, sit, talk. */
  update(dt: number, speed: number, pose?: Pose): void {
    this.t += dt;
    if (pose === "dance") this.play("Dance_Loop");
    else if (pose === "sit") this.play("Sitting_Idle_Loop");
    else if (pose === "talk") this.play("Idle_Talking_Loop");
    else if (pose === "work") this.play("Interact");
    else if (pose === "lie") this.play("Idle_Loop");
    else if (speed > 6) this.play("Sprint_Loop");
    else if (speed > 0.3) this.play("Walk_Loop");
    else this.play("Idle_Loop");
    if (this.current) this.current.timeScale = speed > 6 ? Math.min(1.3, speed / 8) : speed > 0.3 ? Math.min(1.6, 0.6 + speed / 4) : 1;
    this.mixer.update(dt);
    if (this.head && this.headwear) {
      this.root.updateMatrixWorld(true);
      const at = this.root.worldToLocal(this.head.getWorldPosition(this.headwear.position));
      const turn = this.faceTurn(at);
      if (turn !== null) {
        // Some clips face the body the other way (the sitting one does): after a clip change, turn the
        // body round so the person always faces +z, the way they are meant to be looking.
        if (this.recheck) {
          this.recheck = false;
          if (Math.cos(turn) < 0) {
            this.model.rotation.y += Math.PI;
            return this.update(0, speed, pose);
          }
        }
        this.headwear.rotation.y = turn;
      }
    }
    const s = Math.sin(this.t * (speed > 0.3 ? 8 : 1.5)) * (speed > 0.3 ? 0.05 : 0.01);
    for (const o of this.sway) o.rotation.x = s;
  }

  dispose() {
    this.mixer.stopAllAction();
    this.root.traverse((o) => {
      if (o instanceof Mesh && !(o as SkinnedMesh).isSkinnedMesh) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}
