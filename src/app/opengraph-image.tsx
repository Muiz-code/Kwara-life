import { shareCard, OG_SIZE } from "./og-assets/card";
import { TAGLINE } from "./site";

export const alt = "Naija Votes: a Nigerian life sim where you get your PVC and vote. A game, not affiliated with INEC.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return shareCard({ title: "Naija Votes", line: TAGLINE });
}
