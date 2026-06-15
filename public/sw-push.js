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
  const data = event.notification.data || {}

  // Boutons "Valider" / "Rejeter" : on délègue l'action à une fenêtre
  // ouverte de l'app (qui dispose des détails complets du bon/réception
  // via useNotificationActionListener). Si aucune fenêtre n'est ouverte,
  // on ouvre la page Validations pour que l'utilisateur agisse manuellement.
  if (event.action === 'valider' || event.action === 'rejeter') {
    event.notification.close()

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        if (clientList.length === 0) {
          if (clients.openWindow) {
            return clients.openWindow(data.url || '/validations')
          }
          return
        }

        for (const client of clientList) {
          client.postMessage({ type: 'notification-action', action: event.action, notifId: data.notifId })
        }
        if ('focus' in clientList[0]) {
          return clientList[0].focus()
        }
      })
    )
    return
  }

  event.notification.close()
  const url = data.url || '/'

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
