import { useState } from 'react'
import type { ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, CheckCircle2, LogOut, Package, PackagePlus, XCircle } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useAuth } from '../../hooks/useAuth'
import { approuverBon, rejeterBon } from '../../lib/bons'
import { validerReception, rejeterReception } from '../../lib/receptions'
import { ConfirmModal } from '../modals/ConfirmModal'
import { Modal } from '../ui/Modal'
import { StockSwitcher } from './StockSwitcher'
import type { BonReception, BonSortie, NotificationItem, NotificationType } from '../../types'

const NOTIF_ICONS: Record<NotificationType, ComponentType<{ size?: number }>> = {
  bon_soumis: Package,
  bon_approuve: CheckCircle2,
  bon_rejete: XCircle,
  reception_soumise: PackagePlus,
  reception: PackagePlus,
  alerte: AlertTriangle,
  alerte_levee: CheckCircle2,
}

const NOTIF_COLORS: Record<NotificationType, string> = {
  bon_soumis: 'bg-blue-50 text-blue-800',
  bon_approuve: 'bg-brand-50 text-brand-800',
  bon_rejete: 'bg-danger-50 text-danger-600',
  reception_soumise: 'bg-blue-50 text-blue-800',
  reception: 'bg-brand-50 text-brand-800',
  alerte: 'bg-amber-50 text-amber-600',
  alerte_levee: 'bg-brand-50 text-brand-800',
}

const NOTIF_ROUTES: Record<NotificationType, string> = {
  bon_soumis: '/validations',
  bon_approuve: '/historique',
  bon_rejete: '/historique',
  reception_soumise: '/validations',
  reception: '/historique',
  alerte: '/dashboard',
  alerte_levee: '/dashboard',
}

/**
 * Carte de notification "bon de sortie à valider" : affiche tous les
 * détails (dépôt, demandeur, lignes) et permet de Valider/Rejeter
 * directement, sans naviguer vers la page Validations.
 */
function BonSoumisCard({
  notification,
  userId,
  onDone,
}: {
  notification: NotificationItem
  userId: string
  onDone: (id: string) => void
}) {
  const bon = notification.bonSortie as BonSortie
  const [loading, setLoading] = useState<'valider' | 'rejeter' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handle = async (action: 'valider' | 'rejeter') => {
    setLoading(action)
    setError(null)

    const result = action === 'valider'
      ? await approuverBon(bon.id, userId)
      : await rejeterBon(bon.id, userId)

    setLoading(null)
    if (!result.success) {
      setError(result.error ?? 'Erreur')
      return
    }
    onDone(notification.id)
  }

  return (
    <div className={`rounded-2xl p-3 ${notification.lu ? 'bg-white' : 'bg-brand-50/60'}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
          <Package size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900">
            Bon {bon.numero} — {bon.motif}
          </div>
          <div className="text-xs text-gray-500">
            {bon.depot?.nom} • demandé par {bon.gestionnaire?.nom ?? 'Gestionnaire'}
          </div>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
            {bon.lignes.map((ligne) => (
              <li key={ligne.id}>
                • {ligne.qte_demandee} {ligne.produit?.unite}(s) — {ligne.produit?.nom}
              </li>
            ))}
          </ul>
          <div className="mt-1 text-[11px] text-gray-400">
            {new Date(notification.created_at).toLocaleString('fr-FR')}
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-xs font-medium text-danger-600">{error}</p>}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => handle('valider')}
          className="flex-1 rounded-xl bg-brand-800 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {loading === 'valider' ? 'Validation…' : 'Valider'}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => handle('rejeter')}
          className="flex-1 rounded-xl bg-danger-600 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {loading === 'rejeter' ? 'Rejet…' : 'Rejeter'}
        </button>
      </div>
    </div>
  )
}

/**
 * Carte de notification "réception à valider" : affiche tous les détails
 * (dépôt, fournisseur, lignes, valeur) et permet de Valider/Rejeter
 * directement, sans naviguer vers la page Validations.
 */
function ReceptionSoumiseCard({
  notification,
  userId,
  onDone,
}: {
  notification: NotificationItem
  userId: string
  onDone: (id: string) => void
}) {
  const reception = notification.bonReception as BonReception
  const [loading, setLoading] = useState<'valider' | 'rejeter' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handle = async (action: 'valider' | 'rejeter') => {
    setLoading(action)
    setError(null)

    const result = action === 'valider'
      ? await validerReception(reception, userId)
      : await rejeterReception(reception, userId)

    setLoading(null)
    if (result.error) {
      setError(result.error)
      return
    }
    onDone(notification.id)
  }

  return (
    <div className={`rounded-2xl p-3 ${notification.lu ? 'bg-white' : 'bg-brand-50/60'}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
          <PackagePlus size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900">
            Réception {reception.numero} — {reception.fournisseur}
          </div>
          <div className="text-xs text-gray-500">
            {reception.depot?.nom} • saisie par {reception.saisisseur?.nom ?? 'Gestionnaire'}
          </div>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
            {reception.lignes.map((ligne) => (
              <li key={ligne.id}>
                • {ligne.qte_recue} {ligne.produit?.unite}(s) — {ligne.produit?.nom}
                {ligne.prix_achat_unitaire ? ` à ${ligne.prix_achat_unitaire.toLocaleString('fr-GN')} GNF` : ''}
              </li>
            ))}
          </ul>
          {reception.valeur_totale !== undefined && (
            <div className="mt-1 text-xs font-medium text-gray-700">
              Valeur totale : {reception.valeur_totale.toLocaleString('fr-GN')} GNF
            </div>
          )}
          <div className="mt-1 text-[11px] text-gray-400">
            {new Date(notification.created_at).toLocaleString('fr-FR')}
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-xs font-medium text-danger-600">{error}</p>}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => handle('valider')}
          className="flex-1 rounded-xl bg-brand-800 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {loading === 'valider' ? 'Validation…' : 'Valider'}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => handle('rejeter')}
          className="flex-1 rounded-xl bg-danger-600 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {loading === 'rejeter' ? 'Rejet…' : 'Rejeter'}
        </button>
      </div>
    </div>
  )
}

export function TopBar() {
  const user = useAppStore((s) => s.user)
  const notifications = useAppStore((s) => s.notifications)
  const marquerLu = useAppStore((s) => s.marquerLu)
  const marquerTousLus = useAppStore((s) => s.marquerTousLus)
  const removeNotification = useAppStore((s) => s.removeNotification)
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const nonLues = notifications.filter((n) => !n.lu).length
  const canValidate = user?.role === 'proprietaire' || user?.role === 'responsable'

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
            if (notification.type === 'bon_soumis' && notification.bonSortie && canValidate && user) {
              return (
                <BonSoumisCard
                  key={notification.id}
                  notification={notification}
                  userId={user.id}
                  onDone={removeNotification}
                />
              )
            }

            if (notification.type === 'reception_soumise' && notification.bonReception && canValidate && user) {
              return (
                <ReceptionSoumiseCard
                  key={notification.id}
                  notification={notification}
                  userId={user.id}
                  onDone={removeNotification}
                />
              )
            }

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
