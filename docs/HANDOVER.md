# Handover: Naija Votes

Last updated 9 October 2026. Read this first, then `CLAUDE.md` (the rules), `docs/DECISIONS.md`
(every decision made after the design; it wins over `docs/DESIGN.md`) and `docs/DESIGN.md`.

## Where things are

- Repo: `Muiz-code/Naija-Votes` (renamed from `Kwara-life` on 9 October 2026). The app lives at the repo root;
  the old `kl/` folder is gone. Run every command from the root.
- Working branch: `main`. The `claude/laughing-cerf-2fs1cy` and `claude/osm-maps` branches are merged and old.
  The OpenStreetMap map code was dropped (see DECISIONS.md, Maps).
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

- Open `http://localhost:3000/?debug` to test without waiting for real dates. This works in `npm run dev` and in builds
  made with `NEXT_PUBLIC_ALLOW_DEBUG=1` (tester previews only). A normal production build strips it out completely:
  - `window.kwara` is the game store, so you can call `kwara.getState()` and `kwara.setState(...)`.
  - The menu (☰, top left) gains **Test: jump the clock**: registration, PVC collection, blackout, polls open, last 3 minutes, polls closed.
- The whole election day plays through like this: jump to polls open, go to your polling unit, vote, jump to polls closed. Live collation then opens, followed by the winner screen and the closing message.

## How the code is laid out (inside `src`)

| Folder | What it holds |
|---|---|
| `data/` | Pure data, with no React or Pixi. It covers:<ul><li>states and LGAs (185 LGAs, 555 PUs in `geography.ts`), the 21 parties, careers, the calendar (`calendar.ts`, real WAT dates), ads prices, transport and capitals</li><li>`districts.ts`: real district names per LGA, from web research</li><li>`ilorin/`: the hand-built Ilorin content</li><li>`i18n/`</li></ul> |
| `sim/` | Pure game rules, unit tested, and meant to be shared with the future edge functions. Randomness is always passed in (`Rng`). Modules: needs, clock, actions, travel and journey, work and jobs, police, EFCC, naija-life events, campaign, vote-buying, election, results. |
| `store/` | The Zustand store (`game.ts`), saved to localStorage under `kwara-life-v4`. `clock.ts` provides `clockNow()` (debug clock jumps) and `world.ts` adapts the map to the sim. |
| `world/` | Towns drawn on the isometric grid with PixiJS:<ul><li>`town-spec.ts` and `town.ts` generate rich, mixed and poor blocks, main roads, roundabouts, a slum, bus stops and traffic lights</li><li>`GameMap.ts` renders the town</li><li>`load.ts` exports `loadMap` and `townFor`</li></ul> |
| `components/` | `Game.tsx` (the screen) and `game/*` (HUD, place sheet, campaign, vote and results, phone, create citizen). `MapView.tsx` mounts the map. |

Art is in `public/assets/`: tiles, vehicles, interiors and avatars. Each image's source URL is
listed in `reference/*.txt`. `scripts/fetch_assets.py <list>` downloads those images and cuts them out with
`scripts/cutout.py`. Delete `public/assets/raw/<file>` first to force a fresh download.

## Anti-cheat (client side, until Phase E)

The browser is the player's, so nothing here is final; it closes the easy cheats and keeps the checks in
`src/sim` for the edge functions to reuse. The server must never trust a client save or request.

- **Clock:** `clockNow()` runs from the server's time (`/api/time`) plus `performance.now()`, so changing the
  phone's date doesn't open the polls early.
- **Saves:** written through `store/seal.ts` with a signature; an edited or unsigned save is dropped.
  `sim/sanitize.ts` then rejects impossible values (bad types, money over ₦10bn, pay over the career's
  maximum, job applications that were never on a board).
- **Inputs:** the sim trusts ids only. `applyForJob` rebuilds the opening from its id, and the lookup tables
  (`PARTY`, `LGA`, `STATE`, `PLACE`) have no prototype, so names like `"constructor"` aren't treated as real
  entries. The store never commits a state whose money is `NaN`.
- **Headers:** CSP, frame blocking, HSTS and friends are in `next.config.ts`. Add the Supabase and Paystack
  origins to `connect-src` when they land.

## Launch checklist (a million players)

Supabase project 1 is `ykdpwbxfkarnhttdnute` (see supabase/migrations and supabase/config.toml; push config with
`npx supabase config push`, which sends EVERY auth setting in the file, so keep the file matching the live project).

Must do before launch:
1. **Server-side game.** Saves, citizens and votes still live in the browser. Build the server routes (create citizen,
   save sync through sanitizeGame, vote with the voter roll) before the election counts for anything.
2. **Email sender.** Supabase's built-in email is for testing only. Connect an SMTP provider (Resend, Amazon SES,
   Brevo) with SPF and DKIM on your domain, or players never get their confirmation links.
3. **Supabase plan.** Free caps at 50k monthly users and pauses idle projects. Pro includes 100k monthly users, then
   charges about $0.00325 per extra user (about $2,900 a month at a million). Pro ships with a spend cap ON, which
   blocks usage past the included quota: turn it off (and set a budget alert) or players past 100k can't sign in.
   Consider a bigger compute size for election day.
4. **Auth rate limits.** Nigerian mobile networks put many people behind one address. Raise the per-address sign-up
   and sign-in limits in config.toml [auth.rate_limit], and switch on Sb-Forwarded-For for the project so sign-ins
   through /api/auth/signin count per player, not per server (ask Supabase support if it isn't in the dashboard).
5. **Bots.** Add Cloudflare Turnstile to sign-up ([auth.captcha] in config.toml plus the widget in AuthGate).
6. **Load test** the sign-in route, save sync and the vote path at election-day rates before 14 Nov.
7. **Hosting.** Production env vars on the host (never NEXT_PUBLIC_ on the secret key); site_url and redirect URLs
   set to the real domain; daily backups (Pro) and point-in-time recovery for the vote tables.

## Rules that must not break

- **Neutrality:**
  - The ballot is alphabetical with equal boxes and no party logos.
  - Simulated voters vote with equal odds.
  - Crime and EFCC news never names a party or a real person.
  - No real-money political promotion.
  - No ritualists.
- **Ballot secrecy:** the saved game records only *that* you voted (`voted[]`). Your choice exists only in memory (`myBallot`) and is never saved. A test checks this.
- **Age:** 18 and over only. Sign-up checks a date of birth on the form and in the sign-up guard, then throws it away; only the time of confirming is kept (public.age_checks).
- **Identity:** one citizen per account: email and password with a confirmed email, a sign-up guard in Supabase (no throwaway inboxes, one account per real mailbox), device and rate limits. No SMS or WhatsApp OTP.
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

- **Art** comes from Higgsfield (MCP), using model `gpt_image_2_5` at 1:1, at most 4 per batch, and costs about 0.25 credits each. Style rules are in `CLAUDE.md`. If a subject wears cream or white, run it through Higgsfield's background remover; `cutout.py` keeps alpha that is already there.
- **Commits:** clear messages, and push with `git push -u origin claude/laughing-cerf-2fs1cy`.
