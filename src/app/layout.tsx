import type { Metadata, Viewport } from "next";
import { Figtree, Lilita_One } from "next/font/google";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, TAGLINE } from "./site";

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
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: live a Nigerian life, get your PVC, vote`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["Naija Votes", "Nigeria", "Nigerian game", "life sim", "PVC", "election game", "INEC", "vote", "multiplayer", "Naija"],
  category: "game",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_NG",
    url: "/",
    title: `${SITE_NAME}: live a Nigerian life, get your PVC, vote`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: TAGLINE },
  robots: { index: true, follow: true },
  appleWebApp: { title: SITE_NAME, capable: true, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141B33",
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
