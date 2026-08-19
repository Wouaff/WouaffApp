const VERSION = 'wouaff-v1';
const CORE_ASSETS = ['/', '/index.html', '/manifest.webmanifest'];

/* Cache les ressources du shell de l'app à l'installation */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {
        /* installe même si le préchargement échoue — le cache runtime prendra le relais */
      }),
  );
});

/* Nettoie les anciennes versions du cache */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

const isNavigation = (req) => req.mode === 'navigate';
const isApi = (url) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io');
const isStatic = (url) =>
  url.pathname.startsWith('/assets/') ||
  /\.(css|js|png|jpe?g|gif|svg|webp|woff2?|ico|json|webmanifest)$/.test(url.pathname);

/* Stratégies : navigation network-first (fallback offline), assets cache-first */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || isApi(url)) return;

  if (isNavigation(req)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(VERSION);
          cache.put('/index.html', fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match('/index.html');
          if (cached) return cached;
          const home = await caches.match('/');
          return home || Response.error();
        }
      })(),
    );
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(VERSION);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })(),
    );
  }
});

/* Clic sur une notification système */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          try {
            if ('navigate' in client) client.navigate(url);
          } catch {
            /* navigation cross-origin ignorée */
          }
          return;
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
