#!/usr/bin/env node
// Screenshots the map in a real browser, so we can look at what the renderer draws.
// Needs the dev server running: npm run dev (or pass --url).
//
//   node scripts/osm-shot.mjs                        the hand-built Ilorin map
//   node scripts/osm-shot.mjs --lga kano/kano-municipal   a map from public/maps, or the generator
//   node scripts/osm-shot.mjs --out shots/kano.png --wait 6000
//
// Chromium is preinstalled in the build container, so launch it with software GL.
import { mkdir, readFile } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
register("./ts-hook.mjs", import.meta.url);
const { STATES } = await import("../src/data/states.ts");
const { LGAS, ILORIN_LGAS } = await import("../src/data/geography.ts");
const { addPlayerPlaces } = await import("../src/world/player-places.ts");
const { townFor } = await import("../src/world/load.ts");

// Playwright is a developer tool, not something the game ships, so it is not a
// dependency of the app. Install it where you run this: npm i playwright
const { chromium } = await import("playwright").catch(() => {
  console.error("This needs Playwright: npm i playwright (Chromium is already installed in the build container)");
  process.exit(1);
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const valueOf = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : d;
};

const url = valueOf("--url", "http://localhost:3000/");
const lgaCode = valueOf("--lga", null);
const out = path.resolve(ROOT, valueOf("--out", lgaCode ? `shots/${lgaCode.replace("/", "-")}.png` : "shots/ilorin.png"));
const wait = Number(valueOf("--wait", "7000"));
const size = valueOf("--size", "412x915").split("x").map(Number);

/** The map to drop on the page, or nothing for the hand-built Ilorin map. */
async function mapFor(code) {
  // A map file straight from public/maps, even for an Ilorin LGA, to check a fetch.
  const file = valueOf("--file", null);
  if (file) {
    return addPlayerPlaces(JSON.parse(await readFile(path.resolve(ROOT, file), "utf8")), {
      seed: `${file}/0/poor`, cls: "poor", job: "Tailor", home: "a rented room",
    });
  }
  if (!code || ILORIN_LGAS.includes(code)) return null; // the app's own default is Ilorin
  const lga = LGAS.find((l) => l.code === code);
  if (!lga) throw new Error(`Unknown LGA: ${code}`);
  const state = STATES.find((s) => s.code === lga.stateCode);
  const cls = valueOf("--class", "poor");
  return townFor({ lgaCode: code, state, lgaName: lga.name, cls, job: "Tailor", home: "a rented room", citizenSeed: "shot" });
}

const map = await mapFor(lgaCode);
await mkdir(path.dirname(out), { recursive: true });

// Software GL: the build container has no graphics card. A preinstalled Chromium
// can be pointed at with --chrome when the Playwright build does not match.
const chromePath = valueOf("--chrome", process.env.CHROME_PATH ?? null);
const browser = await chromium.launch({
  ...(chromePath ? { executablePath: chromePath } : {}),
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 2 });
page.on("console", (m) => console.log(`  page: ${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => console.log(`  page error: ${e.message}`));
if (map) await page.addInitScript((m) => { window.__naijaMap = m; }, map);
// --zoom 0.2 shows a whole town; --at x,y centres the camera there.
const zoom = valueOf("--zoom", null);
if (zoom) {
  const at = valueOf("--at", null)?.split(",").map(Number);
  await page.addInitScript((v) => { window.__naijaView = v; }, { zoom: Number(zoom), ...(at ? { x: at[0], y: at[1] } : {}) });
}
await page.goto(url, { waitUntil: "load", timeout: 60_000 });
await page.waitForTimeout(wait);
await page.screenshot({ path: out });
await browser.close();
console.log(`Wrote ${path.relative(ROOT, out)}`);
