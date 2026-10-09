-- Phase E3: campaigning on the server. Support cards (already a table), flyers and sponsored news (promos), and
-- vote-buying effects (bribe_log) are recorded here after the server checks them with the game's own rules
-- (src/server/campaign.ts). The support-card feed and today's sponsored news are public, by citizen game name only.
-- Vote-buying effects feed the results (by LGA), never shown to players directly.

create table public.promos (
  id          bigint generated always as identity primary key,
  citizen_id  uuid not null references public.citizens (id) on delete cascade,
  zone        public.zone not null,
  lga_code    text not null,
  kind        text not null check (kind in ('flyer', 'news')),
  option      integer not null check (option between 0 and 5),
  party       text not null check (party ~ '^[A-Za-z0-9-]{1,10}$'),
  price       integer not null check (price > 0),
  day         date not null,
  created_at  timestamptz not null default now()
);
create index promos_feed on public.promos (lga_code, day desc);
create index promos_citizen_day on public.promos (citizen_id, day);
alter table public.promos enable row level security;
revoke all on table public.promos from anon, authenticated;

-- Votes bought, per citizen, day and party (the effect in the buyer's own LGA, for the count).
create table public.bribe_log (
  citizen_id  uuid not null references public.citizens (id) on delete cascade,
  day         date not null,
  party       text not null check (party ~ '^[A-Z0-9-]{1,10}$'),
  votes       integer not null default 0 check (votes >= 0),
  primary key (citizen_id, day, party)
);
alter table public.bribe_log enable row level security;
revoke all on table public.bribe_log from anon, authenticated;

-- Record what a save added, already checked by the server: support cards, promos and bought votes.
create or replace function public.record_campaign(p_user uuid, p_day date, p_cards jsonb, p_promos jsonb, p_bribes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  x jsonb;
  k text;
begin
  select id, zone, lga_code into c from public.citizens where user_id = p_user;
  if not found then return; end if;
  for x in select * from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) loop
    insert into public.support_cards (citizen_id, zone, lga_code, party, issues, note, day)
    values (c.id, c.zone, c.lga_code, x ->> 'party', array(select jsonb_array_elements_text(x -> 'issues')), x ->> 'note', (x ->> 'day')::date)
    on conflict (citizen_id, day) do nothing;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p_promos, '[]'::jsonb)) loop
    insert into public.promos (citizen_id, zone, lga_code, kind, option, party, price, day)
    values (c.id, c.zone, c.lga_code, x ->> 'kind', (x ->> 'option')::int, x ->> 'party', (x ->> 'price')::int, (x ->> 'day')::date);
  end loop;
  for k in select * from jsonb_object_keys(coalesce(p_bribes, '{}'::jsonb)) loop
    insert into public.bribe_log as b (citizen_id, day, party, votes) values (c.id, p_day, k, (p_bribes ->> k)::int)
    on conflict (citizen_id, day, party) do update set votes = b.votes + excluded.votes;
  end loop;
end;
$$;
revoke all on function public.record_campaign(uuid, date, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_campaign(uuid, date, jsonb, jsonb, jsonb) to service_role;

-- Votes a citizen has bought today, for the daily limit.
create or replace function public.bribed_today(p_user uuid, p_day date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(b.votes), 0)::int from public.bribe_log b join public.citizens c on c.id = b.citizen_id
  where c.user_id = p_user and b.day = p_day;
$$;
revoke all on function public.bribed_today(uuid, date) from public, anon, authenticated;
grant execute on function public.bribed_today(uuid, date) to service_role;

-- The public feed for an LGA: the latest support cards and today's sponsored news, by game name.
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
        where s.lga_code = p_lga order by s.created_at desc limit 30
      ) x), '[]'::jsonb),
    'sponsored', coalesce((
      select jsonb_agg(y) from (
        select c.name as by, p.kind, p.option, p.party
        from public.promos p join public.citizens c on c.id = p.citizen_id
        where p.lga_code = p_lga and p.day = p_day and p.kind = 'news' order by p.created_at desc limit 10
      ) y), '[]'::jsonb)
  );
$$;
revoke all on function public.campaign_feed(text, date) from public, anon, authenticated;
grant execute on function public.campaign_feed(text, date) to service_role;
