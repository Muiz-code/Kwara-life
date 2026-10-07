import type { Metadata, Viewport } from "next";
import { Figtree, Lilita_One } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const lilita = Lilita_One({
  variable: "--font-lilita",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Naija Votes 2027",
  description: "A Nigerian life sim where you live, get your PVC and vote. A game, not affiliated with INEC, not a poll or prediction.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${lilita.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
