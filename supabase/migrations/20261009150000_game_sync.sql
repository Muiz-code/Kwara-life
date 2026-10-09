-- Phase E1: the citizen and the save live on the server. Only the server (secret key) calls these; browsers
-- can read their own citizen and save (core migration) but never write them.

-- A new citizen and their first save, together or not at all. The unique user_id on citizens is the "one
-- person, one citizen" rule: a second call for the same account returns the save that already exists.
create or replace function public.create_citizen(
  p_user uuid, p_name text, p_state text, p_lga text, p_pu text, p_zone text, p_game jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_save record;
begin
  insert into public.citizens (user_id, name, state_code, lga_code, pu_code, zone)
  values (p_user, btrim(p_name), p_state, p_lga, p_pu, p_zone::public.zone)
  on conflict (user_id) do nothing
  returning id into v_id;
  if v_id is null then
    select game, version into v_save from public.game_saves where user_id = p_user;
    return jsonb_build_object('created', false, 'game', v_save.game, 'version', v_save.version);
  end if;
  insert into public.game_saves (user_id, citizen_id, zone, game) values (p_user, v_id, p_zone::public.zone, p_game);
  return jsonb_build_object('created', true, 'game', p_game, 'version', 1);
end;
$$;
revoke all on function public.create_citizen(uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_citizen(uuid, text, text, text, text, text, jsonb) to service_role;

-- Store a save only if it was made from the latest one (its version matches): two phones or tabs can't
-- overwrite each other. Returns the new version, or null when someone saved in between.
create or replace function public.save_game(p_user uuid, p_game jsonb, p_version integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.game_saves
  set game = p_game, version = version + 1, updated_at = now()
  where user_id = p_user and version = p_version
  returning version;
$$;
revoke all on function public.save_game(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.save_game(uuid, jsonb, integer) to service_role;
