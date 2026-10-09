// The share card (Open Graph and X) is the game's first screen, the "Before you play" disclaimer: the green
// sunburst on deep blue, the name in Lilita, the tagline, the key points and the election date as the yellow
// button. So the first thing anyone sees of the game, even in a WhatsApp preview, says it is a game and not
// INEC. No party marks.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

const dir = join(process.cwd(), "src/app/og-assets");

/** The points shown on the card: the most important lines of the "Before you play" screen. */
const POINTS = [
  "A game. Not affiliated with INEC, any government agency, party or candidate.",
  "Results are made by players and simulated voters. Not a poll or prediction.",
  "For players aged 18 and over. Your vote in the game is secret.",
  "Please vote in real elections. Collect your real PVC from INEC.",
];

/** The sunburst behind everything: 36 wedges, every other one faint green. */
function rays(cx: number, cy: number, r: number) {
  const parts: string[] = [];
  for (let i = 0; i < 36; i += 2) {
    const a0 = (i * 10 * Math.PI) / 180;
    const a1 = ((i + 1) * 10 * Math.PI) / 180;
    parts.push(`M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} L${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><path d="${parts.join(" ")}" fill="rgba(17,138,79,0.18)"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function shareCard({ title, line }: { title: string; line: string }) {
  const [lilita, figtree] = await Promise.all([readFile(join(dir, "LilitaOne-Regular.ttf")), readFile(join(dir, "Figtree-Bold.ttf"))]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: "radial-gradient(circle at 50% 30%, #2B3A6B, #141B33 70%)",
          fontFamily: "Figtree",
          color: "#F7E7C1",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={rays(600, 190, 1500)} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0 }} />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            width: 980,
            padding: "38px 52px 40px",
            borderRadius: 40,
            background: "rgba(20,27,51,0.9)",
            boxShadow: "0 30px 60px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontFamily: "Lilita", fontSize: 96, lineHeight: 1, textShadow: "0 6px 0 #0A0E1E" }}>{title}</div>
            <div style={{ fontSize: 28, marginTop: 10, opacity: 0.85 }}>{line}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 30, marginTop: 30 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#F2B705" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            Before you play
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            {POINTS.map((p) => (
              <div key={p} style={{ display: "flex", alignItems: "flex-start", gap: 14, fontSize: 25, lineHeight: 1.3 }}>
                <div style={{ width: 10, height: 10, borderRadius: 10, background: "#F2B705", marginTop: 12, flexShrink: 0 }} />
                <div style={{ display: "flex" }}>{p}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 26,
              padding: "14px 0",
              borderRadius: 24,
              background: "#F2B705",
              color: "#141B33",
              fontSize: 28,
            }}
          >
            Election day: Saturday 14 November 2026
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Lilita", data: lilita, style: "normal", weight: 400 },
        { name: "Figtree", data: figtree, style: "normal", weight: 700 },
      ],
    },
  );
}
