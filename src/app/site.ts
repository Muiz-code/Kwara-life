// Where the game lives, for share links, the sitemap and canonical URLs. Set NEXT_PUBLIC_SITE_URL on the host
// when the domain changes (https://naija-vote.raavon.com once it points here); until then, the Vercel address.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://naija-votes-ruddy.vercel.app").replace(/\/$/, "");

export const SITE_NAME = "Naija Votes";
export const TAGLINE = "Live a Nigerian life. Get your PVC. Vote once.";
export const SITE_DESCRIPTION =
  "Naija Votes is a free multiplayer Nigerian life sim: pick your state and LGA, hustle, collect your PVC, campaign and vote once on one shared election day, Saturday 14 November 2026. A game, not affiliated with INEC, not a poll or prediction.";
