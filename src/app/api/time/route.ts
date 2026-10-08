import { connection } from "next/server";

/** The server's clock. The game runs its election calendar from this, never from the device clock. */
export async function GET() {
  await connection();
  return Response.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
