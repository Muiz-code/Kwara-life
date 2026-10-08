-- Sign-up guard: one person, one account, as far as email and password allow.
--
-- Supabase calls this "before user created" hook for every sign-up, including ones made straight
-- against the Auth API with the public key, so the app can't be bypassed. It refuses:
-- * throwaway email services;
-- * a second account for the same mailbox written another way. Gmail ignores dots and anything after a
--   "+", so a.b.c+2@gmail.com is the same inbox as abc@gmail.com; most providers ignore "+tags".
--
-- Switch it on in the dashboard: Authentication > Auth Hooks > "Before User Created" > Postgres
-- function > public.before_user_created.

-- The mailbox an address really delivers to, for spotting duplicates.
create or replace function public.canonical_email(email text)
returns text
language sql
immutable
set search_path = ''
as $$
  with parts as (
    select lower(split_part(btrim(email), '@', 1)) as local_part,
           lower(split_part(btrim(email), '@', 2)) as domain
  ),
  clean as (
    select split_part(local_part, '+', 1) as local_part,
           case when domain = 'googlemail.com' then 'gmail.com' else domain end as domain
    from parts
  )
  select case when domain = 'gmail.com' then replace(local_part, '.', '') else local_part end || '@' || domain
  from clean
$$;

-- Throwaway inbox services. Easy to extend: insert a row, no code change.
create table public.blocked_email_domains (
  domain text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$')
);
alter table public.blocked_email_domains enable row level security;
revoke all on table public.blocked_email_domains from anon, authenticated;

insert into public.blocked_email_domains (domain) values
  ('mailinator.com'), ('guerrillamail.com'), ('guerrillamail.net'), ('sharklasers.com'), ('grr.la'),
  ('10minutemail.com'), ('10minutemail.net'), ('temp-mail.org'), ('tempmail.com'), ('tempmail.net'),
  ('tempmailo.com'), ('tempr.email'), ('throwawaymail.com'), ('yopmail.com'), ('yopmail.net'),
  ('getnada.com'), ('nada.email'), ('dispostable.com'), ('maildrop.cc'), ('mailnesia.com'),
  ('mintemail.com'), ('mohmal.com'), ('trashmail.com'), ('trashmail.de'), ('fakeinbox.com'),
  ('emailondeck.com'), ('mailcatch.com'), ('spamgourmet.com'), ('moakt.com'), ('tmail.ws'),
  ('discard.email'), ('burnermail.io'), ('inboxkitten.com'), ('mail.tm'), ('emailfake.com'),
  ('fakemail.net'), ('mytemp.email'), ('tempinbox.com'), ('mailpoof.com'), ('linshiyouxiang.net');

-- The hook itself. Returns {} to allow, or an error the sign-up form shows the player.
create or replace function public.before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  email text := event -> 'user' ->> 'email';
  domain text;
  canon text;
begin
  if email is null or position('@' in email) = 0 then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', 'Enter a valid email address'));
  end if;
  domain := lower(split_part(btrim(email), '@', 2));
  if exists (select 1 from public.blocked_email_domains b where domain = b.domain or domain like '%.' || b.domain) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400,
      'message', 'Use your own email address, not a temporary inbox'));
  end if;
  canon := public.canonical_email(email);
  if exists (select 1 from auth.users u where public.canonical_email(u.email) = canon) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400,
      'message', 'An account with this email already exists. Sign in instead'));
  end if;
  return '{}'::jsonb;
end;
$$;

-- Only Supabase Auth may run the hook; nobody else may call it or read its tables.
revoke all on function public.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on table public.blocked_email_domains to supabase_auth_admin;
revoke all on function public.canonical_email(text) from public, anon, authenticated;
grant execute on function public.canonical_email(text) to supabase_auth_admin;
