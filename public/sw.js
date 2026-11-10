/* SOQQA service worker — offline-first app shell.
 *
 * - Precaches every route's HTML plus all hashed build assets listed in
 *   /precache-manifest.json (generated after `next build`).
 * - Navigations: network-first with cached fallback, then /offline.html.
 * - /_next/static/*: cache-first (content-hashed, immutable).
 * - RSC requests: network-first, cached fallback; a miss makes Next.js fall
 *   back to a full navigation, which is served from the precache.
 * - /api/* is never cached (AI, rates and auth must hit the network).
 * Data itself lives in IndexedDB, so the app is fully usable offline.
 */
// BUILD is stamped by scripts/generate-precache.mjs after `next build`; a new
// value makes browsers install the new worker and show the update banner.
const BUILD = "uRU7RRqHh6LRipQKI37th";
const VERSION = `soqqa-${BUILD}`;
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const RUNTIME = `${VERSION}-runtime`;
// Base path of the deployment ("" at the domain root, "/soqqa" on GitHub Pages).
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const p = (path) => BASE + path;
const ROUTES = ["/", "/transactions", "/wallets", "/budgets", "/analytics", "/goals", "/advisor", "/settings", "/welcome", "/auth", "/offline.html"].map(p);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      await Promise.all(ROUTES.map((r) => shell.add(new Request(r, { cache: "reload" })).catch(() => undefined)));
      try {
        const res = await fetch(p("/precache-manifest.json"), { cache: "no-store" });
        if (res.ok) {
          const { assets = [], build } = await res.json();
          const stat = await caches.open(STATIC);
          // Add in small batches so one failure does not abort the install.
          for (let i = 0; i < assets.length; i += 20) {
            await Promise.all(assets.slice(i, i + 20).map((a) => stat.add(a).catch(() => undefined)));
          }
          await shell.put(p("/__build"), new Response(String(build ?? "")));
        }
      } catch {
        /* offline during install: runtime caching will fill in */
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("soqqa-") && !k.startsWith(`${VERSION}-`)).map((k) => caches.delete(k)));
      // Drop static assets from older builds (hashed names no longer referenced).
      try {
        const res = await fetch(p("/precache-manifest.json"), { cache: "no-store" });
        if (res.ok) {
          const { assets = [] } = await res.json();
          const keep = new Set(assets.map((a) => new URL(a, self.location.origin).pathname));
          const stat = await caches.open(STATIC);
          for (const req of await stat.keys()) if (!keep.has(new URL(req.url).pathname)) await stat.delete(req);
        }
      } catch {
        /* ignore */
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isRsc(request, url) {
  return request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(p("/api/"))) return;

  if (url.pathname.startsWith(p("/_next/static/")) || url.pathname.startsWith(p("/icons/")) || /\.(woff2?|png|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (isRsc(request, url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(request)) || Response.error()),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(url.pathname, copy));
          }
          return res;
        } catch {
          const cache = await caches.open(SHELL);
          return (await cache.match(url.pathname)) || (await cache.match(p("/"))) || (await cache.match(p("/offline.html"))) || Response.error();
        }
      })(),
    );
  }
});
