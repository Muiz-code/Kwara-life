// News on TV, radio, papers and overheard on the street.
import { ADS, NEWS, NEWSPAPERS, RADIO_STATIONS } from "../data/media";
import type { Action } from "../data/action";
import type { GameState } from "./state";
import { dayNum, hourOf } from "./time";
import { pick, type Rng } from "./rng";

/** Live headlines from the server replace NEWS when available. */
export function currentHeadline(t: number, headlines: string[] = NEWS): string {
  return headlines[(dayNum(t) * 3 + hourOf(t)) % headlines.length];
}

/** Informed points a media action gives: TV and a bought paper teach more. */
export const mediaInformed = (m: NonNullable<Action["media"]>) => (m === "tv" || m === "paper2" ? 2 : 1);

/** Overheard news on 40% of trips (docs/DESIGN.md "News and media"). */
export const OVERHEAR_ON_TRIP = 0.4;

export interface MediaShow {
  title: string;
  lines: string[];
}

/** What the player sees on the TV, radio or papers. sponsored: today's paid news lines, already labelled. */
export function mediaShow(kind: NonNullable<Action["media"]>, s: GameState, rng: Rng, sponsored: string[] = [], headlines: string[] = NEWS): MediaShow {
  const head = currentHeadline(s.t, headlines);
  if (kind === "tv") {
    const lines = [`NVT NEWS LIVE: ${head}`];
    if (sponsored.length) lines.push(`Sponsored: ${sponsored[0]}`);
    lines.push(`Ad: ${ADS[dayNum(s.t) % ADS.length]}`);
    return { title: "On the TV", lines };
  }
  if (kind === "radio") {
    const lines = [`${pick(rng, RADIO_STATIONS)}: ${head}`];
    if (sponsored.length) lines.push(`Sponsored: ${sponsored[0]}`);
    return { title: "On the radio", lines };
  }
  const n = kind === "paper2" ? 5 : 3;
  return { title: "Today's papers", lines: headlines.slice(0, n).map((h, i) => `${NEWSPAPERS[i % NEWSPAPERS.length]}: ${h}`) };
}
