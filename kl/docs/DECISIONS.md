# Decisions after DESIGN.md
Newest first. These win where they differ from DESIGN.md or the prototype.

## October 2026

### One game
Kwara Life and Naija Votes 2027 are one game. Kwara Life's engine (needs, clock, travel, Pixi map, art pipeline)
becomes the engine for the whole country. Ilorin keeps its hand-built map and its places, actions and balance.

### Dates
- Election day is a real date in WAT, held on the server and changeable (postponement): Thursday
  5 November 2026, polls 8am to 4pm. This replaces the 16 January 2027 date in DESIGN.md for the game.
  Moving it moves the blackout (24 hours before polls open) and posts an "INEC announces new date" news item.
- Voter registration opens 2 minutes after a player creates their citizen and closes on 30 October 2026.
- When registration closes, every player is told to go and collect their PVC. Collection runs from
  31 October until 10 minutes before polls open (7:50am on 5 November).
- Citizens created after registration closes are rolled as holding a PVC or registered with one to collect,
  never unregistered, so they can still take part.
- Everything else (time of day, needs, work, shop hours, Jummah and Sunday service, trips) runs on the
  player's game clock.

### Citizens
Players pick their state and LGA. Class, job, home, money, PVC status, TV and radio, and polling unit are rolled
once, as in the prototype.

### Maps
- Every LGA map uses real road shapes from OpenStreetMap, stretched evenly so tiles do not overlap.
- Places are real: each state's famous landmarks and real civic places (INEC office, polling units, markets,
  mosques, churches) in the right spot. Tiles reuse the house art style but match the place and the area's look
  (for example Kaduna farmland is green, Sahel towns are dry, the Delta has creeks).
- OpenStreetMap data is used under the ODbL: show "© OpenStreetMap contributors" on the map.

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
