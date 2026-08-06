const CACHE_NAME = "rivet-down-v2";
const CACHE_PREFIX = "rivet-down-";
const CORE = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        CORE.map(async (path) => {
          const response = await fetch(path, { cache: "reload" });
          if (response.ok) {
            await cache.put(path, response);
          }
        }),
      );
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const staleCaches = keys.filter(
        (key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME,
      );
      await Promise.all(staleCaches.map((key) => caches.delete(key)));
      await self.clients.claim();

      // v1 served cached HTML before checking the network. Reload existing
      // clients once during the upgrade so they cannot keep a deleted chunk URL.
      if (staleCaches.length > 0) {
        const windows = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        await Promise.all(windows.map((client) => client.navigate(client.url)));
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(event.request);
        const navigationFallback =
          event.request.mode === "navigate" ? await caches.match("/") : null;
        return (
          cached ??
          navigationFallback ??
          new Response("Offline asset unavailable", {
            status: 503,
            statusText: "Offline",
          })
        );
      }
    })(),
  );
});
