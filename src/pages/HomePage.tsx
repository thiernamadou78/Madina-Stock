import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  ClipboardCheck,
  History,
  LayoutDashboard,
  PackageMinus,
  PackagePlus,
  Users,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import { useStock } from '../hooks/useStock'
import { useExpiration } from '../hooks/useExpiration'
import { AlertStrip } from '../components/ui/AlertStrip'
import { Button } from '../components/ui/Button'

const DOT_COLORS: Record<string, string> = {
  ok: 'bg-brand-400',
  alerte: 'bg-amber-400',
  critique: 'bg-danger-400',
  rupture: 'bg-danger-600',
}

export function HomePage() {
  const depotActifId = useAppStore((s) => s.depotActifId)
  const role = useAppStore((s) => s.user?.role)
  const isProprietaire = role === 'proprietaire'
  const { stock, alertes, loading, refresh: refreshStock } = useStock()
  const [bonsJour, setBonsJour] = useState(0)
  const [bonsEnAttente, setBonsEnAttente] = useState(0)

  useExpiration(refreshStock)

  useEffect(() => {
    if (!depotActifId) return

    const debut = new Date()
    debut.setHours(0, 0, 0, 0)

    Promise.all([
      supabase
        .from('bons_sortie')
        .select('id', { count: 'exact', head: true })
        .eq('depot_id', depotActifId)
        .gte('created_at', debut.toISOString()),
      supabase
        .from('bons_reception')
        .select('id', { count: 'exact', head: true })
        .eq('depot_id', depotActifId)
        .gte('created_at', debut.toISOString()),
    ]).then(([sortieRes, receptionRes]) => {
      setBonsJour((sortieRes.count ?? 0) + (receptionRes.count ?? 0))
    })
  }, [depotActifId])

  useEffect(() => {
    if (!isProprietaire) return

    supabase
      .from('bons_sortie')
      .select('id', { count: 'exact', head: true })
      .eq('statut', 'en_attente')
      .then(({ count }) => setBonsEnAttente(count ?? 0))
  }, [isProprietaire])

  const kpis = [
    { label: 'Articles', value: stock.length, color: 'bg-brand-50 text-brand-800' },
    { label: 'Bons du jour', value: bonsJour, color: 'bg-blue-50 text-blue-800' },
    { label: 'Alertes', value: alertes.length, color: 'bg-amber-50 text-amber-600' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <AlertStrip alertes={alertes} />

      <div className="grid grid-cols-3 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl p-4 ${kpi.color}`}>
            <div className="text-2xl font-bold">{kpi.value}</div>
            <div className="text-xs font-medium">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/sortie">
          <Button fullWidth icon={<PackageMinus size={18} />}>
            Nouvelle sortie
          </Button>
        </Link>
        <Link to="/reception">
          <Button fullWidth variant="secondary" icon={<PackagePlus size={18} />}>
            Réception
          </Button>
        </Link>
        <Link to="/historique">
          <Button fullWidth variant="secondary" icon={<History size={18} />}>
            Historique
          </Button>
        </Link>
        <Link to="/select-depot">
          <Button fullWidth variant="ghost" icon={<ArrowLeftRight size={18} />}>
            Changer stock
          </Button>
        </Link>
      </div>

      {isProprietaire && (
        <div className="flex flex-col gap-3">
          <Link
            to="/validations"
            className="flex items-center justify-between rounded-2xl bg-amber-50 p-4 text-amber-700"
          >
            <div>
              <div className="text-2xl font-bold">{bonsEnAttente}</div>
              <div className="text-xs font-medium">Bons en attente (tous dépôts)</div>
            </div>
            <ClipboardCheck size={24} />
          </Link>

          <div className="grid grid-cols-3 gap-3">
            <Link to="/validations">
              <Button fullWidth variant="secondary" size="sm" icon={<ClipboardCheck size={16} />}>
                Validations
              </Button>
            </Link>
            <Link to="/users">
              <Button fullWidth variant="secondary" size="sm" icon={<Users size={16} />}>
                Utilisateurs
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button fullWidth variant="secondary" size="sm" icon={<LayoutDashboard size={16} />}>
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Stock du dépôt</h2>

        {loading && <p className="text-sm text-gray-400">Chargement...</p>}

        <div className="flex flex-col gap-2">
          {stock.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 py-1">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${DOT_COLORS[s.statut_stock]}`} />
                <span className="text-sm text-gray-700">{s.produit?.nom}</span>
              </div>
              <span className="text-sm font-medium text-gray-500">
                {s.qte_disponible} {s.produit?.unite}
              </span>
            </div>
          ))}

          {!loading && stock.length === 0 && (
            <p className="text-sm text-gray-400">Aucun produit en stock</p>
          )}
        </div>
      </div>
    </div>
  )
}
