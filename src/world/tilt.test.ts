import { describe, expect, it } from "vitest";
import { MAX_TILT, project, tiltFor, unproject } from "./tilt";

describe("camera tilt", () => {
  it("is flat zoomed out and steepest zoomed in", () => {
    expect(tiltFor(0.2, 0.2, 2)).toBe(0);
    expect(tiltFor(2, 0.2, 2)).toBeCloseTo(MAX_TILT);
    expect(tiltFor(0.8, 0.2, 2)).toBeGreaterThan(0);
    expect(tiltFor(0.8, 0.2, 2)).toBeLessThan(MAX_TILT);
  });

  it("maps a tap back to the point that was drawn there", () => {
    const v = { w: 390, h: 760, deg: MAX_TILT };
    for (const [x, y] of [[0, 0], [195, 380], [390, 760], [20, 700], [300, 40]]) {
      const s = project(v, x, y);
      const back = unproject(v, s.x, s.y);
      expect(back.x).toBeCloseTo(x, 6);
      expect(back.y).toBeCloseTo(y, 6);
    }
  });

  it("keeps the bottom edge in place and pulls the far edge in", () => {
    const v = { w: 400, h: 800, deg: MAX_TILT };
    expect(project(v, 0, 800)).toEqual({ x: 0, y: 800 });
    const top = project(v, 0, 0);
    expect(top.x).toBeGreaterThan(0);
    expect(top.y).toBeGreaterThan(0);
  });

  it("changes nothing when flat", () => {
    const v = { w: 400, h: 800, deg: 0 };
    const p = unproject(v, 123, 456);
    expect(p.x).toBeCloseTo(123);
    expect(p.y).toBeCloseTo(456);
  });
});
