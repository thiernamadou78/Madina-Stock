import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, Users, Warehouse } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { computeStatutStock } from '../hooks/useStock'
import { Button } from '../components/ui/Button'
import type { StockProduit } from '../types'

interface DepotStats {
  nbArticles: number
  statut: 'ok' | 'alerte' | 'critique'
  alertesActives: number
  autreUtilisateur: boolean
}

const STATUT_LABELS: Record<DepotStats['statut'], string> = {
  ok: 'OK',
  alerte: 'Alerte',
  critique: 'Critique',
}

const STATUT_CLASSES: Record<DepotStats['statut'], string> = {
  ok: 'bg-brand-50 text-brand-800',
  alerte: 'bg-amber-50 text-amber-600',
  critique: 'bg-danger-50 text-danger-600',
}

export function SelectDepotPage() {
  const { depots, ouvrirSession, user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Record<string, DepotStats>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (depots.length === 0 || !user) return

    let cancelled = false

    Promise.all(
      depots.map(async (depot) => {
        const [stockRes, sessionsRes] = await Promise.all([
          supabase
            .from('stock_produits')
            .select('qte_disponible, seuil_alerte, seuil_critique')
            .eq('depot_id', depot.id),
          supabase
            .from('sessions_gestionnaire')
            .select('id', { count: 'exact', head: true })
            .eq('depot_id', depot.id)
            .neq('user_id', user.id)
            .is('ferme_le', null),
        ])

        const rows = (stockRes.data ?? []) as Pick<
          StockProduit,
          'qte_disponible' | 'seuil_alerte' | 'seuil_critique'
        >[]

        const niveaux = rows.map((r) => computeStatutStock(r))
        const alertesActives = niveaux.filter((n) => n !== 'ok').length

        let statut: DepotStats['statut'] = 'ok'
        if (niveaux.some((n) => n === 'rupture' || n === 'critique')) statut = 'critique'
        else if (niveaux.some((n) => n === 'alerte')) statut = 'alerte'

        return [
          depot.id,
          {
            nbArticles: rows.length,
            statut,
            alertesActives,
            autreUtilisateur: (sessionsRes.count ?? 0) > 0,
          },
        ] as const
      })
    ).then((entries) => {
      if (!cancelled) setStats(Object.fromEntries(entries))
    })

    return () => {
      cancelled = true
    }
  }, [depots, user])

  const handleOuvrir = async () => {
    if (!selectedId) return
    setLoading(true)
    await ouvrirSession(selectedId)
    setLoading(false)
    navigate('/')
  }

  const selectedDepot = depots.find((d) => d.id === selectedId)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center gap-3 bg-brand-800 px-4 py-4 text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
          {user?.nom?.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="font-semibold">{user?.nom}</div>
          <div className="text-xs capitalize text-white/70">{user?.role}</div>
        </div>
      </header>

      <div className="px-4 py-6">
        <h1 className="text-lg font-bold text-gray-900">Sur quel stock travailles-tu aujourd'hui ?</h1>

        <div className="mt-4 flex flex-col gap-3">
          {depots.map((depot) => {
            const depotStats = stats[depot.id]
            const isSelected = selectedId === depot.id

            return (
              <button
                key={depot.id}
                type="button"
                onClick={() => setSelectedId(depot.id)}
                className={`flex items-center gap-3 rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition-colors ${
                  isSelected ? 'border-brand-400' : 'border-transparent'
                }`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-800">
                  <Warehouse size={22} />
                </div>

                <div className="flex-1">
                  <div className="font-medium text-gray-900">{depot.nom}</div>
                  <div className="text-xs text-gray-500">
                    {depotStats ? `${depotStats.nbArticles} article${depotStats.nbArticles > 1 ? 's' : ''}` : '...'}
                  </div>

                  <div className="mt-1.5 flex items-center gap-2">
                    {depotStats && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_CLASSES[depotStats.statut]}`}>
                        {STATUT_LABELS[depotStats.statut]}
                      </span>
                    )}
                    {depotStats && depotStats.alertesActives > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                        <AlertTriangle size={12} />
                        {depotStats.alertesActives} alerte{depotStats.alertesActives > 1 ? 's' : ''}
                      </span>
                    )}
                    {depotStats?.autreUtilisateur && (
                      <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                        <Users size={12} />
                        Occupé
                      </span>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-800 text-white">
                    <Check size={14} />
                  </div>
                )}
              </button>
            )
          })}

          {depots.length === 0 && (
            <p className="text-center text-sm text-gray-500">Aucun dépôt assigné</p>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">Tu peux changer de stock à tout moment</p>

        <Button fullWidth className="mt-4" disabled={!selectedId || loading} onClick={handleOuvrir}>
          {loading ? 'Ouverture...' : selectedDepot ? `Ouvrir ${selectedDepot.nom}` : 'Sélectionner un dépôt'}
        </Button>
      </div>
    </div>
  )
}
