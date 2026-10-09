// Cast a vote. The server checks the PVC and the polling hours (by the database's clock), records THAT the
// citizen voted on the roll and adds one to their polling unit's count for the party. No ballot is stored.
import { supabaseAdmin } from "@/net/supabase-admin";
import { vote } from "@/server/game";
import { bodyOf, forPlayer, json, send } from "@/server/route";
import { supabaseGameDb } from "@/server/supabase-game";

export const POST = (req: Request) =>
  forPlayer(req, async (user) => {
    const body = await bodyOf(req, 1024);
    if (!body) return json({ error: "Choose one party" }, 400);
    return send(await vote(supabaseGameDb(supabaseAdmin()), user, body));
  });
