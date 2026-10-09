// Clock times on the results board, always in WAT whatever the screen's own time zone.
const WAT_MS = 3600_000;

/** "10:42am" in WAT. */
export function watTime(ms: number) {
  const d = new Date(ms + WAT_MS);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h % 12 === 0 ? 12 : h % 12}:${m}${h < 12 ? "am" : "pm"}`;
}

/** "3d 04:12:09" until a moment. */
export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hms = [Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
  return d ? `${d}d ${hms}` : hms;
}
