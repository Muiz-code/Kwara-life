-- Admin panel phase 2 (docs/DECISIONS.md, "Admin panel, phase 2"): one row of game settings that the owner
-- changes from the panel, and finding an account by email to make it a moderator.
--   * paused: the emergency pause. Every game action is refused while it is on (src/server/route.ts) and players
--     see why. It never opens or closes polls and never touches votes.
--   * calendar: the election dates, when the owner moves them (postponement). Empty means the dates in
--     src/data/calendar.ts. The server only accepts a move before polls open (src/data/calendar.ts moveElection).
-- Server only, like every other table.

create table public.game_settings (
  id             integer primary key default 1 check (id = 1),
  paused         boolean not null default false,
  pause_message  text not null default '' check (char_length(pause_message) <= 120),
  calendar       jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users (id) on delete set null
);
insert into public.game_settings (id) values (1) on conflict (id) do nothing;
alter table public.game_settings enable row level security;
revoke all on table public.game_settings from anon, authenticated;

-- An account's id from its email, for adding a moderator. Server only.
create or replace function public.admin_find_user(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
$$;
revoke all on function public.admin_find_user(text) from public, anon, authenticated;
grant execute on function public.admin_find_user(text) to service_role;

-- The admin team with their emails and game names, for the owner's Team page. Server only.
create or replace function public.admin_team()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', a.user_id, 'role', a.role, 'added_at', a.added_at, 'email', u.email, 'name', c.name
  ) order by a.role desc, a.added_at), '[]'::jsonb)
  from public.admins a
  join auth.users u on u.id = a.user_id
  left join public.citizens c on c.user_id = a.user_id;
$$;
revoke all on function public.admin_team() from public, anon, authenticated;
grant execute on function public.admin_team() to service_role;
