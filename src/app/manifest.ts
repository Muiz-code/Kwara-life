import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "./site";

/** Lets phones add the game to the home screen with its own icon and colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#0F1730",
    theme_color: "#0E7A4B",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
