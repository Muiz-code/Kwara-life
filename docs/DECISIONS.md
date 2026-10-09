# Decisions after DESIGN.md
Newest first. These win where they differ from DESIGN.md or the prototype.

## October 2026

### Pace and feel (9 October 2026)
- Needs: a bar at empty warns you and gives 2 real minutes (240 game minutes). Then hunger means hospital,
  tiredness a collapse, no bath "Smelling" (social drains twice as fast) and no fun or company "Feeling low".
- Rides and actions take real time, always skippable (Skip fast-forwards, never jumps): a keke about 15
  seconds across town at its speed, eating 20, sleep 30, a work shift 60 to 90. Vehicles stay on the roads.
- Counters: VINEC, the bank officer, food places and the Supermart give you a ticket, a real 30 to 90 second
  wait, then steps you tap or hold. Every business has a person at a counter you can tap or talk to.
- Item 7 is take-away only: meals are packed and eaten at home.
- Work shifts have tasks for your job, each handled pays a small bonus. Crime careers get no bonus tasks.

### Sync (9 October 2026)
Sync is an in-game company: an office in every town, a phone app (ride, homes to rent or buy, what's on, car
hire with a driver for the day) and an employer on the jobs board every week (cleaner to engineer).

### Name
The game is called Naija Votes (9 October 2026). It replaces "Naija Votes 2027" and the short in-game "Naija".
The prototype file keeps its old name, reference/naija-votes-2027.html.

### One game
Kwara Life and Naija Votes are one game. Kwara Life's engine (needs, clock, travel, Pixi map, art pipeline)
becomes the engine for the whole country. Ilorin keeps its hand-built map and its places, actions and balance.

### Dates
- The game runs one month: launch Wednesday 14 October 2026, election day Saturday 14 November 2026, polls
  8am to 4pm. Election day is a real date in WAT, held on the server and changeable (postponement). This
  replaces the 16 January 2027 date in DESIGN.md for the game. The season closes after results.
  Moving it moves the blackout (24 hours before polls open) and posts an "INEC announces new date" news item.
- Voter registration opens 2 minutes after a player creates their citizen and closes on 30 October 2026.
- When registration closes, every player is told to go and collect their PVC. Collection runs from
  31 October until 10 minutes before polls open (7:50am on 14 November). The blackout starts 8am Friday
  13 November.
- Citizens created after registration closes are rolled as holding a PVC or registered with one to collect,
  never unregistered, so they can still take part.
- Everything else (time of day, needs, work, shop hours, Jummah and Sunday service, trips) runs on the
  player's game clock.

### Citizens
Players pick their state and LGA. Class, job, home, money, PVC status, TV and radio, and polling unit are rolled
once, as in the prototype.

### Maps
- Every LGA is a hand-designed town generated from a seed (the LGA code), so each one is different but the same
  for every player in it. Streets run on the isometric grid, like Lagos Life but tidier. No OpenStreetMap: no
  outside service, no big downloads, every town readable on a phone.
- Three districts: a rich side (GRA or estate), a mixed centre (market, motor park, INEC office, polling unit
  school, town hall, mosque, church, viewing centre, news stand, state landmark) and a poor side (compounds,
  workshops, buka, flyover, shelter). The citizen's home goes by class, so distance matters.
