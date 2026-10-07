# Handover: Naija Votes 2027

Last updated 7 October 2026. Read this first, then `kl/CLAUDE.md` (the rules), `docs/DECISIONS.md`
(every decision made after the design; it wins over `docs/DESIGN.md`) and `docs/DESIGN.md`.

## Where things are

- Repo: `Muiz-code/Kwara-life`. The app lives in `kl/`; run every command from there.
- Working branch: `claude/laughing-cerf-2fs1cy`. It holds everything, including the maps work.
  `claude/osm-maps` was the maps branch and is fully merged in. Nothing is merged to `main` yet;
  open one PR from the working branch to `main` only when the owner asks.
- Season: launch Wed 14 Oct 2026, election Sat 14 Nov 2026, polls 8am to 4pm WAT, then the game freezes for good.

## Run it

```bash
cd kl
npm install
npm run dev          # http://localhost:3000
npm test             # vitest, 139 tests
npx tsc --noEmit     # types
npm run lint
npm run build        # must stay green before every push
```

- Open `http://localhost:3000/?debug` to test without waiting for real dates:
  - `window.kwara` is the game store, so you can call `kwara.getState()` and `kwara.setState(...)`.
  - The menu (☰, top left) gains **Test: jump the clock**: registration, PVC collection, blackout, polls open, last 3 minutes, polls closed.
- The whole election day plays through like this: jump to polls open, go to your polling unit, vote, jump to polls closed. Live collation then opens, followed by the winner screen and the closing message.

## How the code is laid out (inside `kl/src`)

| Folder | What it holds |
|---|---|
| `data/` | Pure data, with no React or Pixi. It covers:<ul><li>states and LGAs (185 LGAs, 555 PUs in `geography.ts`), the 21 parties, careers, the calendar (`calendar.ts`, real WAT dates), ads prices, transport and capitals</li><li>`districts.ts`: real district names per LGA, from web research</li><li>`ilorin/`: the hand-built Ilorin content</li><li>`i18n/`</li></ul> |
| `sim/` | Pure game rules, unit tested, and meant to be shared with the future edge functions. Randomness is always passed in (`Rng`). Modules: needs, clock, actions, travel and journey, work and jobs, police, EFCC, naija-life events, campaign, vote-buying, election, results. |
| `store/` | The Zustand store (`game.ts`), saved to localStorage under `kwara-life-v4`. `clock.ts` provides `clockNow()` (debug clock jumps) and `world.ts` adapts the map to the sim. |
| `world/` | Towns drawn on the isometric grid with PixiJS:<ul><li>`town-spec.ts` and `town.ts` generate rich, mixed and poor blocks, main roads, roundabouts, a slum, bus stops and traffic lights</li><li>`GameMap.ts` renders the town</li><li>`load.ts` exports `loadMap` and `townFor`</li></ul> |
| `components/` | `Game.tsx` (the screen) and `game/*` (HUD, place sheet, campaign, vote and results, phone, create citizen). `MapView.tsx` mounts the map. |

Art is in `kl/public/assets/`: tiles, vehicles, interiors and avatars. Each image's source URL is
listed in `kl/reference/*.txt`. `scripts/fetch_assets.py <list>` downloads those images and cuts them out with
`scripts/cutout.py`. Delete `public/assets/raw/<file>` first to force a fresh download.

## Rules that must not break

- **Neutrality:**
  - The ballot is alphabetical with equal boxes and no party logos.
  - Simulated voters vote with equal odds.
  - Crime and EFCC news never names a party or a real person.
  - No real-money political promotion.
  - No ritualists.
- **Ballot secrecy:** the saved game records only *that* you voted (`voted[]`). Your choice exists only in memory (`myBallot`) and is never saved. A test checks this.
- **Identity:** one citizen per account (Google sign-in, device and rate limits). No SMS or WhatsApp OTP.
- **Disclaimer:** it is shown everywhere: "A game. Not affiliated with INEC. Not a poll or prediction."
- **Copy:** Nigerian English, no em dashes anywhere, and no AI model names in repo content.
- **Mobile first:** check every UI change at 360px and 412px wide, and on desktop.

## Done

- Phases A, B, B2 and D:
  - pick your state and LGA, then your class, job and money are rolled;
  - needs, work, jobs, police, EFCC and Nigerian life events;
  - INEC registration and PVC collection on real dates;
  - campaigning with support cards, flyers and sponsored news, with a 24-hour blackout;
  - risky vote buying;
  - travel between LGAs and states (bus, flight, own car, and a long-journey screen when changing zone server);
  - voting only at your own polling unit;
  - live collation, the winner screen and the closing message, with the game frozen after polls close.
- Phase C (maps): block towns for every LGA, with real district names. The vehicle and traffic-light art is drawn on the streets.
- The menu, responsive fixes and the debug clock jumps.

## Next, in order

1. **Phase E: Supabase.** This is blocked until the owner provides these:
   - Supabase project URL, anon key and service key (one project per zone shard, NC, NE, NW, SE, SS and SW, plus one national project);
   - a Google OAuth client;
   - a Paystack account for the ads.

   Plan: `supabase/shard` and `supabase/national` hold migrations and edge functions (sign-up, act, vote, promo). All writes go through edge functions. There is a unique (citizen, election) constraint and idempotency keys, and votes are stored apart from identity. `src/sim` is reused inside the functions.
2. **Phase F:**
   - collation job and CDN results snapshots (players never query results directly);
   - live turnout counter from the server (currently simulated in `components/game/Vote.tsx`, `TurnoutCounter`);
   - load test.
3. **Ads portal:** real-money ads on in-game TV, billboards, the news ticker, radio and the journey screen. Pricing is ₦5,000 per showing or ₦4.5m per 1,000 showings (`data/ads.ts`). Videos are allowed but scaled and compressed to the slot, at 15 seconds maximum.
4. **Celebration video** for the winner screen. It must be generic: no party marks, with the party name and colour overlaid.
5. **Checks before launch:**
   - Ask the owner to confirm the airport list in `data/capitals.ts`.
   - Have a Nigerian review the low-confidence names in `data/districts.ts` (Jos, Sokoto, rural Niger, Zamfara, Bayelsa).
   - Get native-speaker review for the Yoruba, Hausa and Igbo strings.
   - Tidy small background leftovers on some landmark tiles.

## Tools in this setup

- **Art** comes from Higgsfield (MCP), using model `gpt_image_2_5` at 1:1, at most 4 per batch, and costs about 0.25 credits each. Style rules are in `kl/CLAUDE.md`. If a subject wears cream or white, run it through Higgsfield's background remover; `cutout.py` keeps alpha that is already there.
- **Commits:** clear messages, and push with `git push -u origin claude/laughing-cerf-2fs1cy`.
