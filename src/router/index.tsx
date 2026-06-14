import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../stores/appStore'
import { TopBar } from '../components/layout/TopBar'
import { BottomNav } from '../components/ui/BottomNav'
import { LoginPage } from '../pages/LoginPage'
import { SelectDepotPage } from '../pages/SelectDepotPage'
import { HomePage } from '../pages/HomePage'
import { NouvelleSortiePage } from '../pages/NouvellesortiePage'
import { ReceptionPage } from '../pages/ReceptionPage'
import { HistoriquePage } from '../pages/HistoriquePage'
import { ValidationsPage } from '../pages/ValidationsPage'
import { DashboardPage } from '../pages/DashboardPage'
import { SettingsPage } from '../pages/SettingsPage'
import type { Role } from '../types'

function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />
      <main className="px-4 py-4 pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

function ProtectedRoute() {
  const { isAuthenticated, depotActifId } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!depotActifId) return <Navigate to="/select-depot" replace />

  return <AppLayout />
}

function RoleRoute({ roles }: { roles: Role[] }) {
  const role = useAppStore((s) => s.user?.role)

  if (!role || !roles.includes(role)) return <Navigate to="/" replace />

  return <Outlet />
}

export function AppRouter() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/select-depot" replace /> : <LoginPage />}
      />
      <Route
        path="/select-depot"
        element={isAuthenticated ? <SelectDepotPage /> : <Navigate to="/login" replace />}
      />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/sortie" element={<NouvelleSortiePage />} />
        <Route path="/reception" element={<ReceptionPage />} />
        <Route path="/historique" element={<HistoriquePage />} />
        <Route path="/parametres" element={<SettingsPage />} />

        <Route element={<RoleRoute roles={['responsable', 'proprietaire']} />}>
          <Route path="/validations" element={<ValidationsPage />} />
        </Route>

        <Route element={<RoleRoute roles={['admin', 'proprietaire']} />}>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
