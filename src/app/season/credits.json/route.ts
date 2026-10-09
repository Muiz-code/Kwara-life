// /season/credits.json: the closing credits' top players (and, once ads are paid for on the server, top brands).
// Nothing before polls close (404, so the credits keep those parts hidden). After, it is cached on the CDN for an
// hour: the season is frozen by then, so the list no longer changes. src/net/credits.ts reads it.
import { supabaseAdmin } from "@/net/supabase-admin";
import { seasonCredits } from "@/server/game";
import { supabaseGameDb } from "@/server/supabase-game";

export const preferredRegion = "lhr1";
export const dynamic = "force-dynamic";

export async function GET() {
  const none = (status: number) => Response.json({ error: "Not yet" }, { status, headers: { "Cache-Control": "no-store" } });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return none(404);
  try {
    const credits = await seasonCredits(supabaseGameDb(supabaseAdmin()), Date.now());
    if (!credits) return none(404);
    return Response.json(credits, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } });
  } catch {
    return none(503);
  }
}
