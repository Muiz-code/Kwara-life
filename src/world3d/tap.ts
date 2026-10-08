// Telling a tap from moving the camera. Only a quick, still press of one finger or the left mouse button
// is a tap; two fingers (turning or pinching), the right button (turning), a drag or a long press all move
// the camera and never make the player walk.

/** Call onTap for real taps on el. Returns a function that stops listening. */
export function listenForTaps(el: HTMLElement, onTap: (e: PointerEvent) => void): () => void {
  const pointers = new Set<number>();
  let down: { x: number; y: number; t: number; id: number } | null = null;
  /** More than one finger touched during this gesture: it is a camera move, not a tap. */
  let multi = false;

  const onDown = (e: PointerEvent) => {
    pointers.add(e.pointerId);
    if (pointers.size > 1) multi = true;
    if (pointers.size === 1) {
      multi = false;
      down = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId } : null;
    }
  };
  const onMove = (e: PointerEvent) => {
    if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down = null;
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    const d = down;
    if (!d || e.pointerId !== d.id) return;
    down = null;
    const tap = !multi && e.button === 0 && performance.now() - d.t < 400 && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 8;
    if (tap) onTap(e);
  };
  const onCancel = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    down = null;
  };
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onCancel);
  return () => {
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onCancel);
  };
}
