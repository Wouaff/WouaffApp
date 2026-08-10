self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

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
