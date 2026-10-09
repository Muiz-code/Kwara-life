-- The season's closing credits (owner, 9 Oct 2026): the top 10 players by how many times they played, only those
-- who agreed to be named. A play is a real day (WAT) on which the player was signed in and did at least five
-- activities; the server counts it once a day from their saves. Only the citizen's game name and LGA are shown.

alter table public.citizens
  add column plays integer not null default 0 check (plays >= 0),
  add column last_play date,
  add column credits_ok boolean not null default false;

-- One more play for today, at most once a day. True if it counted.
create or replace function public.note_play(p_user uuid, p_day date)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.citizens set plays = plays + 1, last_play = p_day
  where user_id = p_user and (last_play is null or last_play < p_day)
  returning true;
$$;
revoke all on function public.note_play(uuid, date) from public, anon, authenticated;
grant execute on function public.note_play(uuid, date) to service_role;

-- The most-played citizens who agreed to be named. Earlier citizens win ties.
create or replace function public.credits_top(p_limit integer)
returns table (name text, state_code text, lga_code text, plays integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name, c.state_code, c.lga_code, c.plays from public.citizens c
  where c.credits_ok and c.plays > 0
  order by c.plays desc, c.created_at
  limit least(greatest(p_limit, 0), 50);
$$;
revoke all on function public.credits_top(integer) from public, anon, authenticated;
grant execute on function public.credits_top(integer) to service_role;
