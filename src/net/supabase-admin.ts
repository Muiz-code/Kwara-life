// The server's Supabase client, with the secret key: it bypasses Row Level Security, so it must never
// reach a browser. Only route handlers and server code import this file.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") throw new Error("supabase-admin is server-only");

let admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // The new secret key, or the older service_role key: either works.
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server settings are missing (see .env.example)");
  admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
