// Naija Votes as an app on the phone (src/components/pwa/Pwa.tsx registers this).
// - The game's code, 3D models and art are kept on the phone after the first visit, so the game opens fast on
//   mobile data and still opens without a signal (progress uploads once the signal is back).
// - Anything that counts is never kept: saves, votes, results, admin, the season feeds, and Supabase itself
//   always come from the network.
// - A new deploy is picked up on the next open: pages are fetched fresh first, and the code they load has new
//   names, so nobody is left on old code.
const VERSION = "nv-1";
const STATIC = `${VERSION}-static`;
const MEDIA = `${VERSION}-media`;
const PAGES = `${VERSION}-pages`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!key.startsWith(VERSION)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

/** Never kept: they must always be live. */
const NEVER = [/^\/api\//, /^\/admin/, /^\/season\//, /^\/results/, /^\/_next\/data\//, /^\/sw\.js$/, /^\/video\//];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Other sites (Supabase, analytics) go straight through.
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((re) => re.test(url.pathname))) return;
  if (req.headers.has("range")) return;

  // The game's code: named by its contents, so a kept copy is always the right one.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }
  // 3D models, art and icons: from the phone at once, refreshed in the background.
  if (/^\/(models|assets|icons)\//.test(url.pathname) || /\.(png|jpg|jpeg|webp|svg|glb|gltf|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req, MEDIA, event));
    return;
  }
  // Pages: fresh from the network, the last good copy when there is no signal.
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, PAGES));
  }
});

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, name, event) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) {
    event.waitUntil(fresh);
    return hit;
  }
  return (await fresh) ?? Response.error();
}

async function networkFirst(req, name) {
  const cache = await caches.open(name);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) ?? (await cache.match("/")) ?? Response.error();
  }
}
