#!/usr/bin/env node
// Fetches real road shapes and real places for an LGA from OpenStreetMap, through
// Overpass, and writes the map as static JSON under public/maps/<state>/<lga>.json.
// Players never call OpenStreetMap: this runs once, here, and the result is
// committed. OpenStreetMap data is ODbL, so every map carries the credit line.
//
// Be polite to Overpass: one request at a time, a pause between requests, and raw
// answers cached under .osm-cache (gitignored) so a re-run costs nothing.
//
// Usage:
//   node scripts/osm-lga.mjs ilorin              the three Ilorin LGAs and the Ilorin road shapes
//   node scripts/osm-lga.mjs kwara/ilorin-west   one LGA by code
//   node scripts/osm-lga.mjs --state kwara       every LGA in a state
//   node scripts/osm-lga.mjs --all               all 185 LGAs (hours, so run it in batches)
//   node scripts/osm-lga.mjs --all --cache-only  rebuild maps from the cache, no network
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The app's TypeScript, run straight through Node's type stripping.
register("./ts-hook.mjs", import.meta.url);
const { LGAS, ILORIN_LGAS } = await import("../src/data/geography.ts");
const { STATES } = await import("../src/data/states.ts");
const { ZONE_BIOME } = await import("../src/data/biomes.ts");
const { PLACES, WAYPOINTS } = await import("../src/data/ilorin/places.ts");
const { ROADS } = await import("../src/data/ilorin/roads.ts");
const { osmToWorldMap, shapeBetween } = await import("../src/world/osm.ts");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, ".osm-cache");
const OUT = path.join(ROOT, "public", "maps");

// overpass-api.de first. The mirrors only help where the network allows them;
// one that is blocked or refuses is dropped for the rest of the run.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const blocked = new Set();
const UA = "naija-votes-2027 map builder (one-off LGA fetch; contact: the repository owner)";
/** Overpass asks for a gap between requests. Be generous. */
const PAUSE_MS = 12_000;
const RETRIES = 6;
/** Waits between retries. Overpass turns people away when it is busy. */
const BACKOFF_MS = [30_000, 60_000, 120_000, 240_000, 480_000, 480_000];

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const valueOf = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const CACHE_ONLY = flag("--cache-only");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Civic and landmark tags worth asking Overpass for. */
const PLACE_FILTERS = [
  '["amenity"~"^(townhall|place_of_worship|marketplace|bus_station|school|college|university|restaurant|fast_food|cafe|cinema)$"]',
  '["shop"~"^(newsagent|books|kiosk|supermarket)$"]',
  '["office"="government"]',
  '["tourism"~"^(hotel|attraction|museum)$"]',
  '["historic"="palace"]',
  '["leisure"~"^(stadium|park|garden|sports_centre|nature_reserve)$"]',
  '["man_made"~"^(tower|bridge)$"]',
  '["natural"~"^(peak|rock|water)$"]',
  '["aeroway"="aerodrome"]',
];

const HIGHWAYS = "^(trunk|primary|secondary|tertiary|residential|unclassified)$";

/** The Overpass query for one LGA, by its name inside its state. */
function lgaQuery(stateName, lgaName) {
  const places = PLACE_FILTERS.map(
    (f) => `  node(area.a)${f};\n  way(area.a)${f};\n  relation(area.a)${f};`,
  ).join("\n");
  return `[out:json][timeout:300];
area["boundary"="administrative"]["admin_level"="4"]["name"="${stateName}"]->.st;
(
  relation(area.st)["boundary"="administrative"]["admin_level"="6"]["name"="${lgaName}"];
  relation(area.st)["boundary"="administrative"]["admin_level"="5"]["name"="${lgaName}"];
)->.lga;
.lga map_to_area->.a;
(way(area.a)["highway"~"${HIGHWAYS}"];);
out geom;
(
${places}
);
out center tags;`;
}

/** Roads and places around a point, for the hand-built Ilorin map's shapes. */
function aroundQuery(south, west, north, east) {
  return `[out:json][timeout:300];
(way(${south},${west},${north},${east})["highway"~"${HIGHWAYS}"];);
out geom;`;
}

