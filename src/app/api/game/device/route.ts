// One device at a time: the device playing checks in every few minutes to keep the account, and frees it
// when the player logs out ({ release: true }).
import { supabaseAdmin } from "@/net/supabase-admin";
import { device } from "@/server/game";
import { bodyOf, forPlayer, json, send } from "@/server/route";
import { supabaseGameDb } from "@/server/supabase-game";

export const POST = (req: Request) =>
  forPlayer(req, async (user) => {
    const body = await bodyOf(req, 1024);
    if (!body) return json({ error: "Reload the game" }, 400);
    return send(await device(supabaseGameDb(supabaseAdmin()), user, body));
  });
