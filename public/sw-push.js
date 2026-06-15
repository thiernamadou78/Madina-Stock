// ============================================================
// MadinaStock — Gestion des notifications Push en arrière-plan
// Importé par le service worker généré (workbox importScripts)
// ============================================================

self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()

  const options = {
    body: data.body || data.message,
    icon: '/pwa-192x192.svg',
    badge: '/pwa-192x192.svg',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    tag: data.tag || 'madina-stock',
    renotify: true,
    data: {
      url: data.url || '/',
      bonId: data.bonId,
      type: data.type,
    },
    actions: data.actions || [],
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
