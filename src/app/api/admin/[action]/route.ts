// The admin panel's API: /api/admin/me, /stats, /reports, /cards, /promos and /log (GET); /hide, /ban, /unban,
// /announce and /unannounce (POST). Only admins get answers; anyone else is told "not found". Unlike the game
// routes it keeps working after polls close, so the owner can still watch and moderate.
import { connection } from "next/server";
import { supabaseAdmin } from "@/net/supabase-admin";
import * as A from "@/server/admin";
import { bodyOf, json, send, userOf } from "@/server/route";

type Ctx = { params: Promise<{ action: string }> };
const notFound = () => json({ error: "Not found" }, 404);

async function forAdmin(req: Request, action: string, work: (admin: string, role: A.Role) => Promise<Response>): Promise<Response> {
  await connection();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return notFound();
  const user = await userOf(req);
  if (!user) return notFound();
  const role = await A.roleOf(supabaseAdmin(), user);
  if (!role) return notFound();
  if (action !== "me" && !A.allowed(role, action)) return json({ error: "Only the owner can do that" }, 403);
  try {
    return await work(user, role);
  } catch {
    return json({ error: "Busy. Try again" }, 503);
  }
}

export const GET = async (req: Request, { params }: Ctx) => {
  const { action } = await params;
  return forAdmin(req, action, async (_admin, role) => {
    const db = supabaseAdmin();
    switch (action) {
      case "me":
        return json({ role });
      case "stats":
        return json(await A.stats(db));
      case "reports":
        return json(await A.reports(db));
      case "cards":
        return json(await A.cards(db));
      case "promos":
        return json(await A.promos(db));
      case "log":
        return json(await A.adminLog(db));
      case "settings":
        return json(await A.gameSettings(db));
      case "team":
        return json(await A.team(db));
      default:
        return notFound();
    }
  });
};

export const POST = async (req: Request, { params }: Ctx) => {
  const { action } = await params;
  return forAdmin(req, action, async (admin) => {
    const db = supabaseAdmin();
    const body = ((await bodyOf(req, 4096)) ?? {}) as Record<string, unknown>;
    switch (action) {
      case "hide":
        return send(await A.hide(db, admin, body));
      case "ban":
        return send(await A.ban(db, admin, body));
      case "unban":
        return send(await A.unban(db, admin, body));
      case "announce":
        return send(await A.announce(db, admin, body));
      case "unannounce":
        return send(await A.unannounce(db, admin));
      case "pause":
        return send(await A.pause(db, admin, body, true));
      case "unpause":
        return send(await A.pause(db, admin, body, false));
      case "calendar":
        return send(await A.moveCalendar(db, admin, body, Date.now()));
      case "add-moderator":
        return send(await A.addModerator(db, admin, body));
      case "remove-moderator":
        return send(await A.removeModerator(db, admin, body));
      default:
        return notFound();
    }
  });
};