async function overpass(key, query) {
  await mkdir(CACHE, { recursive: true });
  const file = path.join(CACHE, `${key}.json`);
  if (existsSync(file)) {
    const raw = JSON.parse(await readFile(file, "utf8"));
    console.log(`  cached: ${key} (${raw.elements.length} elements)`);
    return raw;
  }
  if (CACHE_ONLY) throw new Error(`No cached answer for ${key}, and --cache-only was passed`);

  let lastError = null;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const open = ENDPOINTS.filter((e) => !blocked.has(e));
    if (!open.length) throw new Error("Every Overpass endpoint is blocked from this network");
    const url = open[attempt % open.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
        body: new URLSearchParams({ data: query }),
      });
      if (res.status === 429 || res.status === 503 || res.status === 504) throw new Error(`Overpass busy (${res.status})`);
      if (!res.ok) throw new Error(`Overpass said ${res.status} ${res.statusText}`);
      const raw = await res.json();
      await writeFile(file, JSON.stringify(raw));
      console.log(`  fetched: ${key} (${raw.elements.length} elements) from ${new URL(url).host}`);
      await sleep(PAUSE_MS);
      return raw;
    } catch (err) {
      lastError = err;
      // A network that does not allow this mirror fails the same way every time.
      if (/fetch failed|ENOTFOUND|ECONNREFUSED|403/.test(err.message) && open.length > 1) {
        blocked.add(url);
        console.warn(`  ${key}: ${new URL(url).host} is not reachable from here, dropping it`);
        continue;
      }
      const wait = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      console.warn(`  ${key}: ${err.message}. Waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
  throw lastError ?? new Error(`Could not fetch ${key}`);
}

async function buildLga(lga) {
  const state = STATES.find((s) => s.code === lga.stateCode);
  if (!state) throw new Error(`No state for ${lga.code}`);
  const key = `${state.code}--${slug(lga.name)}`;
  const raw = await overpass(key, lgaQuery(state.name, lga.name));
  const { map, missing, stats } = osmToWorldMap(raw, {
    id: lga.code,
    name: lga.name,
    biome: ZONE_BIOME[state.zone],
  });
  const file = path.join(OUT, state.code, `${slug(lga.name)}.json`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(map));
  console.log(
    `  ${lga.code}: ${stats.roadsOut}/${stats.roadsIn} roads, ${stats.placesOut} places, tiles moved up to ${stats.movedMax}px` +
      (missing.length ? `, nothing in OSM for: ${missing.join(", ")}` : ""),
  );
  return { map, missing };
}

/** The hand-built Ilorin map keeps its layout; only the road shapes come from OSM. */
async function buildIlorinShapes() {
  const at = Object.fromEntries([
    ...PLACES.map((p) => [p.id, { lat: p.lat, lng: p.lng }]),
    ...WAYPOINTS.map((w) => [w.id, { lat: w.lat, lng: w.lng }]),
  ]);
  const lats = Object.values(at).map((p) => p.lat);
  const lngs = Object.values(at).map((p) => p.lng);
  const pad = 0.03;
  let raw;
  try {
    raw = await overpass(
      "kwara--ilorin-roads",
      aroundQuery(Math.min(...lats) - pad, Math.min(...lngs) - pad, Math.max(...lats) + pad, Math.max(...lngs) + pad),
    );
  } catch (err) {
    // Overpass turned us away. Any Kwara answers already cached still hold roads.
    const files = (await readdir(CACHE)).filter((f) => f.startsWith("kwara--") && f.endsWith(".json"));
    if (!files.length) throw err;
    console.warn(`  Ilorin: ${err.message}. Using ${files.length} cached Kwara answer(s) for the shapes`);
    const elements = [];
    for (const f of files) elements.push(...JSON.parse(await readFile(path.join(CACHE, f), "utf8")).elements);
    raw = { elements };
  }
  const shapes = {};
  let found = 0;
  for (const r of ROADS) {
    const line = shapeBetween(raw, at[r.a], at[r.b]);
    if (line && line.length > 2) {
      shapes[`${r.a}|${r.b}`] = line;
      found++;
    }
  }
  const file = path.join(OUT, "kwara", "ilorin-shapes.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(shapes));
  console.log(`  Ilorin: real road shapes for ${found}/${ROADS.length} roads`);
}

async function main() {
  const targets = [];
  let ilorinShapes = false;

  if (flag("--all")) {
    targets.push(...LGAS);
    ilorinShapes = true;
  } else if (valueOf("--state")) {
    const code = valueOf("--state");
    targets.push(...LGAS.filter((l) => l.stateCode === code));
    if (code === "kwara") ilorinShapes = true;
  } else {
    for (const a of args) {
      if (a.startsWith("--")) continue;
      if (a === "ilorin") {
        targets.push(...LGAS.filter((l) => ILORIN_LGAS.includes(l.code)));
        ilorinShapes = true;
      } else {
        const lga = LGAS.find((l) => l.code === a);
        if (!lga) throw new Error(`Unknown LGA: ${a}. Use a code like kwara/ilorin-west`);
        targets.push(lga);
      }
    }
  }

  if (!targets.length && !ilorinShapes) {
    console.log(await readFile(fileURLToPath(import.meta.url), "utf8").then((s) => s.split("\n").slice(14, 21).join("\n").replace(/^\/\/ ?/gm, "")));
    process.exit(1);
  }

  console.log(`Building ${targets.length} LGA map${targets.length === 1 ? "" : "s"}${CACHE_ONLY ? " from the cache" : ""}`);
  const missingArt = new Map();
  for (const lga of targets) {
    try {
      const { map, missing } = await buildLga(lga);
      for (const k of missing) missingArt.set(k, (missingArt.get(k) ?? 0) + 1);
      void map;
    } catch (err) {
      console.error(`  ${lga.code}: ${err.message}`);
    }
  }
  if (ilorinShapes) await buildIlorinShapes();

  if (missingArt.size) {
    console.log("\nKinds OpenStreetMap had nothing for, by how many LGAs:");
    for (const [kind, n] of [...missingArt].sort((a, b) => b[1] - a[1])) console.log(`  ${kind}: ${n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