- Real flavour only where it is real: LGA names, the state landmark, the zone's look (Sahel, savanna, rainforest,
  hills, Delta creeks, green farmland where farming is big), local market and food names, and real neighbourhood
  names per state (draft list in src/data/districts.ts, needs the user's review).
- Ilorin is rebuilt in the same system with its real areas and its 27 places.

### Result privacy
A polling unit result sheet shows a real-player breakdown only once at least 10 real players have voted there.
Below that it shows the combined total (real, simulated and vote-buying effects) only.

### Defaults chosen while porting the rules (phase B), open to change
- Offers to sell your vote: the door-step offer (₦10,000, 60% caught) comes once, at home between 7pm and 10pm
  game time while PVC collection is open. The polling-unit offer (₦5,000, 50% caught) comes once, at the polling
  unit while polls are open. Refuse and report: +3 civic; refuse: +1 civic.
- Vote buying rolls its outcome before the hour of sharing money passes (same odds as the prototype).
- A PVC collection attempt INEC turns away ("come back tomorrow") can be retried on the next real WAT day.
- In-game news names the game's own election date and never says INEC set it.

### Travel between LGAs and states
- Citizens can travel anywhere in Nigeria. Interstate trips run between state capitals (src/data/capitals.ts):
  bus from any motor park (every class), flights between states with an airport (middle class and rich), own car
  (rich). Fares and times come from road distance; bus fares rise 50% in the last 3 days before polls
  ("everybody is going home to vote").
- Away from home there is no home or workplace: lodge at the hotel or guest house (price by class).
- Registration, PVC collection, vote buying and voting only work in your own LGA. You can only vote at your own
  polling unit, so you have to travel home first.

### Work and Nigerian life (phase B2)
- Occupations are rolled at the start, weighted by class: students, corpers (NYSC), 9 to 5 workers, artisans and
  traders, content creators, software developers, herbalists (traditional medicine sellers), politicians
  (fictional councillors, aides, chieftains), yahoo boys and girls, and money launderers among the rich.
- Jobs are applied for at the notice board or town hall; hiring is random, weighted by qualifications,
  how informed you are, competition and a small "long leg" bonus for the rich.
- Pay floors: N70,000 a month minimum wage for workers, N77,000 NYSC allawee for corpers.
- Police extortion at checkpoints (pay, argue, show ID or call a lawyer, report later). EFCC raids for yahoo and
  money laundering. Politicians get "connections", not immunity (real immunity is only for the President, Vice
  President, Governors and deputies). EFCC and crime news uses fictional names and never names a party.
- No ritualist career: it would make the killing of real victims a game mechanic. Herbalists stay as a normal trade.
- Everyday Nigeria: fuel scarcity and price hikes, cash scarcity and POS charges, bank network down, black tax,
  salary owed, ASUU strikes, japa stories, data prices, rainy-season floods.

### Revenue
- Real-money commercial ads on in-game TVs, billboards, the news ticker and radio, sold by the day (see the
  prices below) and targeted by nation, zone, state or LGA. Images and short videos; videos are scaled down and
  compressed to the slot the advertiser buys. Every ad is reviewed before it runs.
- No real-money political promotion. Campaign promotion stays in-game money only (CLAUDE.md), so no party or
  supporter can buy visibility with real money.

### Servers and travel between them
- Six zone servers (Supabase projects: NC, NE, NW, SE, SS, SW, each about 5 to 7 states) plus one national server,
  as in DESIGN.md. Code connects them: identity and collation live on the national server; each citizen's life,
  PVC and vote live on their home zone server.
- A journey into another zone hands the citizen over to that zone's server and back. Players see a "long journey"
  loading screen: none inside a zone, 14 seconds to a neighbouring zone, up to 30 seconds across the country
  (sim/journey.ts handoverSeconds). The vote always stays on the home server, because you can only vote at home.

### Voting, the end of the season and ad prices
- No SMS or WhatsApp OTP. Voting happens in the game: walk to your polling unit, queue, BVAS, ballot. One citizen
  per account, with email and password sign-in plus device and rate limits against multiple accounts and bots
  (Google sign-in was dropped on 8 Oct 2026, see below).
- While polls are open players see a live turnout counter only (votes cast), never party standings. (Replaced on
  9 Oct 2026, see "Live results from 8am" below.)
- At polls close (4pm Saturday 14 November) the game freezes for every player: no more actions or travel. Live
  collation runs, the winning party is announced over a generic celebration video (no party marks; the party name
  and colour are overlaid), then a closing screen thanks everyone, urges them to vote in real elections and choose
  wisely, and shows the disclaimer.
- Commercial ad prices (9 October 2026, replacing per-showing prices): boards are booked by the day, ₦10,000 a
  day a face, 1 to 30 days (the season), times the board's factor (giant unipole 1.5, smart and tall screens 2,
  square 1.2). Wall artwork in a landmark's gallery is ₦25,000 a day, one business per frame; each visit counts
  as a view. Prices live on the server so they can change without a release.
- Ads may stand inside town too (9 October 2026, replacing "outside town only"): up to eight "Place your ad
  here" boards on empty plots per town, and the three gallery frames inside each state's landmark.

