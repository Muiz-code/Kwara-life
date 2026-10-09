-- 18 and over only, the same as voting age in Nigeria. A new player gives a date of birth at sign-up; the
-- sign-up guard refuses anyone under 18, and the date is thrown away as the account is made. All we keep is
-- when they confirmed (age_checks). Accounts made before this confirm once with confirm_age() on their next
-- sign-in. The age is what the player says; it is not verified.

-- Who has confirmed they are 18 or over, and who said they are under 18 (locked out). No dates of birth.
create table public.age_checks (
  user_id       uuid primary key references auth.users (id) on delete cascade deferrable initially deferred,
  confirmed_at  timestamptz,
  under_18_at   timestamptz
);
alter table public.age_checks enable row level security;
revoke all on table public.age_checks from anon, authenticated;

-- Why a date of birth won't do, or null. The date is 'YYYY-MM-DD'; age is counted on Nigeria's calendar.
create or replace function public.dob_problem(dob text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_dob date;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if dob is null or dob !~ '^\d{4}-\d{2}-\d{2}$' then return 'Enter your date of birth'; end if;
  begin
    v_dob := dob::date;
  exception when others then
    return 'Enter a real date of birth';
  end;
  if v_dob > v_today or v_dob < v_today - interval '120 years' then return 'Enter a real date of birth'; end if;
  if v_dob > v_today - interval '18 years' then return 'Naija Votes is for players aged 18 and over'; end if;
  return null;
end;
$$;
revoke all on function public.dob_problem(text) from public, anon, authenticated;
grant execute on function public.dob_problem(text) to supabase_auth_admin;

-- The sign-up guard now checks the date of birth too.
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

-- As the account row is written: note that the age was confirmed, then drop the date so it is never stored.
-- (age_checks' key is checked at commit, so the row can be written before the account row exists.)
-- Also runs on updates, so a date put back into user_metadata later is dropped too.
create or replace function public.strip_dob()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ? 'dob' then
    if tg_op = 'INSERT' and public.dob_problem(new.raw_user_meta_data ->> 'dob') is null then
      insert into public.age_checks (user_id, confirmed_at) values (new.id, now()) on conflict (user_id) do nothing;
    end if;
    new.raw_user_meta_data := new.raw_user_meta_data - 'dob';
  end if;
  return new;
end;
$$;
revoke all on function public.strip_dob() from public, anon, authenticated;

create trigger before_auth_user_strip_dob
  before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.strip_dob();

-- The signed-in player's age check: 'confirmed', 'locked' (said under 18) or 'needed'.
create or replace function public.my_age_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when a.confirmed_at is not null then 'confirmed'
    when a.under_18_at is not null then 'locked'
    else 'needed'
  end
  from (select 1) one
  left join public.age_checks a on a.user_id = auth.uid();
$$;
revoke all on function public.my_age_status() from public, anon;
grant execute on function public.my_age_status() to authenticated;

-- For accounts made before the age check: confirm once. Someone who says they are under 18 is locked out, so
-- they can't just try an older date.
create or replace function public.confirm_age(dob text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status text := public.my_age_status();
  v_problem text;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'Sign in first'); end if;
  if v_status = 'confirmed' then return jsonb_build_object('ok', true); end if;
  if v_status = 'locked' then
    return jsonb_build_object('ok', false, 'locked', true, 'reason', 'Naija Votes is for players aged 18 and over');
  end if;
  v_problem := public.dob_problem(dob);
  if v_problem = 'Naija Votes is for players aged 18 and over' then
    insert into public.age_checks (user_id, under_18_at) values (v_uid, now())
    on conflict (user_id) do update set under_18_at = excluded.under_18_at;
    return jsonb_build_object('ok', false, 'locked', true, 'reason', v_problem);
  end if;
  if v_problem is not null then return jsonb_build_object('ok', false, 'reason', v_problem); end if;
  insert into public.age_checks (user_id, confirmed_at) values (v_uid, now())
  on conflict (user_id) do update set confirmed_at = excluded.confirmed_at;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.confirm_age(text) from public, anon;
grant execute on function public.confirm_age(text) to authenticated;
