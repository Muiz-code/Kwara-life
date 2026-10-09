"use client";
// Real votes cast so far, from the server (turnout only, never party standings). The answer is cached on the CDN
// for 30 seconds, so every player reading it costs the database almost nothing. Null offline or until the first
// answer comes back.
import { useEffect, useState } from "react";
import { online } from "./supabase";

const EVERY_MS = 30_000;

export function useTurnout(): number | null {
  const [votes, setVotes] = useState<number | null>(null);
  useEffect(() => {
    if (!online()) return;
    let alive = true;
    const read = async () => {
      try {
        const r = await fetch("/api/turnout");
        const body = (await r.json()) as { votes?: unknown };
        if (alive && r.ok && typeof body.votes === "number") setVotes(body.votes);
      } catch {
        // No connection: keep the last number.
      }
    };
    void read();
    const id = setInterval(() => void read(), EVERY_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return votes;
}
