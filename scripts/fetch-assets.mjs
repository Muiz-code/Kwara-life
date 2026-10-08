// Node port of fetch_assets.py + cutout.py, for machines without Python (sharp ships with Next).
// Usage:  node scripts/fetch-assets.mjs [list-file] [--only <label prefix>]
//   e.g.  node scripts/fetch-assets.mjs reference/tiles.txt --only tiles/airport
// Downloads each image to public/assets/raw/<label>.png (skipped if already there), then cuts the flat cream
// background off tiles, sprites and avatars into public/assets/<label>.webp. Interiors are only resized.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "public/assets/raw");
const OUT = path.join(ROOT, "public/assets");

const args = process.argv.slice(2);
const onlyAt = args.indexOf("--only");
const only = onlyAt >= 0 ? args.splice(onlyAt, 2)[1] : "";
const lists = args.length ? args : ["reference/assets.txt", "reference/tiles.txt"];

function* entries() {
  for (const f of lists) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      if (!line.trim() || line.startsWith("#")) continue;
      const [label, kind, url] = line.split("|").map((s) => s.trim());
      if (label.startsWith(only)) yield { label, kind, url };
    }
  }
}

/** Cut the background off, as cutout.py does: flood fill from the border, then enclosed background gaps. */
async function cutout(file, out, { width = 440, holes = true } = {}) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  if (Array.from({ length: w * h }, (_, i) => data[i * 4 + 3]).some((a) => a < 128)) {
    // Already cut out (Higgsfield background remover): keep its alpha.
    return save(sharp(file), out, width);
  }
  // Background colour = median of the border pixels.
  const border = [];
  for (let x = 0; x < w; x++) border.push(px(x), px((h - 1) * w + x));
  for (let y = 0; y < h; y++) border.push(px(y * w), px(y * w + w - 1));
  const bg = [0, 1, 2].map((k) => border.map((p) => p[k]).sort((a, b) => a - b)[border.length >> 1]);
  const bgMean = (bg[0] + bg[1] + bg[2]) / 3;
  const bgSum = bg[0] + bg[1] + bg[2];
  const near = new Uint8Array(w * h);
  const diff = new Uint16Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b] = px(i);
    const d = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
    const m = (r + g + b) / 3;
    const chroma = Math.abs(r - m - (bg[0] - bgMean)) + Math.abs(g - m - (bg[1] - bgMean)) + Math.abs(b - m - (bg[2] - bgMean));
    diff[i] = d;
    near[i] = d < 45 || (chroma < 22 && r + g + b > bgSum - 150) ? 1 : 0;
  }
  const mask = new Uint8Array(w * h);
  const fill = (seeds, ok, mark) => {
    const q = [...seeds];
    for (let k = 0; k < q.length; k++) {
      const i = q[k];
      const x = i % w;
      for (const n of [i - w, i + w, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1]) {
        if (n >= 0 && n < w * h && ok(n) && !mark[n]) {
          mark[n] = 1;
          q.push(n);
        }
      }
    }
    return q;
  };
  const seeds = [];
  for (let x = 0; x < w; x++) for (const i of [x, (h - 1) * w + x]) if (near[i] && !mask[i]) {
    mask[i] = 1;
    seeds.push(i);
  }
  for (let y = 0; y < h; y++) for (const i of [y * w, y * w + w - 1]) if (near[i] && !mask[i]) {
    mask[i] = 1;
    seeds.push(i);
  }
  fill(seeds, (n) => near[n], mask);
  if (holes) {
    // Background seen through gaps never touches the border: drop enclosed patches of almost exactly bg.
    const seen = new Uint8Array(w * h);
    const minArea = 0.002 * w * h;
    for (let i = 0; i < w * h; i++) {
      if (seen[i] || mask[i] || diff[i] >= 12) continue;
      seen[i] = 1;
      const pts = fill([i], (n) => !mask[n] && diff[n] < 12, seen);
      if (pts.length > minArea) for (const p of pts) mask[p] = 1;
    }
  }
  // Shrink the kept area by 2px (MinFilter(5)), then soften the edge.
  let alpha = Buffer.from(mask.map((m) => (m ? 0 : 255)));
  alpha = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).erode(2).blur(1).extractChannel(0).raw().toBuffer();
  const rgba = Buffer.from(data);
  for (let i = 0; i < w * h; i++) rgba[i * 4 + 3] = alpha[i];
  return save(sharp(rgba, { raw: { width: w, height: h, channels: 4 } }), out, width);
}

async function save(img, out, width) {
  const buf = await img.png().toBuffer();
  const trimmed = await sharp(buf).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).toBuffer();
  const final = await sharp(trimmed).resize({ width }).webp({ quality: 82, effort: 6 }).toFile(out);
  console.log(`${path.relative(ROOT, out)}  ${final.width}x${final.height}`);
}

for (const { label, kind, url } of entries()) {
  const raw = path.join(RAW, `${label}.png`);
  fs.mkdirSync(path.dirname(raw), { recursive: true });
  if (!fs.existsSync(raw)) {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`${label}: download failed (${res.status})`);
      continue;
    }
    fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  }
  const out = path.join(OUT, `${label}.webp`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (kind === "interior") {
    const r = await sharp(raw).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80, effort: 6 }).toFile(out);
    console.log(`${path.relative(ROOT, out)}  ${r.width}x${r.height}`);
  } else {
    await cutout(raw, out, { holes: !path.basename(label).startsWith("avatar-") });
  }
}
