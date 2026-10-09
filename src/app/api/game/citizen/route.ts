// A new citizen, rolled on the server so the roll can't be faked; or, once, a save made on this phone before
// the server existed.
import { supabaseAdmin } from "@/net/supabase-admin";
import { newCitizen } from "@/server/game";
import { bodyOf, forPlayer, json, send } from "@/server/route";
import { supabaseGameDb } from "@/server/supabase-game";

export const POST = (req: Request) =>
  forPlayer(req, async (user) => {
    const body = await bodyOf(req);
    if (!body) return json({ error: "Fill in every box" }, 400);
    return send(await newCitizen(supabaseGameDb(supabaseAdmin()), user, body, Date.now(), Math.random));
  });
