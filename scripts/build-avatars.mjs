// Builds the people models the game ships from the Quaternius packs (CC0) in reference/quaternius:
//   node scripts/build-avatars.mjs
// Unzip "Universal Base Characters[Standard].zip" into reference/quaternius/base and
// "Universal Animation Library[Standard].zip" into reference/quaternius/anim first.
// Writes public/models/man.glb, woman.glb (bodies, small WebP textures, compressed) and anims.glb
// (only the animations the game plays, on the shared 65-bone skeleton, no mesh).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, resample, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "reference/quaternius");
const OUT = path.join(ROOT, "public/models");
const BODIES = path.join(SRC, "base/Universal Base Characters[Standard]/Base Characters/Godot - UE");
const ANIMS = path.join(SRC, "anim/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb");

/** The animations the game plays. */
const KEEP = new Set([
  "Idle_Loop", "Walk_Loop", "Jog_Fwd_Loop", "Sprint_Loop", "Dance_Loop", "Sitting_Idle_Loop",
  "Idle_Talking_Loop", "Interact", "PickUp_Table", "Driving_Loop",
]);

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
fs.mkdirSync(OUT, { recursive: true });

// The packs name two textures with a _png suffix they do not ship.
for (const [from, to] of [["T_Hair_1_Normal.png", "T_Hair_1_Normal_png.png"], ["T_Eye_Normal.png", "T_Eye_Normal_png.png"]]) {
  const target = path.join(BODIES, to);
  if (!fs.existsSync(target)) fs.copyFileSync(path.join(BODIES, from), target);
}

async function body(file, out) {
  const doc = await io.read(path.join(BODIES, file));
  // Roughness maps cost more than they show on a phone: drop them.
  for (const m of doc.getRoot().listMaterials()) m.setMetallicRoughnessTexture(null);
  await doc.transform(
    prune(),
    dedup(),
    weld(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [512, 512], quality: 82 }),
    // No mesh compression here: it stores positions as whole numbers, and the game reads the body's
    // rest-pose positions in metres to know where clothes go.
  );
  await io.write(path.join(OUT, out), doc);
  console.log(`${out}  ${(fs.statSync(path.join(OUT, out)).size / 1024).toFixed(0)} KB`);
}

async function anims(out) {
  const doc = await io.read(ANIMS);
  const root = doc.getRoot();
  for (const a of root.listAnimations()) if (!KEEP.has(a.getName())) a.dispose();
  // Fingers are too small to see from the street, and are most of the data: keep the hand, drop the fingers.
  // Bone scale never changes in these clips either.
  const finger = /^(index|middle|pinky|ring|thumb)_/;
  for (const a of root.listAnimations()) {
    for (const ch of a.listChannels()) {
      const bone = ch.getTargetNode()?.getName() ?? "";
      // Joints only turn; only the hips and root move through space.
      const moves = ch.getTargetPath() === "translation" && bone !== "pelvis" && bone !== "root";
      if (finger.test(bone) || ch.getTargetPath() === "scale" || moves) {
        ch.getSampler()?.dispose();
        ch.dispose();
      }
    }
  }
  // Keep the skeleton, drop the mannequin mesh: the clips bind to bones by name.
  for (const n of root.listNodes()) if (n.getMesh()) n.setMesh(null).setSkin(null);
  for (const m of root.listMeshes()) m.dispose();
  await doc.transform(resample({ tolerance: 0.002 }), prune({ keepLeaves: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: "high" }));
  await io.write(path.join(OUT, out), doc);
  console.log(`${out}  ${(fs.statSync(path.join(OUT, out)).size / 1024).toFixed(0)} KB, ${root.listAnimations().map((a) => a.getName()).join(", ")}`);
}

await body("Superhero_Male_FullBody.gltf", "man.glb");
await body("Superhero_Female_FullBody.gltf", "woman.glb");
await anims("anims.glb");
