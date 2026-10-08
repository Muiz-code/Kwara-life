-- "naija" is in half the usernames in Nigeria (naija_boy, naija_queen): reserve the game's own names only as
-- the whole username, not as a word inside one. Adds an "exact" match kind.
alter table public.blocked_username_words drop constraint blocked_username_words_match_check;
alter table public.blocked_username_words add constraint blocked_username_words_match_check check (match in ('token', 'anywhere', 'exact'));
update public.blocked_username_words set match = 'exact' where word in ('naija', 'naijavotes');

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
       or (b.match = 'exact' and b.word = regexp_replace(v_name, '[_0-9]+', '', 'g'))
  ) then
    return 'That username is not allowed. Try another';
  end if;
  return null;
end;
$$;
