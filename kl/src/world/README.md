# The world maps

Every LGA is a town on an isometric grid, built from a seed made from its LGA
code: the same town for everyone in that LGA, a different one in the next.
Ilorin is built in the same system from its real places.

## The rules a town keeps

- Streets run along the two grid directions only, so corners are square and
  junctions are real junctions.
- Every other cell is a plot. A building only ever stands on its own plot, with
  its own yard, a wall or fence to suit the district, and a gate and path out to
  each street the plot touches. A road never passes under a building.
- Places are reached through their gates (`MapPlace.gates`), so trips never cut
  across someone else's plot.
- Each place's tile is mirrored to face its street.

`town.test.ts` checks these for every LGA in the country.

## Blocks

A town is a grid of big single-use blocks with main roads between them and a
roundabout wherever four main roads cross:

- estate (GRA: duplexes on big walled plots), low-cost housing, and the slum
  (shacks on dirt tracks, always given a plain name like "Railway Line", never a
  real neighbourhood's)
- mixed (flats and offices), civic (INEC, town hall), commercial (market, motor
  park, bukas) and a commercial avenue full of adverts
- open blocks drawn as one piece of ground: schools with their pitches, a park
  for the state landmark, campuses and the airport

Lanes (or dirt tracks in the slum) run inside a block. Busy junctions get
traffic lights, and main roads get bus stops where the danfos stop. The motor
park sits by the town entrance, the highway coming in from the state capital.
The citizen's home goes by class. Block names come from
`src/data/districts.ts`, falling back to generic names, and no two blocks in a
town share a name.

The seed also picks the plan, which way up and round it goes, and the block
sizes. Delta towns and states whose landmark is water or a bridge get a river
with bridges; the south-east gets hills; farming states get fields round the
edge. The zone's biome sets the ground, trees and the look of every building.

Ilorin uses the same blocks, laid out after the real town: the airport,
Unilorin and Tanke at the top, Post Office and Oja Oba, Ahmadu Bello Way and
Taiwo, GRA and Adewole either side of Metro Square, KWASU and Fate Road, and
the Malete road out to KWASU's farm.

## Files

- `town.ts`: the builder. `buildTown(spec)` gives a `WorldMap`.
- `town-spec.ts`: what goes in each LGA's town (`townSpecFor`).
- `ilorin-town.ts`: Ilorin from its real places, with its trips scaled to the
  hand-built map's.
- `load.ts`: `loadMap(request)` picks and caches the right town.
- `town-ground.ts`, `shacks.ts`, `traffic.ts`, `vehicles.ts`, `tile-art.ts`: drawing.
- `routing.ts`: routes along the streets; `lengthScale` keeps fares and times at
  the prototype's scale however big the town is drawn.

`generate.ts` and `ground.ts` are the prototype's free-form LGA builder and its
renderer, kept as a tested reference; the game uses the grid towns.

## Art

`tile-art.ts` maps each kind and zone look to a tile in `public/assets/tiles`.
Anything without a file is drawn in code. Vehicles look for
`public/assets/vehicles/<kind>-front.webp` and `<kind>-back.webp` and are drawn
in code until those exist.

## Looking at a town

    npm run dev
    node scripts/osm-shot.mjs                                   Ilorin
    node scripts/osm-shot.mjs --lga kano/fagge                  any LGA
    node scripts/osm-shot.mjs --lga delta/warri-south --zoom 0.2   the whole town

Needs Playwright (`npm i playwright`); pass `--chrome <path>` to use an installed
Chromium.
