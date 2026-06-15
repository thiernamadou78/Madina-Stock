import { useState } from 'react'
import type { ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, CheckCircle2, LogOut, Package, PackagePlus, XCircle } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useAuth } from '../../hooks/useAuth'
import { ConfirmModal } from '../modals/ConfirmModal'
import { Modal } from '../ui/Modal'
import { StockSwitcher } from './StockSwitcher'
import type { NotificationItem, NotificationType } from '../../types'

const NOTIF_ICONS: Record<NotificationType, ComponentType<{ size?: number }>> = {
  bon_soumis: Package,
  bon_approuve: CheckCircle2,
  bon_rejete: XCircle,
  reception: PackagePlus,
  alerte: AlertTriangle,
  alerte_levee: CheckCircle2,
}

const NOTIF_COLORS: Record<NotificationType, string> = {
  bon_soumis: 'bg-blue-50 text-blue-800',
  bon_approuve: 'bg-brand-50 text-brand-800',
  bon_rejete: 'bg-danger-50 text-danger-600',
  reception: 'bg-brand-50 text-brand-800',
  alerte: 'bg-amber-50 text-amber-600',
  alerte_levee: 'bg-brand-50 text-brand-800',
}

const NOTIF_ROUTES: Record<NotificationType, string> = {
  bon_soumis: '/validations',
  bon_approuve: '/historique',
  bon_rejete: '/historique',
  reception: '/historique',
  alerte: '/dashboard',
  alerte_levee: '/dashboard',
}

export function TopBar() {
  const user = useAppStore((s) => s.user)
  const notifications = useAppStore((s) => s.notifications)
  const marquerLu = useAppStore((s) => s.marquerLu)
  const marquerTousLus = useAppStore((s) => s.marquerTousLus)
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const nonLues = notifications.filter((n) => !n.lu).length

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    setLoggingOut(false)
    setConfirmOpen(false)
    navigate('/login', { replace: true })
  }

  const handleNotificationClick = (notification: NotificationItem) => {
    marquerLu(notification.id)
    setNotifOpen(false)
    navigate(NOTIF_ROUTES[notification.type])
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-brand-800 px-4 py-3 text-white">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold">MadinaStock</span>
        <StockSwitcher />
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div className="text-sm font-medium text-white/90">{user.nom}</div>
        )}

        <button
          type="button"
          aria-label="Notifications"
          onClick={() => setNotifOpen(true)}
          className="relative flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Bell size={18} />
          {nonLues > 0 && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger-600" />
          )}
        </button>

        <button
          type="button"
          aria-label="Se déconnecter"
          onClick={() => setConfirmOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut size={18} />
        </button>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Déconnexion"
        message="Voulez-vous vous déconnecter ?"
        confirmLabel="Se déconnecter"
        cancelLabel="Annuler"
        danger
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmOpen(false)}
      />

      <Modal isOpen={notifOpen} onClose={() => setNotifOpen(false)} title="Notifications">
        <div className="flex flex-col gap-2 pb-4">
          {nonLues > 0 && (
            <button
              type="button"
              onClick={marquerTousLus}
              className="self-end text-xs font-medium text-brand-800"
            >
              Tout marquer comme lu
            </button>
          )}

          {notifications.map((notification) => {
            const Icon = NOTIF_ICONS[notification.type]

            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                className={`flex items-start gap-3 rounded-2xl p-3 text-left ${
                  notification.lu ? 'bg-white' : 'bg-brand-50/60'
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${NOTIF_COLORS[notification.type]}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">{notification.titre}</div>
                  <div className="text-xs text-gray-500">{notification.message}</div>
                  <div className="mt-1 text-[11px] text-gray-400">
                    {new Date(notification.created_at).toLocaleString('fr-FR')}
                  </div>
                </div>
                {!notification.lu && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-800" />}
              </button>
            )
          })}

          {notifications.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">Aucune notification</p>
          )}
        </div>
      </Modal>
    </header>
  )
}
