import type { GameStoreApi } from "./game";

/**
 * Drives the store in the browser: the idle clock once a second, and
 * activity progress every animation frame while something is playing out.
 * Returns a function that stops it.
 */
export function startGameLoop(store: GameStoreApi): () => void {
  let raf = 0;
  const frame = (now: number) => {
    raf = 0;
    store.getState().progress(now);
    if (store.getState().activity) raf = requestAnimationFrame(frame);
  };
  const ensureFrames = () => {
    if (!raf && store.getState().activity) raf = requestAnimationFrame(frame);
  };

  const unsub = store.subscribe((s, prev) => {
    if (s.activity && !prev.activity) ensureFrames();
  });
  ensureFrames();

  const interval = setInterval(() => {
    if (document.hidden) return;
    store.getState().tick();
  }, 1000);

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onMotion = () => store.getState().setReducedMotion(motion.matches);
  onMotion();
  motion.addEventListener("change", onMotion);

  return () => {
    unsub();
    clearInterval(interval);
    if (raf) cancelAnimationFrame(raf);
    motion.removeEventListener("change", onMotion);
  };
}
