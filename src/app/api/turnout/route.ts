// Votes cast so far (turnout only, never party standings). Public and cached on the CDN for 30 seconds, so a
// million players watching the counter cost the database one query every half minute.
import { supabaseAdmin } from "@/net/supabase-admin";
import { turnout } from "@/server/game";
import { supabaseGameDb } from "@/server/supabase-game";

export const preferredRegion = "lhr1";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return Response.json({ error: "The game server is not set up here" }, { status: 503 });
  try {
    const r = await turnout(supabaseGameDb(supabaseAdmin()));
    return Response.json(r.body, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" } });
  } catch {
    return Response.json({ error: "Busy" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
