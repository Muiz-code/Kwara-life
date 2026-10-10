// The campaign feed for an LGA: the latest support cards and today's sponsored news, by citizen game name. Public
// and cached on the CDN for a minute, so every player in an LGA reading it costs the database one query a minute.
import { connection } from "next/server";
import { LGA } from "@/data/geography";
import { supabaseAdmin } from "@/net/supabase-admin";
import { watDate } from "@/sim/civic";
import { gameClosed } from "@/server/season";
import { settings } from "@/server/settings";

export async function GET(req: Request) {
  await settings();
  await connection();
  const now = Date.now();
  const over = gameClosed(now);
  if (over) return Response.json(over.body, { status: over.status, headers: { "Cache-Control": "public, s-maxage=3600" } });
  const lga = new URL(req.url).searchParams.get("lga") ?? "";
  if (!LGA[lga]) return Response.json({ error: "Pick an LGA" }, { status: 400 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return Response.json({ error: "The game server is not set up here" }, { status: 503 });
  const { data, error } = await supabaseAdmin().rpc("campaign_feed", { p_lga: lga, p_day: watDate(now) });
  if (error) return Response.json({ error: "Busy" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120" } });
}
