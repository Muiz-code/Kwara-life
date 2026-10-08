"use client";
// The browser's Supabase client. It uses the publishable key, which is safe to ship: Row Level Security
// decides what it may read, and every write goes through an edge function that re-checks the rules.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

/** The shared client, or null when this build has no Supabase settings (the game then plays offline). */
export function supabase(): SupabaseClient | null {
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

export const online = () => !!url && !!key;
