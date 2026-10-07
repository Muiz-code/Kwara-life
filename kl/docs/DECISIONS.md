# Decisions after DESIGN.md
Newest first. These win where they differ from DESIGN.md or the prototype.

## October 2026

### One game
Kwara Life and Naija Votes 2027 are one game. Kwara Life's engine (needs, clock, travel, Pixi map, art pipeline)
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
- Real-money "campaign for your favourite" promotion is NOT enabled yet. CLAUDE.md says promotion is in-game money
  only and DESIGN.md says real-money political promotion needs legal advice first. Build it behind a switch that
  stays off until a lawyer has cleared it (see the open questions in chat).

### Servers and travel between them
- Six zone servers (Supabase projects: NC, NE, NW, SE, SS, SW, each about 5 to 7 states) plus one national server,
  as in DESIGN.md. Code connects them: identity and collation live on the national server; each citizen's life,
  PVC and vote live on their home zone server.
- A journey into another zone hands the citizen over to that zone's server and back. Players see a "long journey"
  loading screen: none inside a zone, 14 seconds to a neighbouring zone, up to 30 seconds across the country
  (sim/journey.ts handoverSeconds). The vote always stays on the home server, because you can only vote at home.
