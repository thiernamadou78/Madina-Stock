import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../stores/appStore'
import { supabase } from '../lib/supabase'
import { TopBar } from '../components/layout/TopBar'
import { BottomNav } from '../components/ui/BottomNav'
import { LoginPage } from '../pages/LoginPage'
import { OnboardingPage } from '../pages/OnboardingPage'
import { SelectDepotPage } from '../pages/SelectDepotPage'
import { HomePage } from '../pages/HomePage'
import { NouvelleSortiePage } from '../pages/NouvellesortiePage'
import { ReceptionPage } from '../pages/ReceptionPage'
import { HistoriquePage } from '../pages/HistoriquePage'
import { ValidationsPage } from '../pages/ValidationsPage'
import { DashboardPage } from '../pages/DashboardPage'
import { SettingsPage } from '../pages/SettingsPage'
import { UsersPage } from '../pages/UsersPage'
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

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route path="/onboarding" element={<Navigate to="/login" replace />} />
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

        <Route element={<RoleRoute roles={['proprietaire']} />}>
          <Route path="/users" element={<UsersPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function AppRouter() {
  const [utilisateursExistent, setUtilisateursExistent] = useState<boolean | null>(null)

  useEffect(() => {
    supabase
      .from('utilisateurs')
      .select('*', { count: 'exact', head: true })
      .then(({ count, error }) => {
        setUtilisateursExistent(error ? true : (count ?? 0) > 0)
      })
  }, [])

  if (utilisateursExistent === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-800">
        <Loader2 size={32} className="animate-spin text-white" />
      </div>
    )
  }

  if (!utilisateursExistent) {
    return (
      <Routes>
        <Route
          path="/onboarding"
          element={<OnboardingPage onComplete={() => setUtilisateursExistent(true)} />}
        />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    )
  }

  return <AppRoutes />
}
