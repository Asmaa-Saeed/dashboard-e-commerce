// Service worker for the installable dashboard (PWA).
// Store data (orders, conversations, products) is always fetched live from the network and
// never cached, so the app never shows stale orders. We only cache:
//  - Next.js build files under /_next/static/ (their names change on every deploy),
//  - the offline page and the app icons, shown when there is no internet.

const VERSION = "v1";
const STATIC_CACHE = `flowpal-static-${VERSION}`;
const SHELL_CACHE = `flowpal-shell-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const SHELL_FILES = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== STATIC_CACHE && key !== SHELL_CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // Server Actions and form posts go straight to the network

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase and product photos: untouched

  // Page loads: always from the network; offline page when there is no connection.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    );
    return;
  }

  // Hashed build files never change, so cache them for fast app starts.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
  // Everything else (RSC data, API calls): default network behaviour.
});
