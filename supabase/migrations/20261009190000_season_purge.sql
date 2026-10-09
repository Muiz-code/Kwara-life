-- The end of the season (owner, 9 Oct 2026; docs/DECISIONS.md "After the season closes"). On the fifth day after polls
-- close, Thursday 19 November 2026 at 4pm WAT, the database is cleaned: every account and everything players did
-- (saves, citizens, PVC records, voter rolls, vote counts, support cards, plays, devices, sign-in logs) is deleted,
-- and nobody can sign up or sign in again. Only the rule lists (blocked email domains and username words) and this
-- season's own control and log are kept.
--
-- Safety:
-- * A rehearsal the day before counts what would be deleted and writes it to season_purge_log; nothing is deleted.
-- * A kill switch: set season_control.enabled = false (for example if the election is postponed) and nothing runs.
-- * The purge only runs from delete_at, and only once (done_at).
-- delete_at must match src/data/season.ts dataDeletedAt() (checked by src/server/season.test.ts).

create table public.season_control (
  id          integer primary key default 1 check (id = 1),
  delete_at   timestamptz not null,
  enabled     boolean not null default true,
  done_at     timestamptz
);
alter table public.season_control enable row level security;
revoke all on table public.season_control from anon, authenticated;
insert into public.season_control (delete_at) values ('2026-11-19T16:00:00+01:00');

create table public.season_purge_log (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  dry_run  boolean not null,
  rows     jsonb not null
);
alter table public.season_purge_log enable row level security;
revoke all on table public.season_purge_log from anon, authenticated;

-- Tables that are kept: rules, not people, and this season's own control and log.
create or replace function public.season_kept_tables()
returns text[]
language sql
immutable
as $$ select array['blocked_email_domains', 'blocked_username_words', 'season_control', 'season_purge_log'] $$;

-- Count (dry run) or delete everything players made. Every other table in public is emptied, so tables added later
-- are cleaned too. Returns the rows per table, and logs them.
create or replace function public.season_purge(p_dry_run boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  t record;
  n bigint;
  v_rows jsonb := '{}'::jsonb;
begin
  select * into c from public.season_control where id = 1;
  if not found or not c.enabled then return jsonb_build_object('skipped', 'switched off'); end if;
  if not p_dry_run and (now() < c.delete_at or c.done_at is not null) then
    return jsonb_build_object('skipped', 'not due');
  end if;
  for t in
    select tablename from pg_tables where schemaname = 'public' and tablename <> all (public.season_kept_tables())
    order by tablename
  loop
    execute format('select count(*) from public.%I', t.tablename) into n;
    v_rows := v_rows || jsonb_build_object(t.tablename, n);
  end loop;
  select count(*) into n from auth.users;
  v_rows := v_rows || jsonb_build_object('auth.users', n);
  if not p_dry_run then
    for t in
      select tablename from pg_tables where schemaname = 'public' and tablename <> all (public.season_kept_tables())
    loop
      execute format('truncate table public.%I cascade', t.tablename);
    end loop;
    -- Accounts, and with them their sessions, sign-in tokens and identities; then the sign-in history.
    delete from auth.users;
    if to_regclass('auth.audit_log_entries') is not null then execute 'delete from auth.audit_log_entries'; end if;
    if to_regclass('auth.flow_state') is not null then execute 'delete from auth.flow_state'; end if;
    update public.season_control set done_at = now() where id = 1;
  end if;
  insert into public.season_purge_log (dry_run, rows) values (p_dry_run, v_rows);
  return v_rows;
end;
$$;
revoke all on function public.season_purge(boolean) from public, anon, authenticated;
grant execute on function public.season_purge(boolean) to service_role;

-- Nobody signs up once the season is over (the sign-up guard from the age_gate migration, with one check added first).
create or replace function public.before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := event -> 'user' ->> 'email';
  v_username text := lower(btrim(coalesce(event -> 'user' -> 'user_metadata' ->> 'username', '')));
  v_domain text;
  v_problem text;
begin
  -- The season is over and every player's data is gone: nobody signs up again.
  if exists (select 1 from public.season_control where now() >= delete_at) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403,
      'message', 'Naija Votes has ended. Thank you for playing, and go and vote for real.'));
  end if;
  if v_email is null or position('@' in v_email) = 0 then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', 'Enter a valid email address'));
  end if;
  v_problem := public.dob_problem(event -> 'user' -> 'user_metadata' ->> 'dob');
  if v_problem is not null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', v_problem));
  end if;
  v_problem := public.username_problem(v_username);
  if v_problem is not null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', v_problem));
  end if;
  if exists (select 1 from public.profiles p where p.username = v_username) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', 'That username is taken'));
  end if;
  v_domain := lower(split_part(btrim(v_email), '@', 2));
  if exists (select 1 from public.blocked_email_domains b where b.domain = v_domain or v_domain like '%.' || b.domain) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400,
      'message', 'Use your own email address, not a temporary inbox'));
  end if;
  -- One indexed lookup, however many accounts there are.
  if exists (select 1 from public.account_mailboxes m where m.mailbox = public.canonical_email(v_email)) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400,
      'message', 'An account with this email already exists. Sign in instead'));
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;

-- The timer, inside the database (cron times are UTC): the rehearsal at 4pm WAT on 18 November, the clean-up at
-- 4pm WAT on 19 November. Both functions check the date and the kill switch themselves, so a run in a later year
-- does nothing.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('naija-votes-purge-rehearsal', '0 15 18 11 *', $$ select public.season_purge(true) $$);
select cron.schedule('naija-votes-purge', '0 15 19 11 *', $$ select public.season_purge(false) $$);
