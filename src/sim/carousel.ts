// Which ad a billboard face is showing right now. The turn comes from the real clock, not from when a
// player arrived, so once bookings come from the server everyone looking at a board sees the same ad.

/** What the carousel needs to know about a booking. */
export interface Queued {
  /** Real time it was paid for: earlier bookings go first in the turn. */
  paidAt: number;
  /** Real time it stops showing. */
  until: number;
}

/** Bookings still running at this moment, in turn order. */
export function liveQueue<T extends Queued>(queue: readonly T[], now: number): T[] {
  return queue.filter((b) => b.paidAt <= now && now < b.until).sort((a, b) => a.paidAt - b.paidAt);
}

/** The ad up now, how many share the face, and when it changes next. */
export function showing<T extends Queued>(queue: readonly T[], now: number, slotMs: number): { ad: T | null; count: number; changesAt: number } {
  const live = liveQueue(queue, now);
  const slot = Math.floor(now / slotMs);
  const changesAt = (slot + 1) * slotMs;
  if (!live.length) return { ad: null, count: 0, changesAt };
  return { ad: live[slot % live.length], count: live.length, changesAt };
}

/**
 * When a booking of this many showings stops. A showing is one slot on the face; the face is shared by
 * at most `queue` ads, so this many showings are guaranteed even when the face is full.
 */
export const bookingEnds = (paidAt: number, showings: number, slotMs: number, queue: number) => paidAt + showings * slotMs * queue;

/** Room on the face for one more ad. */
export const faceHasRoom = (queue: readonly Queued[], now: number, max: number) => liveQueue(queue, now).length < max;
