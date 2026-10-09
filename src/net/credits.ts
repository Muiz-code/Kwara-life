"use client";
// The season's top brands and top players for the closing credits. The server writes them once, when polls
// close, as a static file on the CDN (like the results snapshots); the game only reads it. Until it exists
// those parts of the credits stay hidden.
import { useEffect, useState } from "react";

export interface SeasonCredits {
  /** Brands that paid the most for ads this season, highest first. Names only, never amounts. */
  brands: string[];
  /** The season's top players, best first, as they chose to be shown. */
  players: { name: string; place: string }[];
}

export const CREDITS_URL = "/season/credits.json";

const clean = (raw: unknown): SeasonCredits | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const brands = Array.isArray(r.brands) ? r.brands.filter((b): b is string => typeof b === "string").slice(0, 20) : [];
  const players = Array.isArray(r.players)
    ? r.players
        .filter((p): p is { name: string; place: string } => !!p && typeof p === "object" && typeof (p as { name?: unknown }).name === "string")
        .map((p) => ({ name: p.name, place: typeof p.place === "string" ? p.place : "" }))
        .slice(0, 10)
    : [];
  return { brands, players };
};

export function useSeasonCredits(): SeasonCredits | null {
  const [credits, setCredits] = useState<SeasonCredits | null>(null);
  useEffect(() => {
    let live = true;
    fetch(CREDITS_URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setCredits(clean(j)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return credits;
}
