// Cloth textures painted on a canvas: aso-oke stripes, isiagu lion heads, Tiv A'nger stripes, george and
// atamfa prints, embroidery. Small and cached, so dressing a crowd costs almost nothing.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import type { Pattern } from "../data/attire";

/** A colour made lighter (k > 1) or darker (k < 1). */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("")}`;
}

const cache = new Map<string, Texture>();
const GOLD = "#D4AF37";

export type Weave = Pattern | "okpu" | "embroidered-panel";

/** The texture for a cloth of this pattern and colour. */
export function fabric(pattern: Weave, colour: string): Texture | null {
  if (pattern === "plain" || typeof document === "undefined") return null;
  const key = `${pattern}|${colour}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = colour;
  g.fillRect(0, 0, S, S);
  const light = shade(colour, 1.35);
  const dark = shade(colour, 0.6);
  switch (pattern) {
    case "asooke":
      // Hand-woven strips: wide bands, fine thread lines and a metallic stripe.
      for (let x = 0; x < S; x += 32) {
        g.fillStyle = dark;
        g.fillRect(x + 18, 0, 10, S);
        g.fillStyle = light;
        g.fillRect(x + 6, 0, 3, S);
        g.fillStyle = GOLD;
        g.fillRect(x + 23, 0, 2, S);
      }
      for (let y = 0; y < S; y += 4) {
        g.fillStyle = "rgba(0,0,0,0.06)";
        g.fillRect(0, y, S, 1);
      }
      break;
    case "lion":
      // Isiagu: rows of lion heads in gold on the cloth.
      for (let y = 16; y < S; y += 32) {
        for (let x = 16 + ((y / 32) % 2) * 16; x < S + 16; x += 32) {
          g.fillStyle = GOLD;
          g.beginPath();
          g.arc(x % S, y, 9, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = dark;
          g.beginPath();
          g.arc(x % S, y, 5, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#F4E7C1";
          g.fillRect((x % S) - 3, y - 1, 2, 2);
          g.fillRect((x % S) + 1, y - 1, 2, 2);
        }
      }
      break;
    case "anger":
      // Tiv A'nger: black and white stripes.
      for (let y = 0; y < S; y += 16) {
        g.fillStyle = "#151515";
        g.fillRect(0, y, S, 8);
        g.fillStyle = "#F2F0EA";
        g.fillRect(0, y + 8, S, 8);
      }
      break;
    case "george":
      // Big woven paisley-like medallions with small gold dots.
      for (const [x, y] of [[32, 32], [96, 96], [96, 32], [32, 96]]) {
        g.fillStyle = light;
        g.beginPath();
        g.ellipse(x, y, 20, 12, Math.PI / 4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = dark;
        g.beginPath();
        g.ellipse(x, y, 9, 5, Math.PI / 4, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = GOLD;
      for (let i = 0; i < 40; i++) g.fillRect((i * 37) % S, (i * 53) % S, 2, 2);
      break;
    case "atamfa":
      // Wax print: bold circles and leaves in a strong contrast.
      for (let y = 0; y < S; y += 42) {
        for (let x = 0; x < S; x += 42) {
          g.fillStyle = "#F7EFD8";
          g.beginPath();
          g.arc(x + 21, y + 21, 14, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = dark;
          g.beginPath();
          g.arc(x + 21, y + 21, 8, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = light;
          g.beginPath();
          g.ellipse(x + 2, y + 2, 9, 4, Math.PI / 4, 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    case "embroidery":
      // Plain cloth with a fine self-coloured weave; the embroidery itself is a chest panel.
      for (let y = 0; y < S; y += 3) {
        g.fillStyle = "rgba(255,255,255,0.05)";
        g.fillRect(0, y, S, 1);
      }
      break;
    case "embroidered-panel":
      // Swirls of thread round the neck and down the chest.
      g.strokeStyle = colour === "#F4F1EA" ? "#B08D3C" : "#F4E7C1";
      g.lineWidth = 3;
      for (let r = 12; r < 64; r += 10) {
        g.beginPath();
        g.arc(64, 0, r, 0, Math.PI);
        g.stroke();
      }
      for (let y = 70; y < S; y += 14) {
        g.beginPath();
        g.moveTo(40, y);
        g.lineTo(64, y + 10);
        g.lineTo(88, y);
        g.stroke();
      }
      break;
    case "okpu":
      // The red Igbo cap with its black lines.
      for (let y = 8; y < S; y += 24) {
        g.fillStyle = "#161616";
        g.fillRect(0, y, S, 6);
      }
      break;
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(2, 2);
  cache.set(key, t);
  return t;
}
