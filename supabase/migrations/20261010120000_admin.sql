-- The admin panel (docs/DECISIONS.md, "Admin panel"). Who is an admin and with what role, a log of every admin
-- action, moderation (hiding support cards and sponsored news, banning accounts), announcements in every
-- player's news ticker, and the counts for the live dashboard. No role can touch votes or results: there is
-- nothing here that writes to voter_rolls or vote_tallies, and the dashboard reads counts only.
-- Server only, like every other table: no browser role can see or touch any of this.

-- Admins: the owner has every power, moderators moderate. Everyone else gets "not found" from /api/admin.
create table public.admins (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  role      text not null check (role in ('owner', 'moderator')),
  added_at  timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;

-- The owner (stated 10 Oct 2026). Promote more people from the panel; this only seeds the first owner.
insert into public.admins (user_id, role)
select id, 'owner' from auth.users where lower(email) = 'hollarewajumuiz@gmail.com'
on conflict (user_id) do nothing;

-- Every admin action, for accountability.
create table public.admin_log (
  id        bigint generated always as identity primary key,
  admin_id  uuid references auth.users (id) on delete set null,
  action    text not null check (char_length(action) <= 40),
  target    text not null default '' check (char_length(target) <= 100),
  detail    jsonb not null default '{}'::jsonb,
  at        timestamptz not null default now()
);
create index admin_log_at on public.admin_log (at desc);
alter table public.admin_log enable row level security;
revoke all on table public.admin_log from anon, authenticated;

-- Moderation: hidden support cards and sponsored news drop out of the public feed.
alter table public.support_cards add column hidden boolean not null default false;
alter table public.promos add column hidden boolean not null default false;

create or replace function public.campaign_feed(p_lga text, p_day date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'cards', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select c.name as by, s.party, s.issues, s.note, s.day, s.created_at
        from public.support_cards s join public.citizens c on c.id = s.citizen_id
        where s.lga_code = p_lga and not s.hidden order by s.created_at desc limit 30
      ) x), '[]'::jsonb),
    'sponsored', coalesce((
      select jsonb_agg(y) from (
        select c.name as by, p.kind, p.option, p.party
        from public.promos p join public.citizens c on c.id = p.citizen_id
        where p.lga_code = p_lga and p.day = p_day and p.kind = 'news' and not p.hidden order by p.created_at desc limit 10
      ) y), '[]'::jsonb)
  );
$$;
revoke all on function public.campaign_feed(text, date) from public, anon, authenticated;
grant execute on function public.campaign_feed(text, date) to service_role;

-- Bans, for the record. The ban itself is on the auth account (it can no longer sign in or refresh).
create table public.bans (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  reason   text not null default '' check (char_length(reason) <= 120),
  by_admin uuid references auth.users (id) on delete set null,
  at       timestamptz not null default now()
);
alter table public.bans enable row level security;
revoke all on table public.bans from anon, authenticated;

-- Announcements: one short line at the front of every player's news ticker.
create table public.announcements (
  id          bigint generated always as identity primary key,
  text        text not null check (char_length(btrim(text)) between 1 and 80),
  by_admin    uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  ends_at     timestamptz,
  active      boolean not null default true
);
alter table public.announcements enable row level security;
revoke all on table public.announcements from anon, authenticated;

-- The dashboard's numbers, in one call. Counts only: never who voted for what.
create or replace function public.admin_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with wat as (select (now() at time zone 'Africa/Lagos')::date as today)
  select jsonb_build_object(
    'accounts', (select count(*) from auth.users),
    'confirmed', (select count(*) from auth.users where email_confirmed_at is not null),
    'signups_today', (select count(*) from auth.users, wat where (created_at at time zone 'Africa/Lagos')::date = wat.today),
    'citizens', (select count(*) from public.citizens),
    'active_15m', (select count(*) from public.game_saves where updated_at > now() - interval '15 minutes'),
    'active_24h', (select count(*) from public.game_saves where updated_at > now() - interval '24 hours'),
    'pvcs', (select count(*) from public.game_saves where game -> 'citizen' ->> 'pvc' = 'have'),
    'voted', (select count(*) from public.voter_rolls),
    'by_zone', coalesce((select jsonb_object_agg(zone, n) from (select zone::text, count(*) n from public.citizens group by zone) z), '{}'::jsonb),
    'by_state', coalesce((select jsonb_object_agg(state_code, n) from (select state_code, count(*) n from public.citizens group by state_code) s), '{}'::jsonb),
    'votes_by_hour', coalesce((select jsonb_object_agg(h, n) from (
      select to_char(date_trunc('hour', voted_at at time zone 'Africa/Lagos'), 'YYYY-MM-DD HH24:00') h, count(*) n
      from public.voter_rolls group by 1) v), '{}'::jsonb),
    'reports_week', (select count(*) from public.together_reports where at > now() - interval '7 days'),
    'banned', (select count(*) from public.bans),
    'cards_today', (select count(*) from public.support_cards, wat where day = wat.today),
    'promos_today', (select count(*) from public.promos, wat where day = wat.today)
  );
$$;
revoke all on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_stats() to service_role;
