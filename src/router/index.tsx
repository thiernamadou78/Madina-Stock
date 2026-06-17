import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../stores/appStore'
import { useBonsEnAttenteWatcher } from '../hooks/useBonsEnAttenteWatcher'
import { useNotificationActionListener } from '../hooks/useNotificationActionListener'
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
import { ProduitsPage } from '../pages/ProduitsPage'
import { SettingsPage } from '../pages/SettingsPage'
import { UsersPage } from '../pages/UsersPage'
import { SuperAdminLoginPage } from '../pages/SuperAdminLoginPage'
import { SuperAdminLayout } from '../pages/superadmin/SuperAdminLayout'
import { SuperAdminEntreprisesPage } from '../pages/superadmin/SuperAdminEntreprisesPage'
import { SuperAdminVueGlobalePage } from '../pages/superadmin/SuperAdminVueGlobalePage'
import { SuperAdminEntrepriseDetailPage } from '../pages/superadmin/SuperAdminEntrepriseDetailPage'
import type { Role } from '../types'

function AppLayout() {
  useBonsEnAttenteWatcher()
  useNotificationActionListener()

  return (
    <div className="min-h-[100dvh] bg-gray-50">
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
  const role = useAppStore((s) => s.user?.role)

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (role === 'superadmin') return <Navigate to="/superadmin" replace />
  if (!depotActifId) return <Navigate to="/select-depot" replace />

  return <AppLayout />
}

function SuperAdminRoute() {
  const { isAuthenticated } = useAuth()
  const role = useAppStore((s) => s.user?.role)

  if (!isAuthenticated || role !== 'superadmin') return <Navigate to="/superadmin-login" replace />

  return <SuperAdminLayout />
}

function RoleRoute({ roles }: { roles: Role[] }) {
  const role = useAppStore((s) => s.user?.role)

  if (!role || !roles.includes(role)) return <Navigate to="/" replace />

  return <Outlet />
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()
  const role = useAppStore((s) => s.user?.role)

  const loginRedirect = isAuthenticated
    ? (role === 'superadmin' ? <Navigate to="/superadmin" replace /> : <Navigate to="/select-depot" replace />)
    : <LoginPage />

  return (
    <Routes>
      <Route path="/onboarding" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={loginRedirect} />
      <Route
        path="/select-depot"
        element={
          !isAuthenticated ? <Navigate to="/login" replace />
            : role === 'superadmin' ? <Navigate to="/superadmin" replace />
            : <SelectDepotPage />
        }
      />

      {/* SuperAdmin */}
      <Route
        path="/superadmin-login"
        element={
          isAuthenticated && role === 'superadmin'
            ? <Navigate to="/superadmin" replace />
            : <SuperAdminLoginPage />
        }
      />
      <Route path="/superadmin" element={<SuperAdminRoute />}>
        <Route index element={<Navigate to="entreprises" replace />} />
        <Route path="entreprises" element={<SuperAdminEntreprisesPage />} />
        <Route path="entreprises/:id" element={<SuperAdminEntrepriseDetailPage />} />
        <Route path="vue-globale" element={<SuperAdminVueGlobalePage />} />
      </Route>

      {/* App normale */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/sortie" element={<NouvelleSortiePage />} />
        <Route path="/reception" element={<ReceptionPage />} />
        <Route path="/historique" element={<HistoriquePage />} />
        <Route path="/produits" element={<ProduitsPage />} />
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
      <div className="flex min-h-[100dvh] items-center justify-center bg-brand-800">
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
