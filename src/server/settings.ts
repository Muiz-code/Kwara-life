// The owner's game settings (supabase/migrations/*_admin_settings.sql): the emergency pause and the election
// dates. Every server instance reads them at most every 30 seconds and applies the dates to the shared calendar,
// so the game's own rules (src/sim, src/data/calendar.ts) follow a postponement without any other change.
import { setCalendar, type CalendarOverrides } from "@/data/calendar";
import { supabaseAdmin } from "@/net/supabase-admin";

export interface Settings {
  paused: boolean;
  pauseMessage: string;
  calendar: CalendarOverrides;
}

const DEFAULTS: Settings = { paused: false, pauseMessage: "", calendar: {} };
const TTL_MS = 30_000;
let cached: { at: number; s: Settings } | null = null;

/** The settings, fresh within 30 seconds. On any trouble, the last known (or the defaults): never blocks a route. */
export async function settings(): Promise<Settings> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.s;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return DEFAULTS;
  try {
    const { data } = await supabaseAdmin().from("game_settings").select("paused, pause_message, calendar").eq("id", 1).maybeSingle();
    const s: Settings = data ? { paused: !!data.paused, pauseMessage: (data.pause_message as string) ?? "", calendar: (data.calendar as CalendarOverrides) ?? {} } : DEFAULTS;
    setCalendar(s.calendar);
    cached = { at: Date.now(), s };
    return s;
  } catch {
    return cached?.s ?? DEFAULTS;
  }
}

/** Forget the cache, after the owner changes something, so this instance answers with the new settings at once. */
export const settingsChanged = () => {
  cached = null;
};

export const PAUSED = "Naija Votes is paused for a short while. Your game is safe; we'll be back soon.";
