-- Fix: in before_user_created the variable "domain" clashed with blocked_email_domains.domain
-- (error 42702, every sign-up would have failed). Variables now carry a v_ prefix.
create or replace function public.before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := event -> 'user' ->> 'email';
  v_domain text;
  v_canon text;
begin
  if v_email is null or position('@' in v_email) = 0 then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', 'Enter a valid email address'));
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
