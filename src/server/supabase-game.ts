// The game's database, on Supabase, through the server-only functions in supabase/migrations (game_sync,
// one_device, votes).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VoteAnswer } from "./civic";
import type { CitizenRow, GameDb } from "./game";

export function supabaseGameDb(sb: SupabaseClient): GameDb {
  return {
    async load(user) {
      const { data, error } = await sb
        .from("game_saves")
        .select("game, version, citizens!inner(id, name, state_code, lga_code, pu_code, zone, pvc, last_play, credits_ok)")
        .eq("user_id", user)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const citizen = (Array.isArray(data.citizens) ? data.citizens[0] : data.citizens) as CitizenRow & { id: string };
      const rolls = await sb.from("voter_rolls").select("election_id").eq("citizen_id", citizen.id);
      if (rolls.error) throw rolls.error;
      return { citizen, game: data.game, version: data.version as number, voted: rolls.data.map((r) => r.election_id as string) };
    },
    async create(user, c, game) {
      const { data, error } = await sb.rpc("create_citizen", {
        p_user: user, p_name: c.name, p_state: c.state_code, p_lga: c.lga_code, p_pu: c.pu_code, p_zone: c.zone, p_game: game,
      });
      if (error) throw error;
      return data as { created: boolean; game: unknown; version: number };
    },
    async save(user, game, version) {
      const { data, error } = await sb.rpc("save_game", { p_user: user, p_game: game, p_version: version });
      if (error) throw error;
      return (data as number | null) ?? null;
    },
    async claim(user, device, staleMinutes) {
      const { data, error } = await sb.rpc("claim_device", { p_user: user, p_device: device, p_stale_minutes: staleMinutes });
      if (error) throw error;
      return data === true;
    },
    async release(user, device) {
      const { error } = await sb.rpc("release_device", { p_user: user, p_device: device });
      if (error) throw error;
    },
    async setPvc(user, from, to) {
      const { error } = await sb.from("citizens").update({ pvc: to }).eq("user_id", user).eq("pvc", from);
      if (error) throw error;
    },
    async castVote(user, election, party, opens, closes) {
      const { data, error } = await sb.rpc("cast_vote", { p_user: user, p_election: election, p_party: party, p_opens: opens, p_closes: closes });
      if (error) throw error;
      return data as VoteAnswer;
    },
    async turnout(election) {
      const { data, error } = await sb.rpc("vote_turnout", { p_election: election });
      if (error) throw error;
      return Number(data) || 0;
    },
    async notePlay(user, day) {
      const { error } = await sb.rpc("note_play", { p_user: user, p_day: day });
      if (error) throw error;
    },
    async setCredits(user, ok) {
      const { error } = await sb.from("citizens").update({ credits_ok: ok }).eq("user_id", user);
      if (error) throw error;
    },
    async topPlayers(limit) {
      const { data, error } = await sb.rpc("credits_top", { p_limit: limit });
      if (error) throw error;
      return (data ?? []) as { name: string; state_code: string; lga_code: string; plays: number }[];
    },
  };
}
