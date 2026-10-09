// The game's database, on Supabase, through the server-only functions in supabase/migrations/*_game_sync.sql.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CitizenRow, GameDb } from "./game";

export function supabaseGameDb(sb: SupabaseClient): GameDb {
  return {
    async load(user) {
      const { data, error } = await sb
        .from("game_saves")
        .select("game, version, citizens!inner(name, state_code, lga_code, pu_code, zone)")
        .eq("user_id", user)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const citizen = (Array.isArray(data.citizens) ? data.citizens[0] : data.citizens) as CitizenRow;
      return { citizen, game: data.game, version: data.version as number };
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
  };
}
