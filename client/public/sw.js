const VERSION = 'wouaff-v3';
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
/* Jamais interceptés : l'API, et les médias envoyés par les utilisateurs (/uploads) — les garder en cache
   ferait grossir le cache sans limite et conserverait sur l'appareil des médias supprimés depuis. */
const isBypassed = (url) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/');
const isStatic = (url) =>
  url.pathname.startsWith('/assets/') ||
  /\.(css|js|png|jpe?g|gif|svg|webp|woff2?|ico|json|webmanifest)$/.test(url.pathname);
/* Fichiers du build dont le nom contient un hash (index-AbCd1234.js) : leur contenu ne change jamais. */
const isHashed = (url) => /\/assets\/.+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(url.pathname);

/* Stratégies : navigation network-first (fallback offline), fichiers hachés cache-first,
   autres fichiers statiques network-first (sinon logo ou theme.js modifiés restaient périmés). */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || isBypassed(url)) return;

  if (isNavigation(req)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          /* Une réponse d'erreur (502 du proxy…) ne doit jamais remplacer la page de secours. */
          if (fresh.ok) {
            const cache = await caches.open(VERSION);
            cache.put('/index.html', fresh.clone());
          }
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
        if (cached && isHashed(url)) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh.ok) {
            const cache = await caches.open(VERSION);
            cache.put(req, fresh.clone());
          }
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
  const rawUrl = event.notification.data?.url || '/';
  let url = '/';
  try {
    const parsed = new URL(rawUrl, self.location.origin);
    if (parsed.origin === self.location.origin) url = parsed.pathname + parsed.search + parsed.hash;
  } catch {
    url = '/';
  }
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
