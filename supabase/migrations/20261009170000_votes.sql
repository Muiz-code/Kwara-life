-- Phase E2: the PVC and the vote live on the server.
--
-- * citizens.pvc is the one PVC status that counts. A save can only move it forward along the real steps
--   (register while registration is open, collect while collection is open; a seizure always sticks), checked by
--   the server before it is written here.
-- * Voting: cast_vote checks the citizen has collected their PVC, that polls are open by the database's own
--   clock, and that they have not voted (the voter_rolls key). Then, in one step, it records THAT they voted and
--   adds one to the count for their polling unit and party. No ballot is ever stored, only counts, so no vote
--   can be traced back to anyone. A retry after a bad network just answers "already".

alter table public.citizens
  add column pvc text not null default 'none' check (pvc in ('none', 'registered', 'have', 'seized'));

-- Votes per polling unit and party. Server only: results reach players through published snapshots.
create table public.vote_tallies (
  election_id  text not null check (election_id ~ '^[a-z0-9-]+$'),
  pu_code      text not null,
  party        text not null check (party ~ '^[A-Z0-9-]{1,10}$'),
  votes        integer not null default 0 check (votes >= 0),
  primary key (election_id, pu_code, party)
);
alter table public.vote_tallies enable row level security;
revoke all on table public.vote_tallies from anon, authenticated;

-- voted_at to the day only: an exact time next to a count changing could hint at how someone voted.
alter table public.voter_rolls alter column voted_at type date using voted_at::date;
alter table public.voter_rolls alter column voted_at set default current_date;

-- Cast a vote. Returns 'ok', 'already', 'no-citizen', 'no-pvc' or 'closed'.
create or replace function public.cast_vote(
  p_user uuid, p_election text, p_party text, p_opens timestamptz, p_closes timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  select id, pu_code, zone, pvc into c from public.citizens where user_id = p_user;
  if not found then return 'no-citizen'; end if;
  if c.pvc <> 'have' then return 'no-pvc'; end if;
  if now() < p_opens or now() >= p_closes then return 'closed'; end if;
  insert into public.voter_rolls (citizen_id, election_id, zone) values (c.id, p_election, c.zone)
  on conflict do nothing;
  if not found then return 'already'; end if;
  insert into public.vote_tallies as t (election_id, pu_code, party, votes) values (p_election, c.pu_code, p_party, 1)
  on conflict (election_id, pu_code, party) do update set votes = t.votes + 1;
  return 'ok';
end;
$$;
revoke all on function public.cast_vote(uuid, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, text, text, timestamptz, timestamptz) to service_role;

-- Votes cast so far in an election (turnout only, never party standings).
create or replace function public.vote_turnout(p_election text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(votes), 0)::bigint from public.vote_tallies where election_id = p_election;
$$;
revoke all on function public.vote_turnout(text) from public, anon, authenticated;
grant execute on function public.vote_turnout(text) to service_role;
