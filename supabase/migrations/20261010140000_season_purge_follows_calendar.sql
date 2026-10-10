-- The end-of-season clean-up follows a postponement. When the owner moves election day from the admin panel
-- (game_settings.calendar, the admin_settings migration), the clean-up moves with it: five days after polls close,
-- like src/data/season.ts dataDeletedAt(). Without a move, season_control.delete_at (19 November 2026, 4pm WAT).
--
-- The two fixed timers become one hourly check, so a later date is never missed: it does nothing until the day
-- before (a rehearsal that only counts, logged once), then cleans the database once the date has come. The kill
-- switch (season_control.enabled) still stops both.

-- When the database is cleaned: five days after polls close, using a moved election day if there is one.
create or replace function public.season_delete_at()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (s.calendar ->> 'pollsClose')::timestamptz + interval '5 days' from public.game_settings s
      where s.id = 1 and s.calendar ? 'pollsClose'),
    (select c.delete_at from public.season_control c where c.id = 1)
  );
$$;
revoke all on function public.season_delete_at() from public, anon, authenticated;

-- The clean-up itself, now on the date above (same work as before: every player table emptied, accounts deleted).
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
  if not p_dry_run and (now() < public.season_delete_at() or c.done_at is not null) then
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

-- Every hour: the rehearsal once in the day before the clean-up, then the clean-up once it is due.
create or replace function public.season_purge_tick()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  d timestamptz := public.season_delete_at();
begin
  select * into c from public.season_control where id = 1;
  if not found or not c.enabled or c.done_at is not null then return 'nothing to do'; end if;
  if now() >= d then
    perform public.season_purge(false);
    return 'cleaned';
  end if;
  if now() >= d - interval '1 day'
     and not exists (select 1 from public.season_purge_log l where l.dry_run and l.at >= d - interval '1 day') then
    perform public.season_purge(true);
    return 'rehearsed';
  end if;
  return 'not yet';
end;
$$;
revoke all on function public.season_purge_tick() from public, anon, authenticated;
grant execute on function public.season_purge_tick() to service_role;

select cron.unschedule(jobid) from cron.job where jobname in ('naija-votes-purge-rehearsal', 'naija-votes-purge');
select cron.schedule('naija-votes-purge-tick', '0 * * * *', $$ select public.season_purge_tick() $$);

-- Sign-up closes on the same date.
do $do$
declare
  src text;
begin
  select pg_get_functiondef('public.before_user_created(jsonb)'::regprocedure) into src;
  src := replace(src, 'where now() >= delete_at', 'where now() >= public.season_delete_at()');
  execute src;
end
$do$;
