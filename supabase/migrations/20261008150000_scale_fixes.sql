-- Scale fixes for a million players.
--
-- 1. The sign-up guard checked for a duplicate mailbox by running canonical_email() over every row of
--    auth.users: a full scan per sign-up, which would time out with a million accounts. The real mailbox
--    of each account is now stored once, under a primary key, so the check is one index lookup. The
--    primary key also stops two sign-ups for the same mailbox racing each other in.
-- 2. Sign-in attempts were tidied on every attempt. Now about one call in a hundred does it.

create table public.account_mailboxes (
  mailbox  text primary key,
  user_id  uuid not null unique references auth.users (id) on delete cascade
);
alter table public.account_mailboxes enable row level security;
revoke all on table public.account_mailboxes from anon, authenticated;
grant select on table public.account_mailboxes to supabase_auth_admin;

-- Accounts made before this table existed.
insert into public.account_mailboxes (mailbox, user_id)
select public.canonical_email(u.email), u.id from auth.users u where u.email is not null
on conflict do nothing;

-- The profile trigger now also records the account's real mailbox.
create or replace function public.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, lower(btrim(new.raw_user_meta_data ->> 'username')));
  if new.email is not null then
    insert into public.account_mailboxes (mailbox, user_id) values (public.canonical_email(new.email), new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.create_profile() from public, anon, authenticated;

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

create or replace function public.note_sign_in_attempt(keys text[], max_tries integer, window_minutes integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_ok boolean := true;
begin
  -- Old attempts are of no use; tidy them now and then rather than on every call.
  if random() < 0.01 then
    delete from public.sign_in_attempts where at < now() - interval '1 day';
  end if;
  foreach v_key in array keys loop
    if (select count(*) from public.sign_in_attempts a where a.key = v_key and a.at > now() - make_interval(mins => window_minutes)) >= max_tries then
      v_ok := false;
    end if;
    insert into public.sign_in_attempts (key) values (v_key);
  end loop;
  return v_ok;
end;
$$;
revoke all on function public.note_sign_in_attempt(text[], integer, integer) from public, anon, authenticated;
grant execute on function public.note_sign_in_attempt(text[], integer, integer) to service_role;
