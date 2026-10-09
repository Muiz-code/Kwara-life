import type { Metadata } from "next";
import { ResultsBoard } from "@/components/results/ResultsBoard";

export const metadata: Metadata = {
  title: "Live results",
  alternates: { canonical: "/results" },
  description: "Live results of the Naija Votes game election. A game. Not affiliated with INEC. Not a poll or prediction.",
  openGraph: {
    type: "website",
    siteName: "Naija Votes",
    locale: "en_NG",
    url: "/results",
    title: "Naija Votes live results",
    description: "Every vote in the game, counted live from 8am on election day. A game. Not affiliated with INEC. Not a poll or prediction.",
  },
  twitter: { card: "summary_large_image", title: "Naija Votes live results", description: "Every vote in the game, counted live on election day." },
};

/** Public, no sign-in. The page is a static shell; the numbers fill in the browser. */
export default function ResultsPage() {
  return <ResultsBoard />;
}
