"use client";
// The campaign feed from the server: real players' support cards in your LGA and today's sponsored news. Null
// offline or until the first answer (the Campaign tab then shows simulated supporters).
import { useEffect, useState } from "react";
import { online } from "./supabase";

export interface FeedCard {
  by: string;
  party: string;
  issues: string[];
  note: string;
  day: string;
}
export interface FeedSponsored {
  by: string;
  kind: "flyer" | "news";
  option: number;
  party: string;
}
export interface CampaignFeed {
  cards: FeedCard[];
  sponsored: FeedSponsored[];
}

const EVERY_MS = 60_000;

export function useCampaignFeed(lgaCode: string | undefined): CampaignFeed | null {
  const [feed, setFeed] = useState<CampaignFeed | null>(null);
  useEffect(() => {
    if (!online() || !lgaCode) return;
    let alive = true;
    const read = async () => {
      try {
        const r = await fetch(`/api/feed?lga=${encodeURIComponent(lgaCode)}`);
        const j = (await r.json()) as Partial<CampaignFeed>;
        if (alive && r.ok) setFeed({ cards: Array.isArray(j.cards) ? j.cards : [], sponsored: Array.isArray(j.sponsored) ? j.sponsored : [] });
      } catch {
        // No connection: keep what we have.
      }
    };
    void read();
    const id = setInterval(() => void read(), EVERY_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [lgaCode]);
  return feed;
}
