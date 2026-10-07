// The election calendar. These are real dates in WAT (UTC+1), held on the national server so they can be moved
// (postponement). This file is the default the server is seeded with and the fallback when offline.
// Everything else in a citizen's life runs on their game clock. See docs/DECISIONS.md.

export interface ElectionCalendar {
  id: string;
  name: string;
  /** Campaigns opened (for copy and news only). */
  campaignOpen: string;
  /** Registration opens this long after a citizen is created. */
  registrationOpensAfterMs: number;
  registrationClose: string;
  /** Every player is told to go and collect their PVC. Collection opens here. */
  pvcAnnouncement: string;
  /** Last moment to collect a PVC: 10 minutes before polls open. */
  pvcCollectionClose: string;
  pollsOpen: string;
  pollsClose: string;
}

export const WAT = "+01:00";

export const PRESIDENTIAL_2027: ElectionCalendar = {
  id: "presidential-2027",
  name: "Presidential and National Assembly election",
  campaignOpen: `2026-08-19T00:00:00${WAT}`,
  registrationOpensAfterMs: 2 * 60 * 1000,
  registrationClose: `2026-10-30T23:59:59${WAT}`,
  pvcAnnouncement: `2026-10-31T00:00:00${WAT}`,
  pvcCollectionClose: `2026-11-05T07:50:00${WAT}`,
  pollsOpen: `2026-11-05T08:00:00${WAT}`,
  pollsClose: `2026-11-05T16:00:00${WAT}`,
};

/** Campaigning and promotion stop this long before polls open. */
export const BLACKOUT_MS = 24 * 60 * 60 * 1000;

const ms = (iso: string) => Date.parse(iso);

export const blackoutStart = (c: ElectionCalendar) => ms(c.pollsOpen) - BLACKOUT_MS;

export type CivicPhase = "registration" | "waiting-for-pvc" | "pvc-collection" | "blackout" | "polls-open" | "results";

/** Where the country is in the election calendar at a real moment (ms since epoch). */
export function civicPhase(c: ElectionCalendar, now: number): CivicPhase {
  if (now >= ms(c.pollsClose)) return "results";
  if (now >= ms(c.pollsOpen)) return "polls-open";
  if (now >= blackoutStart(c)) return "blackout";
  if (now >= ms(c.pvcAnnouncement)) return "pvc-collection";
  if (now > ms(c.registrationClose)) return "waiting-for-pvc";
  return "registration";
}

/** Registration is open for this citizen (created at createdAt) at real time now. */
export const canRegister = (c: ElectionCalendar, createdAt: number, now: number) =>
  now >= createdAt + c.registrationOpensAfterMs && now <= ms(c.registrationClose);

export const canCollectPvc = (c: ElectionCalendar, now: number) => now >= ms(c.pvcAnnouncement) && now <= ms(c.pvcCollectionClose);

export const pollsAreOpen = (c: ElectionCalendar, now: number) => now >= ms(c.pollsOpen) && now < ms(c.pollsClose);

export const campaigningAllowed = (c: ElectionCalendar, now: number) => now < blackoutStart(c);
