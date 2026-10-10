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

/** The game opens to players. The season runs one month and ends on election day. */
export const LAUNCH = `2026-10-14T00:00:00+01:00`;

export const PRESIDENTIAL_2027: ElectionCalendar = {
  id: "presidential-2027",
  name: "Presidential and National Assembly election",
  campaignOpen: `2026-08-19T00:00:00${WAT}`,
  registrationOpensAfterMs: 2 * 60 * 1000,
  registrationClose: `2026-10-30T23:59:59${WAT}`,
  pvcAnnouncement: `2026-10-31T00:00:00${WAT}`,
  pvcCollectionClose: `2026-11-14T07:50:00${WAT}`,
  pollsOpen: `2026-11-14T08:00:00${WAT}`,
  pollsClose: `2026-11-14T16:00:00${WAT}`,
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

/** After polls close the season is over: the game freezes for every player and only results are shown. */
export const seasonClosed = (c: ElectionCalendar, now: number) => now >= ms(c.pollsClose);

// ---- Moving the election (postponement), from the admin panel ----

/** The dates the server may override; everything else in the calendar is fixed. */
export const MOVABLE = ["registrationClose", "pvcAnnouncement", "pvcCollectionClose", "pollsOpen", "pollsClose"] as const;
export type CalendarOverrides = Partial<Pick<ElectionCalendar, (typeof MOVABLE)[number]>>;

/** Apply the server's dates to the shared calendar in place, so every module that reads it sees them. */
export function setCalendar(o: CalendarOverrides | null | undefined, c: ElectionCalendar = PRESIDENTIAL_2027) {
  if (!o) return;
  for (const k of MOVABLE) if (typeof o[k] === "string" && !Number.isNaN(Date.parse(o[k]!))) c[k] = o[k]!;
}

/** "Saturday 14 November 2026", in WAT. */
export function electionDayLabel(c: ElectionCalendar = PRESIDENTIAL_2027, short = false): string {
  const d = new Date(Date.parse(c.pollsOpen) + 3_600_000);
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
  const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][d.getUTCMonth()];
  return short ? `${day.slice(0, 3)} ${d.getUTCDate()} ${month.slice(0, 3)}` : `${day} ${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
}

/** "8am to 4pm", in WAT. */
export function pollHoursLabel(c: ElectionCalendar = PRESIDENTIAL_2027): string {
  const h = (iso: string) => {
    const d = new Date(Date.parse(iso) + 3_600_000);
    const hr = d.getUTCHours();
    const m = d.getUTCMinutes();
    return `${hr % 12 === 0 ? 12 : hr % 12}${m ? ":" + String(m).padStart(2, "0") : ""}${hr < 12 ? "am" : "pm"}`;
  };
  return `${h(c.pollsOpen)} to ${h(c.pollsClose)}`;
}

/**
 * Move election day to new poll times. Only before polls open, and the new opening must be at least a day away
 * (players need the campaign blackout). PVC collection closes 10 minutes before polls; registration and PVC
 * collection move by the same amount, unless they have already passed.
 */
export function moveElection(c: ElectionCalendar, pollsOpen: string, pollsClose: string, now: number): { calendar: CalendarOverrides } | { error: string } {
  const open = Date.parse(pollsOpen);
  const close = Date.parse(pollsClose);
  if (Number.isNaN(open) || Number.isNaN(close)) return { error: "Pick a date and poll hours" };
  if (now >= ms(c.pollsOpen)) return { error: "Polls have opened. The election date is locked" };
  if (open < now + BLACKOUT_MS) return { error: "The new polls must open at least a day from now" };
  if (close <= open) return { error: "Polls must close after they open" };
  if (close - open > 14 * 3_600_000) return { error: "Polls can be open for 14 hours at most" };
  const shift = open - ms(c.pollsOpen);
  const moved = (iso: string) => (ms(iso) > now ? new Date(ms(iso) + shift).toISOString() : iso);
  return {
    calendar: {
      registrationClose: moved(c.registrationClose),
      pvcAnnouncement: moved(c.pvcAnnouncement),
      pvcCollectionClose: new Date(open - 10 * 60_000).toISOString(),
      pollsOpen: new Date(open).toISOString(),
      pollsClose: new Date(close).toISOString(),
    },
  };
}
