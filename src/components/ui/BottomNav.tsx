import type { ComponentType } from 'react'
import { Home, PackageMinus, PackagePlus, History, Settings, ClipboardCheck, LayoutDashboard } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import { useBons } from '../../hooks/useBons'
import { useReceptions } from '../../hooks/useReceptions'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ size?: number }>
  end: boolean
  badge?: number
}

const BASE_ITEMS: NavItem[] = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/sortie', label: 'Sortie', icon: PackageMinus, end: false },
  { to: '/reception', label: 'Réception', icon: PackagePlus, end: false },
  { to: '/historique', label: 'Historique', icon: History, end: false },
]

const SETTINGS_ITEM: NavItem = { to: '/parametres', label: 'Réglages', icon: Settings, end: false }

export function BottomNav() {
  const role = useAppStore((s) => s.user?.role)
  const { enAttente: enAttenteSortie } = useBons()
  const { enAttente: enAttenteReception } = useReceptions()

  const canValider = role === 'responsable' || role === 'proprietaire'
  const canDashboard = role === 'admin' || role === 'proprietaire'
  const totalEnAttente = enAttenteSortie + enAttenteReception

  const items: NavItem[] = [
    ...BASE_ITEMS,
    ...(canValider
      ? [{ to: '/validations', label: 'Validations', icon: ClipboardCheck, end: false, badge: totalEnAttente }]
      : []),
    ...(canDashboard ? [{ to: '/dashboard', label: 'Stats', icon: LayoutDashboard, end: false }] : []),
    SETTINGS_ITEM,
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-gray-100 bg-white pb-[env(safe-area-inset-bottom)]">
      {items.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${
              isActive ? 'text-brand-800' : 'text-gray-400'
            }`
          }
        >
          <span className="relative">
            <Icon size={20} />
            {!!badge && badge > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-semibold text-white">
                {badge}
              </span>
            )}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
