import { NavLink, Outlet } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { Building2, Globe, LogOut, Shield, User } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const NAV_ITEMS = [
  { to: '/superadmin/entreprises', label: 'Entreprises', icon: Building2 },
  { to: '/superadmin/vue-globale', label: 'Vue globale', icon: Globe },
]

export function SuperAdminLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/superadmin-login', { replace: true })
  }

  return (
    <div className="flex min-h-[100dvh]">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-slate-900">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">MadinaStock</p>
            <p className="text-xs text-slate-400">Admin</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-700 px-3 py-4 space-y-1">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700">
              <User size={14} className="text-slate-300" />
            </div>
            <span className="text-sm text-slate-300">SuperAdmin</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  )
}
