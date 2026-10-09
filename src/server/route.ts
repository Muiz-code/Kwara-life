// Shared plumbing for the game's API routes: who is calling (their Supabase sign-in), body limits, and
// turning a Reply into a response that is never cached.
import { supabaseAdmin } from "@/net/supabase-admin";
import type { Reply } from "./game";

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const send = (r: Reply) => json(r.body, r.status);

/** The signed-in account behind a request (its Bearer token), or null. */
export async function userOf(req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

/** The JSON body, or null if it is missing, broken or bigger than `max` bytes (a save is tens of kilobytes). */
export async function bodyOf(req: Request, max = 400 * 1024): Promise<unknown> {
  const text = await req.text().catch(() => "");
  if (!text || text.length > max) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Runs a route's work for a signed-in player, with the same answers for the usual failures. */
export async function forPlayer(req: Request, work: (user: string) => Promise<Response>): Promise<Response> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return json({ error: "The game server is not set up here" }, 503);
  const user = await userOf(req);
  if (!user) return json({ error: "Sign in again" }, 401);
  try {
    return await work(user);
  } catch {
    return json({ error: "The game server is busy. Your game is safe on this phone; we'll try again" }, 503);
  }
}
