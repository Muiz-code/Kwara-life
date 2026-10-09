// Where the game lives, for share links, the sitemap and canonical URLs. Set NEXT_PUBLIC_SITE_URL on the host
// when the domain changes (https://naija-vote.raavon.com once it points here); until then, the Vercel address.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://naija-votes-ruddy.vercel.app").replace(/\/$/, "");

export const SITE_NAME = "Naija Votes";
export const TAGLINE = "Live a Nigerian life. Get your PVC. Vote once.";
/** For search results: Google shows about 155 characters. */
export const SITE_DESCRIPTION =
  "Free multiplayer Nigerian life sim: pick your state, hustle, get your PVC and vote on 14 Nov 2026. A game, not affiliated with INEC.";
/** For share previews, which show about 125 characters. */
export const SHARE_DESCRIPTION = "Pick your state, hustle, get your PVC and vote on 14 Nov 2026. A game, not affiliated with INEC.";
