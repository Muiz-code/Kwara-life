// Playing together: /api/together/here and /inbox (GET), /presence, /settings, /invite, /answer, /emote, /block and
// /report (POST). Every call is a signed-in player's; the rules are in src/server/together.ts.
import { supabaseAdmin } from "@/net/supabase-admin";
import { bodyOf, forPlayer, json, send } from "@/server/route";
import { supabaseTogetherDb } from "@/server/supabase-together";
import * as T from "@/server/together";

type Ctx = { params: Promise<{ action: string }> };
const db = () => supabaseTogetherDb(supabaseAdmin());

export const GET = async (req: Request, { params }: Ctx) => {
  const { action } = await params;
  return forPlayer(req, async (user) => {
    if (action === "here") return send(await T.here(db(), user, Date.now()));
    if (action === "inbox") return send(await T.inbox(db(), user, Date.now()));
    return json({ error: "Not found" }, 404);
  });
};

export const POST = async (req: Request, { params }: Ctx) => {
  const { action } = await params;
  return forPlayer(req, async (user) => {
    const body = await bodyOf(req, 2048);
    if (!body) return json({ error: "Try again" }, 400);
    const now = Date.now();
    switch (action) {
      case "presence":
        return send(await T.presence(db(), user, body));
      case "settings":
        return send(await T.settings(db(), user, body));
      case "invite":
        return send(await T.invite(db(), user, body, now));
      case "answer":
        return send(await T.answer(db(), user, body, now));
      case "emote":
        return send(await T.emote(db(), user, body, now));
      case "block":
        return send(await T.block(db(), user, body));
      case "report":
        return send(await T.report(db(), user, body));
      default:
        return json({ error: "Not found" }, 404);
    }
  });
};
