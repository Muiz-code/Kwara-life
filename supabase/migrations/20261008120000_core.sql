-- Naija Votes: the player side (project 1). One citizen per account, their save, who has voted (never
-- how), the public support-card feed, and idempotency keys.
--
-- Rules for every table here:
-- * Row Level Security is on (the project's ensure_rls trigger does it too; we say it explicitly).
-- * Nothing is exposed by default: browser roles (anon, authenticated) get only what is granted below.
-- * Browsers never write. Every write goes through server code holding the secret key, which re-runs the
--   game rules (src/sim) and never trusts what a client sends.
-- * `zone` is on every player table so the data can be split by zone later as a plain data move.

-- Zones, as a type, so a typo can't create a seventh one.
create type public.zone as enum ('NC', 'NE', 'NW', 'SE', 'SS', 'SW');

-- ---------------------------------------------------------------------------------------------------
-- Citizens: one per account (Google sign-in). The unique user_id is the "one person, one citizen" rule.
create table public.citizens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 16),
  state_code  text not null check (state_code ~ '^[a-z-]+$'),
  lga_code    text not null check (lga_code ~ '^[a-z-]+/[a-z0-9-]+$'),
  pu_code     text not null check (pu_code like lga_code || '/%'),
  zone        public.zone not null,
  created_at  timestamptz not null default now()
);
create index citizens_lga on public.citizens (lga_code);

alter table public.citizens enable row level security;
revoke all on table public.citizens from anon, authenticated;
grant select on table public.citizens to authenticated;
create policy "read own citizen" on public.citizens
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------
-- Game saves: the whole game state, checked by sanitizeGame on the server before it is stored.
create table public.game_saves (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  citizen_id  uuid not null unique references public.citizens (id) on delete cascade,
  zone        public.zone not null,
  game        jsonb not null,
  -- Bumped on every write; a write carrying an older version is refused (two tabs can't overwrite).
  version     integer not null default 1 check (version > 0),
  updated_at  timestamptz not null default now(),
  -- A save is a few tens of kilobytes; refuse anything absurd.
  constraint game_saves_size check (pg_column_size(game) < 512 * 1024)
);

alter table public.game_saves enable row level security;
revoke all on table public.game_saves from anon, authenticated;
grant select on table public.game_saves to authenticated;
create policy "read own save" on public.game_saves
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------
-- Voter rolls: THAT a citizen voted in an election, never HOW. The primary key is the "one citizen, one
-- vote" rule. Ballots are stored elsewhere with no link back to anyone (ballot secrecy).
create table public.voter_rolls (
  citizen_id   uuid not null references public.citizens (id) on delete cascade,
  election_id  text not null check (election_id ~ '^[a-z0-9-]+$'),
  zone         public.zone not null,
  voted_at     timestamptz not null default now(),
  primary key (citizen_id, election_id)
);

alter table public.voter_rolls enable row level security;
revoke all on table public.voter_rolls from anon, authenticated;
grant select on table public.voter_rolls to authenticated;
create policy "read own voting record" on public.voter_rolls
  for select to authenticated
  using (citizen_id in (select id from public.citizens where user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------------------------------
-- Support cards: the public campaign feed. Your support is public, your vote is secret. One card a day.
create table public.support_cards (
  id          bigint generated always as identity primary key,
  citizen_id  uuid not null references public.citizens (id) on delete cascade,
  zone        public.zone not null,
  lga_code    text not null,
  party       text not null check (party ~ '^[A-Z0-9-]{1,10}$'),
  issues      text[] not null default '{}' check (cardinality(issues) <= 3),
  note        text not null default '' check (char_length(note) <= 80),
  day         date not null,
  created_at  timestamptz not null default now(),
  unique (citizen_id, day)
);
create index support_cards_feed on public.support_cards (lga_code, created_at desc);

alter table public.support_cards enable row level security;
revoke all on table public.support_cards from anon, authenticated;
-- Anyone may read the feed, but not who posted: citizen_id is left out of the grant.
grant select (id, zone, lga_code, party, issues, note, day, created_at) on table public.support_cards to anon, authenticated;
create policy "the feed is public" on public.support_cards
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------------------------------
-- Idempotency keys: a request sent twice (a double tap, a retry on bad network) is answered once.
-- Server only: no browser role can see or touch this table.
create table public.idempotency_keys (
  key         text primary key check (char_length(key) between 8 and 100),
  user_id     uuid not null references auth.users (id) on delete cascade,
  action      text not null,
  response    jsonb,
  created_at  timestamptz not null default now()
);
create index idempotency_keys_age on public.idempotency_keys (created_at);

alter table public.idempotency_keys enable row level security;
revoke all on table public.idempotency_keys from anon, authenticated;
