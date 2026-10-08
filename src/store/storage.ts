import type { StateStorage } from "zustand/middleware";

/**
 * localStorage that batches writes. The store changes many times a second while
 * the clock runs; on a mid-range phone we only want to write every few seconds,
 * plus once when the page is hidden or closed.
 */
export function throttledStorage(base: Storage | undefined, delayMs = 3000): StateStorage & { flush: () => void } {
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    for (const [k, v] of pending) {
      try {
        base?.setItem(k, v);
      } catch {
        // Storage full or blocked (private mode). The game still runs, it just won't save.
      }
    }
    pending.clear();
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
    window.addEventListener("pagehide", flush);
  }

  return {
    getItem: (k) => pending.get(k) ?? (() => {
      try {
        return base?.getItem(k) ?? null;
      } catch {
        return null;
      }
    })(),
    setItem: (k, v) => {
      pending.set(k, v);
      if (!timer) timer = setTimeout(flush, delayMs);
    },
    removeItem: (k) => {
      pending.delete(k);
      try {
        base?.removeItem(k);
      } catch {
        // ignore
      }
    },
    flush,
  };
}
