"use client";
// The owner's settings, on the player's side (src/server/settings.ts): the election dates after a postponement,
// applied to the shared calendar before the game starts, and the emergency pause, checked every minute.
import { useEffect, useState } from "react";
import { setCalendar, type CalendarOverrides } from "@/data/calendar";
import { online } from "./supabase";

export interface PublicSettings {
  paused: boolean;
  message: string;
}

/** Fetch the settings and apply the election dates. Safe to call often; never throws. */
export async function loadGameSettings(): Promise<PublicSettings> {
  if (!online()) return { paused: false, message: "" };
  try {
    const r = await fetch("/api/game-settings", { cache: "no-store" });
    if (!r.ok) return { paused: false, message: "" };
    const j = (await r.json()) as { paused?: boolean; message?: string; calendar?: CalendarOverrides };
    setCalendar(j.calendar);
    return { paused: !!j.paused, message: j.message ?? "" };
  } catch {
    return { paused: false, message: "" };
  }
}

/** The pause, checked every minute while the game is open. */
export function usePause(): PublicSettings {
  const [s, setS] = useState<PublicSettings>({ paused: false, message: "" });
  useEffect(() => {
    let live = true;
    const load = () => void loadGameSettings().then((x) => live && setS(x));
    load();
    const id = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  return s;
}
