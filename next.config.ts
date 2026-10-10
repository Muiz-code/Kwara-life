import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/** The Supabase project the game talks to: its API over https and its realtime channels over wss. */
const supabase = (() => {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return ` https://${u.host} wss://${u.host}`;
  } catch {
    return "";
  }
})();

// Content Security Policy. Scripts and data only from this site, so injected script can't phone
// home and the game can't be framed by a lookalike page. PixiJS builds shader code with
// new Function, hence 'unsafe-eval'; Next's inline bootstrap needs 'unsafe-inline'.
// Supabase is allowed below; when Paystack lands, add its origin (and frame-src for checkout) the same
// way, nothing wider.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // blob: and data: are the 3D models' own embedded textures, which the GLTF loader fetches.
  `connect-src 'self' blob: data:${supabase}${dev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  // Video ads on smart screens play from this browser's own store (blob: URLs).
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Always defined, so the build inlines it and strips the debug tools from a normal production
  // bundle. Build with NEXT_PUBLIC_ALLOW_DEBUG=1 only for a tester's preview deploy.
  env: { NEXT_PUBLIC_ALLOW_DEBUG: process.env.NEXT_PUBLIC_ALLOW_DEBUG === "1" ? "1" : "0" },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker is checked for a new version on every visit, so a deploy reaches installed apps.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
