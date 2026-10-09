"use client";
// Billboard ads booked on this device. Until the ads service exists (docs/HANDOVER.md, Phase E) bookings
// live in this browser only: other players do not see them yet.
// Each face of a board runs a carousel, so a board holds many bookings at once (queue, by payment ref).
import { createStore, useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BOARDS, type BoardFace } from "../data/boards";
import { liveQueue } from "../sim/carousel";
import { boardTypeOf, bookingUntil, onFace, type AdBooking } from "../sim/ads";
import { deleteVideo } from "./ad-media";

export const adKey = (mapId: string, boardId: string) => `${mapId}|${boardId}`;

/** The boards that exist: the ones on open land outside town (world/roadside.ts ids). */
const EDGE_BOARD = /^(billboard|attention|smart|square|tall)-/;

/** Bookings kept on this device. Pictures are data URLs, so this keeps localStorage well under its limit. */
const KEEP = 40;

interface AdsState {
  /** Every booking, by payment ref. */
  queue: Record<string, AdBooking>;
  /** The newest booking on each board (by adKey), for code that shows one ad per board. */
  bookings: Record<string, AdBooking>;
  book: (b: AdBooking) => void;
  remove: (ref: string) => void;
  /** Someone walked into the gallery and saw this artwork. */
  addView: (ref: string) => void;
}

/** Newest booking per board, from the queue. */
function newestPerBoard(queue: Record<string, AdBooking>): Record<string, AdBooking> {
  const out: Record<string, AdBooking> = {};
  for (const b of Object.values(queue)) {
    const k = adKey(b.mapId, b.boardId);
    if (!out[k] || out[k].paidAt < b.paidAt) out[k] = b;
  }
  return out;
}

export const adsStore = createStore<AdsState>()(
  persist(
    (set, get) => ({
      queue: {},
      bookings: {},
      book: (b) => {
        const booked: AdBooking = { ...b, type: b.type ?? boardTypeOf(b.boardId), until: bookingUntil(b) };
        const all = Object.values({ ...get().queue, [b.ref]: booked });
        // Drop finished bookings first, then the oldest, so storage never fills up.
        const now = Date.now();
        const keep = all.sort((x, y) => Number(bookingUntil(y) > now) - Number(bookingUntil(x) > now) || y.paidAt - x.paidAt).slice(0, KEEP);
        for (const gone of all.slice(KEEP)) if (gone.video) void deleteVideo(gone.video);
        const queue = Object.fromEntries(keep.map((x) => [x.ref, x]));
        set({ queue, bookings: newestPerBoard(queue) });
      },
      addView: (ref) => {
        const b = get().queue[ref];
        if (!b) return;
        const queue = { ...get().queue, [ref]: { ...b, views: (b.views ?? 0) + 1 } };
        set({ queue, bookings: newestPerBoard(queue) });
      },
      remove: (ref) => {
        const queue = { ...get().queue };
        const gone = queue[ref];
        delete queue[ref];
        if (gone?.video) void deleteVideo(gone.video);
        set({ queue, bookings: newestPerBoard(queue) });
      },
    }),
    {
      name: "nv-ads-v1",
      version: 2,
      storage: createJSONStorage(() => (typeof window !== "undefined" ? window.localStorage : (undefined as never))),
      partialize: (s) => ({ queue: s.queue }),
      // Version 1 kept one booking per board: each becomes a queue entry on both faces.
      migrate: (old, version) => {
        if (version < 2) {
          const bookings = (old as { bookings?: Record<string, AdBooking> } | undefined)?.bookings ?? {};
          return { queue: Object.fromEntries(Object.values(bookings).map((b) => [b.ref, { ...b, face: "both" as const }])) };
        }
        return old as { queue: Record<string, AdBooking> };
      },
      merge: (persisted, current) => {
        const saved = (persisted as { queue?: Record<string, AdBooking> } | undefined)?.queue ?? {};
        // Ads stand only on open land outside town now; bookings for the old in-town boards are dropped.
        const queue = Object.fromEntries(Object.entries(saved).filter(([, b]) => EDGE_BOARD.test(b.boardId)));
        return { ...current, queue, bookings: newestPerBoard(queue) };
      },
    },
  ),
);

/** The ads running on one face of a board right now, in carousel order. */
export function faceQueue(queue: Record<string, AdBooking>, mapId: string, boardId: string, face: BoardFace, now: number) {
  const mine = Object.values(queue)
    .filter((b) => b.mapId === mapId && b.boardId === boardId && onFace(b, face))
    .map((b) => ({ ...b, until: bookingUntil(b) }));
  return liveQueue(mine, now);
}

/** Room left on a face, given the board's kind. */
export function faceRoom(queue: Record<string, AdBooking>, mapId: string, boardId: string, face: BoardFace, now: number) {
  return BOARDS[boardTypeOf(boardId)].queue - faceQueue(queue, mapId, boardId, face, now).length;
}

export const useAds = <T,>(pick: (s: AdsState) => T) => useStore(adsStore, pick);
