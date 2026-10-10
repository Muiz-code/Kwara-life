// What every player's game needs from the owner's settings: the emergency pause and the election dates (after a
// postponement). Public and cached on the CDN for 30 seconds.
import { connection } from "next/server";
import { PRESIDENTIAL_2027 } from "@/data/calendar";
import { settings } from "@/server/settings";

export async function GET() {
  await connection();
  const s = await settings();
  return Response.json(
    { paused: s.paused, message: s.pauseMessage, calendar: { ...s.calendar, pollsOpen: PRESIDENTIAL_2027.pollsOpen, pollsClose: PRESIDENTIAL_2027.pollsClose } },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" } },
  );
}
