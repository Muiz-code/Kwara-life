# Naija Votes 2027
A multiplayer Nigerian life-sim where every player picks their state and LGA and lives a randomly rolled life, gets their PVC,
campaigns, and votes once on a single shared election day. Free and fair is the premise.

## Reference
- reference/naija-votes-2027.html is the working single-player prototype (open it in a browser).
  Port its data, rules and balance. Do not copy its single-file structure.
- docs/DESIGN.md holds the game design and technical plan. Follow it; ask before changing a rule.
- docs/DECISIONS.md records decisions made after DESIGN.md (dates, maps, result privacy). It wins where they differ.
- reference/kwara-life.html is the earlier Ilorin-only prototype. Its places, actions and balance live on as the
  hand-built Ilorin map (Ilorin West, Ilorin East, Ilorin South).

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- PixiJS + pixi-viewport for the LGA world map (pan, zoom, sprites, camera follow)
- React for panels (Life, Campaign, Election), Zustand for client state
- Supabase: 6 zone shards (NC, NE, NW, SE, SS, SW) + 1 national project. Edge functions for all writes.
- The season ends on election day: when polls close the game freezes for everyone, results are announced, then a
  closing screen thanks players, urges them to vote in real elections and shows the disclaimer.
- Static results snapshots, news cache and ads served from a CDN; players never query results directly.

## Structure
The Next.js app lives in kl/ (all paths below are relative to it).
- src/data: states.ts (36 + FCT, 5 LGAs each, zone, slogan, landmark, default language), parties.ts (21 INEC parties,
  loaded from data, never hard-coded in UI), jobs.ts, biomes.ts, calendar.ts, i18n/ (en, pcm, yo, ha, ig),
  ilorin/ (hand-built Ilorin places, roads, actions, billboard slots)
- src/sim: needs, clock, actions, travel, media, campaign, vote-buying, election, results (pure, unit tested,
  shared with the edge functions)
- src/world: LGA towns drawn on the isometric grid (rich, mixed and poor districts, biome, landmark, roads),
  buildings, traffic, interiors; Ilorin keeps its hand-built map
- src/store: Zustand client state; src/net: typed client for edge functions and CDN snapshots
- src/components: HUD, panels, modals, ballot, results
- supabase/shard and supabase/national: migrations, edge functions (sign-up, act, vote, promo), collation job
- scripts/: cutout.py and fetch_assets.py (art), OSM road extraction, data seeding

## Non-negotiable rules
- Neutral: alphabetical ballot, equal boxes, no party logos, equal promotion prices, simulated voters vote with
  equal odds. Crime news never names a party.
- One person, one citizen, one vote: one citizen per account (Google sign-in, device and rate limits; no SMS or
  WhatsApp OTP), unique (citizen, election) constraint, idempotency keys. Voting happens in the game at the
  polling unit.
- Ballot secrecy: votes stored apart from identity. Results show totals only.
- No player chat. Support cards (fixed issue list + 80-char filtered note), flyers and sponsored news only.
- Campaign blackout 24 hours before election day. Daily promotion cap per player. In-game money only for promotion.
- Vote buying: risky, unverifiable, effect limited to the buyer's own LGA (see docs/DESIGN.md).
- Disclaimer everywhere: a game, not affiliated with INEC, not a poll or prediction.
- Nigerian English and local flavour in copy. No em dashes anywhere. Yoruba, Hausa and Igbo strings need
  native-speaker review before release.
- Mobile first: must run smoothly on a mid-range Android phone on mobile data.

## Image style (Higgsfield)
Soft clay 3D render, warm harmattan afternoon light, isometric diorama on a small square ground base, plain flat
cream background (#F3EBDD), no text, no logos. One tile set per zone (Sahel, savanna, rainforest, hills, delta)
plus each state's landmark.

## Working style
Plan first, wait for approval, build in phases, commit after each working phase.
