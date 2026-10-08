// Sign in with an email OR a username. The username is turned into its email here on the server, so a
// player's email is never shown to anyone. Because every sign-in now comes from this server, Supabase's
// own per-address guessing limit can't tell players apart, so this route keeps its own: a few tries per
// account and per network every 15 minutes. Every failure gives the same answer, so nobody can learn
// which usernames or emails have accounts.
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/net/supabase-admin";

const WINDOW_MINUTES = 15;
/** Per account (an email or username), and per network. Mobile networks in Nigeria share addresses widely. */
const TRIES_PER_LOGIN = 8;
const TRIES_PER_NETWORK = 30;

const FAILED = "Wrong email, username or password";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { login?: unknown; password?: unknown } | null;
  const login = typeof body?.login === "string" ? body.login.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!login || !password || login.length > 254 || password.length > 72) return json({ error: "Enter your email or username and your password" }, 400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return json({ error: "Sign-in is not set up on this server" }, 503);
  const admin = supabaseAdmin();

  // The first address in x-forwarded-for is the player's, as set by the host (Vercel and most proxies).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const [perLogin, perNetwork] = await Promise.all([
    admin.rpc("note_sign_in_attempt", { keys: [`login:${login}`], max_tries: TRIES_PER_LOGIN, window_minutes: WINDOW_MINUTES }),
    admin.rpc("note_sign_in_attempt", { keys: [`ip:${ip}`], max_tries: TRIES_PER_NETWORK, window_minutes: WINDOW_MINUTES }),
  ]);
  if (perLogin.error || perNetwork.error) return json({ error: "Sign-in is busy. Try again in a moment" }, 503);
  if (!perLogin.data || !perNetwork.data) return json({ error: `Too many tries. Wait ${WINDOW_MINUTES} minutes and try again` }, 429);

  let email = login;
  if (!login.includes("@")) {
    const { data, error } = await admin.rpc("email_for_username", { name: login });
    if (error) return json({ error: "Sign-in is busy. Try again in a moment" }, 503);
    if (!data) return json({ error: FAILED }, 401);
    email = data as string;
  }

  // A throwaway client per request: nothing about one player's session can leak into another's.
  // Sb-Forwarded-For hands Supabase the player's address, so its own sign-in limits count per player, not
  // per server. Supabase only honours it once forwarding is switched on for the project; until then every
  // sign-in looks like it comes from this server (see docs/HANDOVER.md, launch checklist).
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: ip !== "unknown" ? { "Sb-Forwarded-For": ip } : {} },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    if (error && /email not confirmed/i.test(error.message)) return json({ error: "Confirm your email first: open the link we sent you", unconfirmed: true }, 403);
    return json({ error: FAILED }, 401);
  }
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
}
