/* eslint-disable no-restricted-globals */
const CACHE_VERSION = "v2";
const CACHE_NAME = `capynotes-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const assets = [
        // App shell and key routes so the app is usable offline
        new Request(OFFLINE_URL, { cache: "reload" }),
        new Request("/", { cache: "reload" }),
        new Request("/dashboard", { cache: "reload" }),
        new Request("/dashboard/notas", { cache: "reload" }),
        new Request("/dashboard/tarefas", { cache: "reload" }),
        // Manifest and icons
        "/manifest.webmanifest",
        "/adaptive-icon.png",
      ];
      // Pre-cache assets in a resilient way; skip any that fail
      await Promise.allSettled(
        assets.map(async (item) => {
          const request =
            typeof item === "string"
              ? new Request(item, { cache: "reload" })
              : item;
          try {
            const response = await fetch(request);
            if (response && response.ok) {
              await cache.put(request, response.clone());
            }
          } catch (_) {
            // Ignore fetch errors for individual assets
          }
        })
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean old caches
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)));

      // Enable navigation preload if available
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  // Handle navigations - Network first, fallback to offline page
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const preloadResp = await event.preloadResponse;
          if (preloadResp) return preloadResp;
          const networkResp = await fetch(event.request);
          // Cache successful navigations to enable offline revisits
          if (networkResp && networkResp.status === 200) {
            try {
              await cache.put(event.request, networkResp.clone());
            } catch (_) {
              // Ignore cache put errors
            }
          }
          return networkResp;
        } catch (error) {
          // Try the exact requested page from cache
          const cachedPage = await cache.match(event.request);
          if (cachedPage) return cachedPage;

          // Try app shell routes from cache to keep the app usable offline
          const appShellCandidates = ["/dashboard", "/"]; // prioritize dashboard, then home
          for (const route of appShellCandidates) {
            const resp = await cache.match(route);
            if (resp) return resp;
          }

          // Last resort: offline page
          const offlineResp = await cache.match(OFFLINE_URL);
          return offlineResp || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // Cache-first for static assets
  const url = new URL(event.request.url);
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/") ||
      /\.(png|svg|jpg|jpeg|gif|webp|ico|css|js)$/.test(url.pathname))
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) return cached;

        const resp = await fetch(event.request);
        if (resp && resp.status === 200) {
          try {
            await cache.put(event.request, resp.clone());
          } catch (e) {
            // ignore cache put errors
          }
        }
        return resp;
      })()
    );
  }
});

// Handle notification clicks to navigate users
self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const targetUrl = (notification && notification.data && notification.data.url) || "/";
  event.notification.close();
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          if (client.focus) await client.focus();
          if (client.navigate && clientUrl.pathname !== targetUrl) {
            await client.navigate(targetUrl);
          }
          return;
        } catch (_) {}
      }
      // If no client is open, open a new window
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// Receive messages from pages to show notifications via SW context
self.addEventListener("message", (event) => {
  const data = event && event.data;
  const isNotify = data && (data.type === "notify" || data.type === "SHOW_NOTIFICATION");
  if (!isNotify) return;
  const payload = data.payload || {};
  const title = payload.title;
  const options = payload.options || {};
  if (title) {
    try {
      self.registration.showNotification(title, options);
    } catch (_) {}
  }
});