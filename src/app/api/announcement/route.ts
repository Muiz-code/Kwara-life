// The owner's announcement for every player's news ticker. Public and cached on the CDN for a minute, so a
// million players reading it cost the database one query a minute.
import { connection } from "next/server";
import { supabaseAdmin } from "@/net/supabase-admin";
import { currentAnnouncement } from "@/server/admin";

export async function GET() {
  await connection();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return Response.json({ text: null });
  try {
    const text = await currentAnnouncement(supabaseAdmin());
    return Response.json({ text }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120" } });
  } catch {
    return Response.json({ text: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
