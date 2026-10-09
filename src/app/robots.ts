import type { MetadataRoute } from "next";
import { SITE_URL } from "./site";

/** Search engines may read the game and the results board; the API and the season files are not pages. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/results"], disallow: ["/api/", "/season/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
