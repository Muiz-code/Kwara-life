import { shareCard, OG_SIZE } from "../og-assets/card";

export const alt = "Naija Votes live results: every vote in the game, counted live on election day.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return shareCard({ title: "Live results", line: "Naija Votes: every vote counted live from 8am on election day." });
}
