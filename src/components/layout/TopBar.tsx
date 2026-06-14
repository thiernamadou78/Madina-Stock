import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useAuth } from '../../hooks/useAuth'
import { ConfirmModal } from '../modals/ConfirmModal'
import { StockSwitcher } from './StockSwitcher'

export function TopBar() {
  const user = useAppStore((s) => s.user)
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    setLoggingOut(false)
    setConfirmOpen(false)
    navigate('/login', { replace: true })
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
    </header>
  )
}
