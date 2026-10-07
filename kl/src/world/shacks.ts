// Slum shacks, drawn in code: a few small huts of planks and rusty zinc packed
// onto one plot, with a washing line. There is no tile for them yet.
import { Graphics } from "pixi.js";

const WALLS = [0x8a6a45, 0x7a5a3a, 0x9c7b52, 0x6b5238];
const ROOFS = [0x8e6b4a, 0xa0522d, 0x7d7d7d, 0x9a8b78];

/** Draws a cluster of shacks with its base on (0, 0). seed varies the layout. */
export function drawShacks(g: Graphics, seed: number): void {
  let s = seed || 1;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const spots = [[-46, -6], [0, -22], [44, -4], [-6, 16], [36, 18]];
  g.ellipse(0, 6, 90, 34).fill({ color: 0x000000, alpha: 0.12 });
  for (const [x, y] of spots.sort((a, b) => a[1] - b[1])) {
    if (r() < 0.2) continue;
    const w = 26 + r() * 10;
    const h = 16 + r() * 6;
    const d = 12;
    const wall = WALLS[Math.floor(r() * WALLS.length)];
    const roof = ROOFS[Math.floor(r() * ROOFS.length)];
    // Front, side and a sloping zinc roof.
    g.rect(x - w / 2, y - h, w, h).fill(wall).stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    g.poly([x + w / 2, y, x + w / 2 + d, y - d / 2, x + w / 2 + d, y - h - d / 2, x + w / 2, y - h]).fill(wall - 0x101010);
    g.poly([x - w / 2 - 3, y - h, x + w / 2 + 3, y - h, x + w / 2 + d + 3, y - h - d / 2 - 4, x - w / 2 + d - 3, y - h - d / 2 - 4]).fill(roof);
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      g.moveTo(x - w / 2 + w * t, y - h).lineTo(x - w / 2 + w * t + d, y - h - d / 2 - 4).stroke({ width: 1, color: 0x000000, alpha: 0.2 });
    }
    g.rect(x - 4, y - 11, 8, 11).fill(0x3a2a1f);
  }
  // A washing line across the yard.
  g.moveTo(-60, -26).lineTo(58, -30).stroke({ width: 1, color: 0x555555 });
  for (const [x, c] of [[-40, 0xc0392b], [-20, 0x2b4c7e], [6, 0xf2b705], [30, 0x2f7d5b]] as [number, number][]) {
    g.rect(x, -26 - (x + 60) * 0.035, 9, 10).fill(c);
  }
}
