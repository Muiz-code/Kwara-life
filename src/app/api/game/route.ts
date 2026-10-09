// The player's game on the server: GET loads it (another phone, a fresh install), PUT stores a save.
import { supabaseAdmin } from "@/net/supabase-admin";
import { getGame, putSave } from "@/server/game";
import { bodyOf, forPlayer, json, send } from "@/server/route";
import { supabaseGameDb } from "@/server/supabase-game";

export const GET = (req: Request) =>
  forPlayer(req, async (user) => send(await getGame(supabaseGameDb(supabaseAdmin()), user, new URL(req.url).searchParams.get("device"))));

export const PUT = (req: Request) =>
  forPlayer(req, async (user) => {
    const body = await bodyOf(req);
    if (!body) return json({ error: "That save is too big or broken" }, 400);
    return send(await putSave(supabaseGameDb(supabaseAdmin()), user, body));
  });
