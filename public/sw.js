/* Smart Al-Idara Pro — PWA service worker
 * Strategy: network-first for navigations so HTML is never stale,
 * cache-first for hashed/static assets. Manifests: network-only (no stale/401 cache).
 */
const CACHE = "al-idara-v10-pwa-all-depts-ai-save";
const PRECACHE = [
  "/manifest.webmanifest",
  "/manifest-tl-transport.webmanifest",
  "/manifest-tl-logistics.webmanifest",
  "/manifest-tl-production.webmanifest",
  "/manifest-tl-quality.webmanifest",
  "/manifest-tl-maintenance.webmanifest",
  "/manifest-tl-utilities.webmanifest",
  "/favicon.svg",
  "/logo.svg",
  "/pwa-192.png",
  "/pwa-512.png",
];

function okToCacheResponse(res) {
  return res && res.status === 200 && res.type === "basic";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event && event.data === "SKIP_WAITING") self.skipWaiting();
});

function offlineResponse() {
  return new Response("Offline", {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return;

  // Web manifests: دائماً من الشبكة — يتفادى 401/392 من كاش قديم أو حماية النشر
  if (url.pathname.endsWith(".webmanifest")) {
    event.respondWith(
      fetch(req)
        .then((res) => (res && res.ok ? res : offlineResponse()))
        .catch(() => offlineResponse())
    );
    return;
  }

  // Navigations + HTML: network-first — always resolve to a valid Response.
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const nw = await fetch(req);
          if (nw && nw.ok) return nw;
        } catch {
          /* fall through */
        }
        try {
          const fromCache = (await caches.match(req)) || (await caches.match("/"));
          if (fromCache) return fromCache;
        } catch {
          /* ignore */
        }
        try {
          const root = await fetch("/");
          if (root && root.ok) return root;
        } catch {
          /* ignore */
        }
        return offlineResponse();
      })()
    );
    return;
  }

  // Static assets: cache-first, fill on miss — يجب أن يعيد دائماً كائن Response صالح
  event.respondWith(
    (async () => {
      try {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (okToCacheResponse(res)) {
          try {
            const copy = res.clone();
            const c = await caches.open(CACHE);
            await c.put(req, copy);
          } catch {
            /* ignore cache write */
          }
        }
        return res && res instanceof Response ? res : offlineResponse();
      } catch {
        return offlineResponse();
      }
    })()
  );
});
