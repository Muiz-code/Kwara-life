-- Playing together (docs/DECISIONS.md, "Playing together"): who is at a place, invites and answers, quick reactions,
-- blocks and reports. No free text anywhere: nicknames are citizens' game names, invites are fixed activities,
-- reactions are a fixed list, reports pick a fixed reason. The server checks every invite with the game's own
-- rules (src/sim/together.ts). Server only: browsers reach these through /api/together.
-- Every table here is emptied with the rest at the end of the season (season_purge).

-- Who is where, and their switches. One row per player; seen_at says they are still there.
create table public.together_players (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  citizen_id    uuid not null unique references public.citizens (id) on delete cascade,
  nickname      text not null,
  look          jsonb not null default '{}'::jsonb,
  lga_code      text not null default '',
  place_id      text not null default '',
  place_kind    text not null default '',
  busy          boolean not null default false,
  open_invites  boolean not null default false,
  open_dates    boolean not null default false,
  seen_at       timestamptz not null default now()
);
create index together_players_here on public.together_players (lga_code, place_id, seen_at desc);
alter table public.together_players enable row level security;
revoke all on table public.together_players from anon, authenticated;

-- Invites, and the answer to each.
create table public.together_invites (
  id           uuid primary key default gen_random_uuid(),
  from_user    uuid not null references auth.users (id) on delete cascade,
  to_user      uuid not null references auth.users (id) on delete cascade,
  activity     text not null check (activity ~ '^[a-z]{2,20}$'),
  place_id     text not null,
  sent_at      timestamptz not null default now(),
  answered_at  timestamptz,
  accepted     boolean,
  -- The answer has reached the one who invited.
  delivered    boolean not null default false
);
create index together_invites_to on public.together_invites (to_user, sent_at desc);
create index together_invites_from on public.together_invites (from_user, sent_at desc);
alter table public.together_invites enable row level security;
revoke all on table public.together_invites from anon, authenticated;

-- Quick reactions at a place, kept for a minute.
create table public.together_reactions (
  id         bigint generated always as identity primary key,
  lga_code   text not null,
  place_id   text not null,
  from_user  uuid not null references auth.users (id) on delete cascade,
  nickname   text not null,
  emote      text not null check (emote in ('wave', 'laugh', 'clap', 'dance', 'respect')),
  at         timestamptz not null default now()
);
create index together_reactions_here on public.together_reactions (lga_code, place_id, at desc);
alter table public.together_reactions enable row level security;
revoke all on table public.together_reactions from anon, authenticated;

-- Blocks hide two players from each other both ways.
create table public.together_blocks (
  user_id  uuid not null references auth.users (id) on delete cascade,
  blocked  uuid not null references auth.users (id) on delete cascade,
  at       timestamptz not null default now(),
  primary key (user_id, blocked)
);
create index together_blocks_back on public.together_blocks (blocked);
alter table public.together_blocks enable row level security;
revoke all on table public.together_blocks from anon, authenticated;

-- Reports, from a fixed list of reasons, for moderators.
create table public.together_reports (
  id        bigint generated always as identity primary key,
  reporter  uuid not null references auth.users (id) on delete cascade,
  reported  uuid not null references auth.users (id) on delete cascade,
  reason    text not null check (char_length(reason) <= 60),
  at        timestamptz not null default now()
);
alter table public.together_reports enable row level security;
revoke all on table public.together_reports from anon, authenticated;

-- I am here: my place, whether I am busy, with my nickname and look from my citizen and save.
create or replace function public.together_here_now(p_user uuid, p_lga text, p_place text, p_kind text, p_busy boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.together_players as t (user_id, citizen_id, nickname, look, lga_code, place_id, place_kind, busy, seen_at)
  select c.user_id, c.id, c.name, coalesce(s.game -> 'citizen' -> 'look', '{}'::jsonb), p_lga, p_place, p_kind, p_busy, now()
  from public.citizens c left join public.game_saves s on s.user_id = c.user_id
  where c.user_id = p_user
  on conflict (user_id) do update set
    nickname = excluded.nickname, look = excluded.look, lga_code = excluded.lga_code, place_id = excluded.place_id,
    place_kind = excluded.place_kind, busy = excluded.busy, seen_at = now();
$$;
revoke all on function public.together_here_now(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.together_here_now(uuid, text, text, text, boolean) to service_role;