### Sign-in and Supabase (8 Oct 2026)
- Sign-in is email and password only, the owner's choice over Google. The email must be confirmed before the first
  sign-in. A "before user created" hook in Supabase (supabase/migrations/*_signup_guard*.sql) refuses throwaway inbox
  services and a second account for the same real mailbox (Gmail dots and +tags are ignored), and it runs for every
  sign-up, even ones made straight against the Auth API. Passwords: at least 8 characters, letters and numbers.
- Two Supabase projects instead of seven. The first, ykdpwbxfkarnhttdnute, holds players: citizens, saves, voter
  rolls (that you voted, never how), the support-card feed and idempotency keys. The second's role is still to be
  decided; the proposal is anonymous ballots and results only, so ballots never share a database with identities.
  Every table carries a zone column so a later split by zone is a data move.
- Browsers never write to the database. Every write goes through server code holding the secret key, which re-runs
  the game rules in src/sim.

### 18 and over only (9 Oct 2026)
- Players must be 18 or over, the same as voting age in Nigeria. Sign-up asks for a date of birth (day, month and
  year boxes). The form checks it, and the sign-up guard checks it again on the server (dob_problem in
  supabase/migrations/*_age_gate.sql), counting age on Nigeria's calendar.
- The date of birth is never kept. A trigger on auth.users removes it as the account is written; public.age_checks
  holds only when the player confirmed. This keeps the game's personal data to a minimum (NDPA).
- Accounts made before this confirm once on their next sign-in (confirm_age). Anyone who says they are under 18
  is locked out, so they can't just try an older date.
- The age is what the player says. It is not verified.

### Live results from 8am (9 Oct 2026)
- The owner's choice: every vote counts and shows live. From polls open (8am) party standings update as votes are
  cast, nationally and by zone, state and LGA, alongside turnout. This replaces "turnout only while polls are
  open". The owner accepted the bandwagon risk.
- The disclaimer stays on every results view: a game, not a poll or prediction, not affiliated with INEC.
- Players still never query the vote tables. Each vote updates running totals in the same transaction as the
  vote; the server pushes the new totals about once a second (batched, so it feels like every vote while the load
  stays flat at a million players), and a CDN snapshot backs anyone who joins late or loses connection.
- At 4pm the game freezes and the final collation (unit, LGA, state, nation) plays out on the result sheet, then
  the winner and the closing screen, as above.

### Public results board, and no one can change results (9 Oct 2026)
- Results are public. A results board at /results needs no sign-in and is made for a big screen (TV, projector,
  viewing centre) as well as phones: national totals, a map lighting up by state, turnout, the live feed of
  polling units, and the disclaimer always on screen. It updates live from 8am the same way the in-game view does.
- No one can change a result: not the debug tools, not the admin panel, not the owner. In practice:
  - The only way a vote enters is the vote route, for a signed-in citizen at their own polling unit while polls
    are open by the server's clock. Votes are append-only: the database refuses any update or delete on ballots
    and totals, and totals are only ever written by the trigger that records a ballot.
  - The admin panel has no results controls at all (no edit, no hold, no re-run). It can only watch.
  - The debug tools (clock jumps and test votes) are left out of the production build. The server decides the
    time, so a player's clock changes nothing.
  - The election date and poll hours can still be moved for a postponement before polls open. Once polls open
    they are locked.
  - Tamper evidence: each ballot carries a hash of the one before it, and every minute the running totals and the
    latest hash are published to the CDN as files that are never overwritten. Anyone can check that the totals
    on the board add up and that no earlier minute was rewritten.
- Honest limit: whoever holds the database owner keys could in theory still go around all of this. The hash chain
  and the published minute files are what make any such change visible.

### Results order and motion (9 Oct 2026)
- Results are ranked: the leading party sits on top and rows swap places live the moment one overtakes another.
  Ties sort alphabetically. The ballot itself stays alphabetical with equal boxes.
- Animation uses the motion library (formerly Framer Motion, imported from motion/react) for the results board
  and for game UI animation. Respect the phone's reduce-motion setting.

### Closing video and admin roles (9 Oct 2026)
- Two videos at the end of the season: the celebration under the winner announcement, set at the Presidential
  Villa in Abuja under Aso Rock, the camera moving from outside the gates into the state hall where people
  celebrate; then a closing video before the closing screen (a street at dusk, polling tables packed away, a
  young woman holding up her inked thumb, then "Thank you. Now go and vote for real."). People are drawn as
  cartoon humans (full bodies, faces, hair), never bean-shaped figures or anyone real. Green-white-green national
  flags are fine; party marks are not. Both are generic, with no party marks and no text in the video; words are overlaid
  in code.
- Admin roles: the owner has every power (election date and poll hours before polls open, ads and prices, bans,
  announcements). Moderators can only review support-card notes, sponsored news and ads, and ban accounts. No
  role can touch results; everyone can only watch them.

### The game on the server (Phase E, 9 Oct 2026)
- Server code runs as Next.js API routes on Vercel (src/app/api, rules in src/server), not Supabase edge
  functions: the routes use the game's own rules (src/sim) directly and deploy with the app. They run in
  London (lhr1, set in vercel.json), next to the Supabase database. CLAUDE.md was updated to match.
- E1: citizens are rolled on the server (POST /api/game/citizen), one per account. Saves are uploaded every
  3 minutes when something changed and when the app is hidden or closed, checked by sanitizeGame, and refused if
  they change who the citizen is or are out of date (a version number; the newer save wins). A save made on a
  phone before the server existed is taken over once, after the same checks, without any votes.
- Votes are only ever recorded by the server's voter roll: a save can never add one.
- One device at a time per account (owner, 9 Oct 2026). Another device is told "You are already playing on
  another device. Log out there to continue here." Logging out uploads the game and frees the account at once; a
  device that stops checking in (every 3 minutes while playing) loses it after 10 minutes, so a lost phone never
  locks a player out for good. Signed-in players can't "Start a new life": one citizen per account, kept for good.
- E2: the PVC and the vote are the server's. citizens.pvc is the status that counts; a save can only move it along
  the real steps inside their windows (15 minutes of grace for the upload), a seizure sticks, nothing goes
  backwards. Voting (POST /api/vote) needs a collected PVC and open polls by the database's clock; one step marks the
  voter roll and adds one to vote_tallies (polling unit, party, count). No ballot is ever stored, so no vote can be
  traced to a player. The voter roll keeps only the day someone voted. Turnout (GET /api/turnout) is public and
  cached on the CDN for 30 seconds.
- Vote counts live in project 1 for now, as counts per polling unit and party only (no ballots).

### Closing remarks and credits (9 Oct 2026)
- After the closing scene, credits roll like the end of a film (src/components/election/Credits.tsx): who built
  the game (src/data/credits.ts), the top 20 brands by ad spend (names only, never amounts), thanks to every
  player, the season's top 10 players, special thanks to Raavon, Klario and Sync, a "vote wisely" note (the choice
  made in the real 2027 election lasts until 2031), then the owner's signed message: this is a simulation, not
  real; nothing in the real election comes from it; no affiliation with INEC or any party; your real vote counts;
  let us make Nigeria great again and pray for our leaders. Signed, Hizzy.
- Top brands and top players come from a snapshot the server writes once at polls close, /season/credits.json
  ({ brands: string[], players: { name, place, plays }[] }). The game only reads it; until it exists those sections hide.
- Builders are credited by nickname only, never real names: Hizzy (creator), TR7 and Tommy. The message is
  signed Hizzy. "Let us make Nigeria great again" stays as the owner wrote it.
- Top 10 players are ranked by how many times they played the game, shown with that count, and only players who
  agreed to have their name shown are listed.

### Pay, promotions and vote buying (9 Oct 2026)
- One day in the game pays like a month: a day on a salary pays the month's salary; a day's trade or deals (daily and
  commission careers) are worth 22 days of them. Bonuses for tasks handled on shift are 4% of a day's pay, up to
  N50,000. Hustles and one-off action earnings are unchanged.
- Promotions: every 5 days worked, a review (50% chance, plus 5 points a task handled since the last review, minus
  10 a day missed; between 10% and 95%). Salaried: a new title (Senior, Lead, Head, Chief) and a 10 to 20% raise.
  Paid by the day or the deal: 15% more takings a level. Four levels at most; a new job starts again at the bottom;
  students and corps members are not promoted.
- Vote buying: police go after the people paying, not the people paid. Taking an offer is never punished and the
  player is told their vote is still theirs, because the ballot is secret.
- Real players buying votes from real players: agreed in principle, but how they reach each other is not designed
  yet. Not built. Whatever the design, sellers still vote freely on election day.
- Big-ticket prices (houses, cars, rent) stay at their real Nigerian prices (owner, after seeing how the new pay
  lines up with them).
- A play, for the closing credits: a real day (WAT) on which the player was signed in and did at least 5 activities.
  The server counts it from their saves, once a day (citizens.plays). Players opt in to being named with "Show my
  name in the closing credits" in the menu (off by default; one reminder in the week before polls). Only the
  citizen's game name and LGA are shown. /season/credits.json answers 404 until polls close, then the top 10.

### Top three cards, lights out, and the demo (9 Oct 2026)
- The results board and the 4pm collation show the top three parties on cards (1st, 2nd, 3rd, with the gap
  between them); places 4 to 10 are rows and the rest chips. Parties slide between them as they overtake.
- The season ends with "Lights out, Naija": after the credits the player switches off the bulb, TV, fan and gen
  in their parlour, the room goes dark, "Goodnight, Naija. See you at the real polls in 2027", then they leave.
- Dev builds only: /results?demo has buttons to jump the sped-up day (8am, noon, 3:50pm, final) and to play the
  whole finale (winner, closing video, credits, lights out). Production builds strip it.

### After the season closes (9 Oct 2026)
- At 4pm on election day the game closes for good. From then on the app never loads the game: whoever opens it
  gets the results board (src/components/ClientGame.tsx, decided on the server's clock, src/data/season.ts).
- When the result goes final, the finale plays by itself: the celebration (winner with their vote count) moves
  on when its video ends, no button; then the closing scene, credits and lights out. The credits have "View
  results again", which returns to the board.
- Results stay up for three days, until Tuesday 17 November 2026, 4pm WAT. After that the board shows only
  "Naija Votes has ended", the closing message and the disclaimer.
- On the fifth day, Thursday 19 November 2026, 4pm WAT, every player's data is deleted and nobody can sign in
  again. This is server work: everything players did is deleted, vote counts included (see "Cleaning the
  database at the end").

### Playing together (9 Oct 2026)
- Players can see other real players at the same place, by nickname only (never a real name), and do things
  together: a date, lunch at the buka, an owambe, the match at the viewing centre, a church or mosque service,
  a night at the club (src/data/together.ts). Still no chat: you invite with a fixed card, they answer Accept
  or Not today, and the only other thing you can send is a quick reaction (wave, laugh, clap, dance, respect).
- The one who invites pays for both; both spend the time and both get the lift and connections.
- Safety: invites are off until a player switches on "Open to invites"; dates also need "Open to dates", on
  both sides. Block and report on every player; a block hides you from each other both ways. Limits: 10
  invites an hour, one waiting invite per person, three "Not today" from someone ends invites to them for the
  day, invites lapse after two minutes. A "Not today" is silent beyond those words.
- Nothing about parties anywhere in it; support cards stay the only political expression.
- The rules are pure (src/sim/together.ts) so the server runs the same checks. The server holds presence (who
  is where), passes invites and answers, and keeps blocks and reports. Until it does, dev builds fill places
  with simulated players so the screens can be tried.

### Cleaning the database at the end (owner, 9 Oct 2026)
- On 19 November 2026 at 4pm WAT the database is cleaned: every account and everything players did (saves,
  citizens, PVC records, voter rolls, vote counts, support cards, plays, devices, sign-in logs) is deleted. Only the
  rule lists (blocked email domains and username words) are kept. This replaces "the anonymous totals are kept".
- It runs inside Supabase on a pg_cron timer (supabase/migrations/*_season_purge.sql): a rehearsal on 18 November
  at 4pm WAT only counts what would go (season_purge_log); a kill switch (season_control.enabled = false) stops both
  if the election moves. Sign-up and sign-in are refused from the same moment.
- Supabase backups may still hold data for up to their retention period (about a week on Pro) after the clean-up.

### Campaigning on the server (Phase E3, 9 Oct 2026)
- Support cards, flyers and sponsored news, and votes bought are checked by the server when a save uploads
  (src/server/campaign.ts) and recorded in support_cards, promos and bribe_log. One card a day from the lists with
  a clean note; promos only at their listed price, in your own LGA, under the daily cap; nothing during the
  blackout (15 minutes of grace for the upload). Votes bought can't go down and are capped at 100 a citizen a
  day (two of the biggest groups, all voting as paid), until polls close. Anything that breaks a rule is left
  out of the save and the corrected copy goes back to the phone. These upload at once, not on the 3-minute round.
- The feed (GET /api/feed?lga=) shows real players' support cards in the LGA and today's sponsored news, by game
  name, cached on the CDN for a minute. Simulated supporters show only while the real feed is empty.
