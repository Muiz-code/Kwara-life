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
- Real-money commercial ads on in-game TVs, billboards, the news ticker and radio, sold per number of showings
  (impressions) and targeted by nation, zone, state or LGA. Images and short videos; videos are scaled down and
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
- While polls are open players see a live turnout counter only (votes cast), never party standings.
- At polls close (4pm Saturday 14 November) the game freezes for every player: no more actions or travel. Live
  collation runs, the winning party is announced over a generic celebration video (no party marks; the party name
  and colour are overlaid), then a closing screen thanks everyone, urges them to vote in real elections and choose
  wisely, and shows the disclaimer.
- Commercial ad prices: N5,000 per showing, or N4.5m per 1,000 showings. Prices live on the server so they can
  change without a release.

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
