-- One device at a time per account. The device playing holds the account; another device is told to log out
-- there first. Logging out frees it at once. A device that stops checking in (the phone died, the app was
-- closed without logging out) loses it after a few minutes, so nobody is locked out of their own account.
-- Server only: no browser role can see or touch this table.
create table public.active_devices (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  device_id  text not null check (device_id ~ '^[A-Za-z0-9_-]{16,64}$'),
  seen_at    timestamptz not null default now()
);
alter table public.active_devices enable row level security;
revoke all on table public.active_devices from anon, authenticated;

-- Take or keep the account for this device. False when another device has it and checked in recently.
create or replace function public.claim_device(p_user uuid, p_device text, p_stale_minutes integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  insert into public.active_devices as d (user_id, device_id) values (p_user, p_device)
  on conflict (user_id) do update set device_id = excluded.device_id, seen_at = now()
    where d.device_id = excluded.device_id or d.seen_at < now() - make_interval(mins => p_stale_minutes)
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;
revoke all on function public.claim_device(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.claim_device(uuid, text, integer) to service_role;

-- Logging out: free the account for another device (only if this device holds it).
create or replace function public.release_device(p_user uuid, p_device text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.active_devices where user_id = p_user and device_id = p_device;
$$;
revoke all on function public.release_device(uuid, text) from public, anon, authenticated;
grant execute on function public.release_device(uuid, text) to service_role;
