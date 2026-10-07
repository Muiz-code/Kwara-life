# Naija Votes 2027: design summary
Full doc: the "Naija Votes 2027: Game Design and Technical Plan" Claude Doc (owner: Muiz Owolabi).

## Real-world grounding
- Presidential and National Assembly elections: Saturday 16 January 2027 (INEC revised timetable, Electoral Act 2026).
  Governorship and State Assembly: 6 February 2027. Presidential campaigns opened 19 August 2026.
- 21 registered parties (DLA and NDC added 5 Feb 2026): A, AA, AAC, ADC, ADP, APC, APGA, APM, APP, BP, DLA, LP, NDC,
  NNPP, NRM, PDP, PRP, SDP, YP, YPP, ZLP. Re-check INEC's list before launch.
- Prototype geography: 37 states/FCT, 5 real LGAs each, 3 polling units per LGA (555 PUs).

## Citizen roll (once, permanent)
- Class: poor 63%, middle 32%, rich 5%. Jobs, homes, starting money by class. 15% of poor players sleep under a
  flyover (written with dignity; shelter quest can move them indoors).
- PVC at start: 55% have it, 25% registered but uncollected, 20% unregistered.
- TV/radio ownership by class: rich both; middle TV 85%, radio 70%; poor TV 20%, radio 60% (under-flyover radio 30%).

## Life loop
- Needs decay (food, energy, fun, social, hygiene), real-time clock, NEPA outages, faint/sleep-off penalties.
- LGA map per player: home, work, INEC office, polling unit, market, local food spot, viewing centre, news stand,
  mosque, church, motor park, town hall, notice board, state landmark, shelter (if under a flyover).
- Biomes by zone: NW/NE Sahel, NC savanna, SW rainforest, SE hills, SS delta creeks. Local market and food names.
- Travel by class: poor walk/okada/danfo; middle keke/ride-hailing; rich SUV. Fares and travel time by distance.
- Every place is enterable with tappable objects that run actions.

## News and media
- TV at home only if owned (and light, unless generator). Others: viewing centre (N100), news stand (free front
  pages), overheard news on 40% of trips. Radio and TV can be bought at the market.
- Real channels later via official YouTube live embeds; headlines via server-cached RSS every 10 minutes.

## Election timeline (prototype, compressed)
- Day 7 registration closes. Day 9 PVC collection closes, campaigns end. Day 10 election, polls 8:30am to 2:30pm.
- Vote flow: queue, BVAS (fingerprint, face fallback), alphabetical ballot, thumbprint, drop. Then live collation by
  PU, LGA, state, nation with an IReV-style result sheet.

## Campaigning (no chat)
- Support card: party + up to 3 issues + optional 80-char note (filtered), one per day, free.
- Flyers on notice boards: N5k street, N50k LGA, N500k state. Sponsored news: N25k line, N250k segment.
- Daily cap N1m per player, in-game money only. Promotion never changes simulated voters.
- Real-money political promotion needs legal advice first.

## Vote buying
- At market, buka, motor park: party, N1k/5k/10k per person, 5/20/50 people. Catch risk ~15% to 50%+.
- Caught: lose money, fine 50% of remaining cash, PVC seized, night in custody, on bail for the season.
- Not caught: ~60% take money, half of those vote as paid; buyer never learns how anyone voted.
- Effect limited to buyer's own LGA. Door-step and polling-unit offers to sell: 60% / 50% caught. Reporting earns civic points.
- Arrest news never names a party.

## Architecture
- 6 zone Supabase shards + national project. Writes via edge functions with OTP, rate limits, idempotency.
- Vote insert + PU tally trigger in one transaction. Collation every 30 s into national, snapshot to CDN.
- Realtime broadcast per state on snapshot change only. In-game queue spreads votes across the 6-hour window
  (~46 votes/s average for 1M voters). Load-test 1M votes before launch.
