-- Usernames: every account has a unique public name (@tunde_ib), chosen at sign-up. Players can sign in with
-- their email or their username. The email stays private: only the server can turn a username into an
-- email, inside the sign-in route, which also limits how fast anyone can guess passwords.

-- ---------------------------------------------------------------------------------------------------
-- What a username may be. One place for the rules, used by the sign-up guard and the "is it free?" check.
create table public.blocked_username_words (
  word text primary key check (word = lower(word) and word ~ '^[a-z]+$'),
  -- token: only as a whole word between underscores or digits ("die" blocks "die_hard", not "diego");
  -- anywhere: inside any name (strong swearing).
  match text not null check (match in ('token', 'anywhere'))
);
alter table public.blocked_username_words enable row level security;
revoke all on table public.blocked_username_words from anon, authenticated;

insert into public.blocked_username_words (word, match) values
  -- Reserved: nobody may pose as the game, its staff or an authority.
  ('admin', 'token'), ('administrator', 'token'), ('naija', 'token'), ('naijavotes', 'token'), ('inec', 'token'),
  ('vinec', 'token'), ('support', 'token'), ('moderator', 'token'), ('mod', 'token'), ('official', 'token'),
  ('staff', 'token'), ('system', 'token'), ('root', 'token'), ('null', 'token'), ('undefined', 'token'),
  ('police', 'token'), ('efcc', 'token'), ('army', 'token'), ('klario', 'token'), ('raavon', 'token'),
  -- Politics: usernames are not campaign posters.
  ('vote', 'token'), ('votes', 'token'), ('voting', 'token'), ('election', 'token'), ('campaign', 'token'),
  ('candidate', 'token'), ('president', 'token'), ('presidential', 'token'), ('governor', 'token'),
  ('senator', 'token'), ('chairman', 'token'), ('aa', 'token'), ('aac', 'token'), ('adc', 'token'),
  ('adp', 'token'), ('apc', 'token'), ('apga', 'token'), ('apm', 'token'), ('app', 'token'), ('bp', 'token'),
  ('dla', 'token'), ('lp', 'token'), ('ndc', 'token'), ('nnpp', 'token'), ('nrm', 'token'), ('pdp', 'token'),
  ('prp', 'token'), ('sdp', 'token'), ('yp', 'token'), ('ypp', 'token'), ('zlp', 'token'),
  -- The game's blocked words (src/data/campaign.ts BLOCKED_WORDS), as whole words.
  ('kill', 'token'), ('die', 'token'), ('thug', 'token'), ('idiot', 'token'), ('fool', 'token'),
  ('stupid', 'token'), ('rig', 'token'), ('burn', 'token'), ('attack', 'token'), ('hate', 'token'),
  -- Strong swearing, anywhere in the name.
  ('fuck', 'anywhere'), ('shit', 'anywhere'), ('bitch', 'anywhere'), ('bastard', 'anywhere'),
  ('whore', 'anywhere'), ('ashawo', 'anywhere'), ('pussy', 'anywhere'), ('dick', 'anywhere'), ('cunt', 'anywhere');

-- Why a username can't be used, or null if it can (format and words only; not whether it is taken).
create or replace function public.username_problem(name text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text := lower(btrim(coalesce(name, '')));
begin
  if char_length(v_name) < 3 then return 'Use at least 3 characters'; end if;
  if char_length(v_name) > 20 then return 'Keep it to 20 characters'; end if;
  if v_name !~ '^[a-z0-9_]+$' then return 'Use only letters, numbers and _'; end if;
  if v_name !~ '[a-z]' then return 'Use at least one letter'; end if;
  if exists (
    select 1 from public.blocked_username_words b
    where (b.match = 'anywhere' and position(b.word in v_name) > 0)
       or (b.match = 'token' and b.word = any (regexp_split_to_array(v_name, '[_0-9]+')))
  ) then
    return 'That username is not allowed. Try another';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Profiles: the public username of each account.
create table public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  username    text not null check (username = lower(username) and username ~ '^[a-z0-9_]{3,20}$'),
  created_at  timestamptz not null default now()
);
create unique index profiles_username on public.profiles (username);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
-- Usernames are public names: anyone signed in may read them (not the user_id behind them).
grant select (username, created_at) on table public.profiles to authenticated;
create policy "usernames are public" on public.profiles for select to authenticated using (true);

-- The profile is made in the same transaction as the account, from the username given at sign-up.
create or replace function public.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, lower(btrim(new.raw_user_meta_data ->> 'username')));
  return new;
end;
$$;
revoke all on function public.create_profile() from public, anon, authenticated;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile();

-- ---------------------------------------------------------------------------------------------------
-- "Is this username free?" for the sign-up form, as you type. Usernames are public, so saying whether one
-- is taken gives nothing away.
create or replace function public.username_available(name text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_problem text := public.username_problem(name);
begin
  if v_problem is not null then return jsonb_build_object('ok', false, 'reason', v_problem); end if;
  if exists (select 1 from public.profiles p where p.username = lower(btrim(name))) then
    return jsonb_build_object('ok', false, 'reason', 'That username is taken');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- The email behind a username, for the sign-in route only (server, secret key). Browsers can't call it.
create or replace function public.email_for_username(name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where p.username = lower(btrim(name))
$$;
revoke all on function public.email_for_username(text) from public, anon, authenticated;
grant execute on function public.email_for_username(text) to service_role;

-- ---------------------------------------------------------------------------------------------------
-- Sign-in attempts through our route, to slow password guessing (Supabase's own per-IP limit can't tell
-- players apart when every request comes from our server).
create table public.sign_in_attempts (
  id     bigint generated always as identity primary key,
  key    text not null,
  at     timestamptz not null default now()
);
create index sign_in_attempts_key on public.sign_in_attempts (key, at desc);
alter table public.sign_in_attempts enable row level security;
revoke all on table public.sign_in_attempts from anon, authenticated;

-- Record an attempt under each key and say whether all of them are still under their limit.
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
  -- Old attempts are of no use: keep the table small.
  delete from public.sign_in_attempts where at < now() - interval '1 day';
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

-- ---------------------------------------------------------------------------------------------------
-- The sign-up guard now also checks the username: allowed words, and free.
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
  v_canon text;
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
  v_canon := public.canonical_email(v_email);
  if exists (select 1 from auth.users u where public.canonical_email(u.email) = v_canon) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400,
      'message', 'An account with this email already exists. Sign in instead'));
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
grant select on table public.profiles, public.blocked_username_words to supabase_auth_admin;
grant execute on function public.username_problem(text) to supabase_auth_admin;
