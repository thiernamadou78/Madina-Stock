import { useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { approuverBon, rejeterBon } from '../lib/bons'
import { validerReception, rejeterReception } from '../lib/receptions'

interface NotificationActionMessage {
  type: 'notification-action'
  action: 'valider' | 'rejeter'
  notifId?: string
}

function isNotificationActionMessage(data: unknown): data is NotificationActionMessage {
  return !!data && typeof data === 'object' && (data as { type?: unknown }).type === 'notification-action'
}

/**
 * Écoute les clics sur les boutons "Valider"/"Rejeter" des notifications
 * Push affichées par le Service Worker (voir public/sw-push.js) et exécute
 * l'action correspondante à l'aide des détails du bon/réception déjà
 * présents dans le centre de notifications local.
 */
export function useNotificationActionListener() {
  const user = useAppStore((s) => s.user)

  useEffect(() => {
    if (!user) return
    if (!('serviceWorker' in navigator)) return

    const handler = async (event: MessageEvent) => {
      if (!isNotificationActionMessage(event.data)) return
      const { action, notifId } = event.data

      const notification = useAppStore.getState().notifications.find((n) => n.id === notifId)
      if (!notification) return

      if (notification.bonSortie) {
        const result = action === 'valider'
          ? await approuverBon(notification.bonSortie.id, user.id)
          : await rejeterBon(notification.bonSortie.id, user.id)

        if (result.success) useAppStore.getState().removeNotification(notification.id)
      } else if (notification.bonReception) {
        const result = action === 'valider'
          ? await validerReception(notification.bonReception, user.id)
          : await rejeterReception(notification.bonReception, user.id)

        if (!result.error) useAppStore.getState().removeNotification(notification.id)
      }
    }

    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [user])
}
