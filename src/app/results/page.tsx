import type { Metadata } from "next";
import { ResultsBoard } from "@/components/results/ResultsBoard";

export const metadata: Metadata = {
  title: "Live results | Naija Votes",
  description: "Live results of the Naija Votes game election. A game. Not affiliated with INEC. Not a poll or prediction.",
};

/** Public, no sign-in. The page is a static shell; the numbers fill in the browser. */
export default function ResultsPage() {
  return <ResultsBoard />;
}
