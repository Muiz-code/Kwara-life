"use client";
// The owner's announcement for the news ticker (src/server/admin.ts). The server caches it for a minute;
// players check every five minutes, so it reaches everyone soon after it is posted.
import { useEffect, useState } from "react";
import { online } from "./supabase";

export function useAnnouncement(): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!online()) return;
    let live = true;
    const load = () =>
      fetch("/api/announcement")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => live && setText(typeof j?.text === "string" ? j.text : null))
        .catch(() => {});
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  return text;
}
