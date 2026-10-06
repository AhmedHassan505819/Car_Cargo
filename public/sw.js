/// <reference lib="webworker" />

// Service worker for BBA Transport PWA
// Handles Web Push notifications and basic offline support

const sw = self as unknown as ServiceWorkerGlobalScope;

// Push notification handler
sw.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options: NotificationOptions = {
    body: data.body || 'New notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'default',
    data: data.url || '/',
    vibrate: [200, 100, 200],
    actions: data.actions || [],
  };

  event.waitUntil(
    sw.registration.showNotification(data.title || 'BBA Transport', options)
  );
});

// Notification click handler
sw.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data || '/';

  event.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      return sw.clients.openWindow(url);
    })
  );
});

// Install event — cache critical assets
sw.addEventListener('install', () => {
  sw.skipWaiting();
});

// Activate event
sw.addEventListener('activate', (event) => {
  event.waitUntil(sw.clients.claim());
});
