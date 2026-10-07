# The world maps

Every LGA map, wherever it comes from, is the same plain JSON shape: `WorldMap`
in `types.ts`. Places, roads as polylines, an optional river, a biome, a size.
One renderer draws all of them.

## Where a map comes from

`loadMap()` in `load.ts` picks, in order:

1. **The hand-built Ilorin map** for the three Ilorin LGAs (`ilorin-map.ts`).
   Ilorin keeps the positions and the routing it was tuned with, so its trip
   distances, times and fares do not move (`src/sim/ilorin-parity.test.ts`).
   When `public/maps/kwara/ilorin-shapes.json` is there, each road is drawn along
   the real OpenStreetMap line instead of a straight dash: the shape is turned
   and scaled onto the map's own junction points by `fitShape()` in `shape.ts`,
   so the road bends the way the real road bends and the fares stay the same.
2. **A map built from OpenStreetMap**, fetched once by `scripts/osm-lga.mjs` and
   committed under `public/maps/<state>/<lga>.json`. Players never call
   OpenStreetMap. The data is ODbL, so every such map carries
   "© OpenStreetMap contributors" and the renderer prints it on screen.
3. **The generator** (`generate.ts`), a port of the prototype's LGA world
   builder, for any LGA nobody has fetched yet. Same seed, same hash, same
   numbers as the prototype (`generate.test.ts`).

For 2 and 3, `addPlayerPlaces()` adds the three places OpenStreetMap does not
hold: the citizen's own home (on a quieter real street a walk from the centre),
their workplace (on a bigger road near the centre) and the LGA notice board (at
the town hall, market or motor park). Nothing else is invented.

## Fares and distance

`routing.ts` builds a graph from the road polylines: road points are vertices,
roads that meet are welded, and each place is snapped to the nearest point on the
nearest road. A trip follows the real road line, so distance, time and fare come
from real road length. `normaliseTrips()` scales a map so a typical trip costs
about what the same trip costs in Ilorin (`TARGET_MEAN_TRIP`).

A `MapRoute` fits `src/sim/world.ts`'s `Route` with no adapter: same `pts`,
`length` and `highway`.

## Fetching

    node scripts/osm-lga.mjs ilorin               the three Ilorin LGAs and the Ilorin road shapes
    node scripts/osm-lga.mjs kwara/ilorin-west    one LGA
    node scripts/osm-lga.mjs --state kano         a whole state
    node scripts/osm-lga.mjs --all                every LGA, in batches
    node scripts/osm-lga.mjs --all --cache-only   rebuild from the cache, no network

It asks for main roads and places across the LGA, then for the streets inside a
small box around the places it found, so no single question is heavy. Raw answers
are cached under `.osm-cache` (gitignored), one request at a time with pauses, so
a re-run costs Overpass nothing.

## Looking at a map

    npm run dev
    node scripts/osm-shot.mjs                               the Ilorin map
    node scripts/osm-shot.mjs --lga kano/kano-municipal      any LGA
    node scripts/osm-shot.mjs --file public/maps/kwara/ilorin-west.json

Needs Playwright (`npm i playwright`); pass `--chrome <path>` to use a Chromium
that is already installed.

## Art

`tiles.ts` holds `KIND_ART` (kinds that already have a drawn tile) and
`MISSING_ART` (kinds drawn in code until an artist draws them). The placeholder
tiles are ported from the prototype, so a map is never blank.
