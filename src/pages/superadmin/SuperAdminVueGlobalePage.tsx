import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Entreprise } from '../../types'

interface BonGlobal {
  id: string
  numero: string
  created_at: string
  statut: string
  type: 'sortie' | 'reception'
  entreprise_id: string
  entreprise_nom?: string
  montant?: number
}

interface AlerteGlobale {
  id: string
  type_alerte: string
  produit_nom: string
  depot_nom: string
  entreprise_nom: string
  qte_actuelle: number
  seuil: number
}

interface StatEntreprise {
  id: string
  nom: string
  nbBons: number
}

export function SuperAdminVueGlobalePage() {
  const [tab, setTab] = useState<'activite' | 'stocks' | 'stats'>('activite')
  const [bons, setBons] = useState<BonGlobal[]>([])
  const [alertes, setAlertes] = useState<AlerteGlobale[]>([])
  const [statsEntreprises, setStatsEntreprises] = useState<StatEntreprise[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    loadActivite()

    channelRef.current = supabase
      .channel('superadmin-vue-globale')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bons_sortie' }, () => loadActivite())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bons_reception' }, () => loadActivite())
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  useEffect(() => {
    if (tab === 'stocks') loadAlertes()
    if (tab === 'stats') loadStats()
  }, [tab])

  const loadActivite = async () => {
    setLoading(true)

    const [sorties, receptions, entreprisesRes] = await Promise.all([
      supabase.from('bons_sortie').select('id, numero, created_at, statut, entreprise_id').order('created_at', { ascending: false }).limit(25),
      supabase.from('bons_reception').select('id, numero, created_at, statut, entreprise_id, valeur_totale').order('created_at', { ascending: false }).limit(25),
      supabase.from('entreprises').select('id, nom'),
    ])

    const entreprisesMap = new Map<string, string>()
    ;((entreprisesRes.data ?? []) as Entreprise[]).forEach((e) => entreprisesMap.set(e.id, e.nom))

    const tous: BonGlobal[] = [
      ...((sorties.data ?? []) as BonGlobal[]).map((b) => ({
        ...b,
        type: 'sortie' as const,
        entreprise_nom: entreprisesMap.get(b.entreprise_id ?? '') ?? '—',
      })),
      ...((receptions.data ?? []) as Array<BonGlobal & { valeur_totale?: number }>).map((r) => ({
        ...r,
        type: 'reception' as const,
        montant: r.valeur_totale,
        entreprise_nom: entreprisesMap.get(r.entreprise_id ?? '') ?? '—',
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50)

    setBons(tous)
    setLoading(false)
  }

  const loadAlertes = async () => {
    const { data } = await supabase
      .from('alertes')
      .select('id, type_alerte, created_at, entreprise_id, depot_id, produit_id')
      .in('type_alerte', ['critique', 'rupture'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (!data) return

    const entreprisesRes = await supabase.from('entreprises').select('id, nom')
    const entreprisesMap = new Map<string, string>()
    ;((entreprisesRes.data ?? []) as Entreprise[]).forEach((e) => entreprisesMap.set(e.id, e.nom))

    const formatted: AlerteGlobale[] = (data as Array<{
      id: string; type_alerte: string; entreprise_id: string; depot_id: string; produit_id: string
    }>).map((a) => ({
      id: a.id,
      type_alerte: a.type_alerte,
      produit_nom: a.produit_id,
      depot_nom: a.depot_id,
      entreprise_nom: entreprisesMap.get(a.entreprise_id) ?? '—',
      qte_actuelle: 0,
      seuil: 0,
    }))

    setAlertes(formatted)
  }

  const loadStats = async () => {
    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const [sorties, entreprisesRes] = await Promise.all([
      supabase.from('bons_sortie').select('entreprise_id').gte('created_at', weekAgo.toISOString()),
      supabase.from('entreprises').select('id, nom').neq('statut', 'supprime'),
    ])

    const entreprises = (entreprisesRes.data ?? []) as Entreprise[]
    const countMap: Record<string, number> = {}
    ;(sorties.data ?? []).forEach((b: { entreprise_id: string }) => {
      countMap[b.entreprise_id] = (countMap[b.entreprise_id] ?? 0) + 1
    })

    const result: StatEntreprise[] = entreprises
      .map((e) => ({ id: e.id, nom: e.nom, nbBons: countMap[e.id] ?? 0 }))
      .sort((a, b) => b.nbBons - a.nbBons)

    setStatsEntreprises(result)
  }

  const maxBons = Math.max(...statsEntreprises.map((s) => s.nbBons), 1)

  const STATUT_COLORS: Record<string, string> = {
    en_attente: 'text-amber-600',
    approuve: 'text-green-600',
    valide: 'text-green-600',
    rejete: 'text-red-500',
    expire: 'text-gray-400',
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Vue globale</h1>

      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {([['activite', 'Activité du jour'], ['stocks', 'Stocks critiques'], ['stats', 'Statistiques']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'activite' && (
        loading ? (
          <div className="text-center py-12 text-gray-400">Chargement…</div>
        ) : bons.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">Aucune activité récente</p>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Entreprise', 'Type', 'Numéro', 'Statut', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bons.map((b) => (
                  <tr key={`${b.type}-${b.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{b.entreprise_nom}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.type === 'sortie' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                        {b.type === 'sortie' ? 'Sortie' : 'Réception'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{b.numero}</td>
                    <td className={`px-4 py-3 capitalize ${STATUT_COLORS[b.statut] ?? 'text-gray-600'}`}>{b.statut.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(b.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'stocks' && (
        alertes.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">Aucune alerte critique en cours</p>
        ) : (
          <div className="space-y-3">
            {alertes.map((a) => (
              <div key={a.id} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-red-800">{a.produit_nom}</p>
                  <p className="text-sm text-red-600">{a.entreprise_nom}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.type_alerte === 'rupture' ? 'bg-red-200 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                  {a.type_alerte}
                </span>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'stats' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Bons cette semaine par entreprise</h2>
            {statsEntreprises.length === 0 ? (
              <p className="text-gray-400 text-sm">Aucune donnée</p>
            ) : (
              <div className="space-y-3">
                {statsEntreprises.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="w-36 truncate text-sm text-gray-700">{s.nom}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-600 rounded-full transition-all"
                        style={{ width: `${(s.nbBons / maxBons) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-semibold text-gray-700">{s.nbBons}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Entreprise</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Bons (7j)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statsEntreprises.slice(0, 5).map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-gray-900">{s.nom}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">{s.nbBons}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
