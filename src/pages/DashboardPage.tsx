import { useEffect, useState } from 'react'
import { PackageMinus, PackagePlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import { enrichirStock } from '../hooks/useStock'
import { Badge, statutToColor } from '../components/ui/Badge'
import { StockBar } from '../components/ui/StockBar'
import type { BonReception, BonSortie, StockProduit } from '../types'

const BON_SORTIE_SELECT = `
  *,
  lignes:lignes_bon_sortie(*, produit:produits(*)),
  gestionnaire:utilisateurs!bons_sortie_gestionnaire_id_fkey(*),
  depot:depots!bons_sortie_depot_id_fkey(*),
  depot_destination:depots!bons_sortie_depot_destination_id_fkey(*)
`

const BON_RECEPTION_SELECT = `
  *,
  lignes:lignes_reception(*, produit:produits(*)),
  depot:depots(*),
  saisisseur:utilisateurs!bons_reception_saisi_par_fkey(*)
`

type Tab = 'general' | 'bons' | 'alertes' | 'stocks'

const TABS: { value: Tab; label: string }[] = [
  { value: 'general', label: 'Vue générale' },
  { value: 'bons', label: 'Bons' },
  { value: 'alertes', label: 'Alertes' },
  { value: 'stocks', label: 'Stocks' },
]

const ALERTE_COLORS: Record<StockProduit['statut_stock'], 'brand' | 'amber' | 'danger'> = {
  ok: 'brand',
  alerte: 'amber',
  critique: 'danger',
  rupture: 'danger',
}

const SEVERITE: Record<StockProduit['statut_stock'], number> = {
  rupture: 0,
  critique: 1,
  alerte: 2,
  ok: 3,
}

export function DashboardPage() {
  const depots = useAppStore((s) => s.depots)
  const [tab, setTab] = useState<Tab>('general')
  const [loading, setLoading] = useState(true)
  const [stock, setStock] = useState<StockProduit[]>([])
  const [bonsSortie, setBonsSortie] = useState<BonSortie[]>([])
  const [bonsReception, setBonsReception] = useState<BonReception[]>([])
  const [produitsCount, setProduitsCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [stockRes, sortieRes, receptionRes, produitsRes] = await Promise.all([
        supabase.from('stock_produits').select('*, produit:produits(*)'),
        supabase.from('bons_sortie').select(BON_SORTIE_SELECT).order('created_at', { ascending: false }).limit(30),
        supabase
          .from('bons_reception')
          .select(BON_RECEPTION_SELECT)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('produits').select('id', { count: 'exact', head: true }).eq('actif', true),
      ])

      if (cancelled) return

      setStock(((stockRes.data ?? []) as unknown as StockProduit[]).map(enrichirStock))
      setBonsSortie((sortieRes.data ?? []) as unknown as BonSortie[])
      setBonsReception((receptionRes.data ?? []) as unknown as BonReception[])
      setProduitsCount(produitsRes.count ?? 0)
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <p className="text-sm text-gray-400">Chargement...</p>

  const alertes = stock.filter((s) => s.statut_stock !== 'ok').sort((a, b) => SEVERITE[a.statut_stock] - SEVERITE[b.statut_stock])
  const valeurStock = stock.reduce((total, s) => total + s.qte_disponible * (s.prix_achat_dernier ?? 0), 0)

  const activite = [
    ...bonsSortie.map((bon) => ({ type: 'sortie' as const, bon })),
    ...bonsReception.map((bon) => ({ type: 'reception' as const, bon })),
  ]
    .sort((a, b) => new Date(b.bon.created_at).getTime() - new Date(a.bon.created_at).getTime())
    .slice(0, 20)

  const depotNom = (depotId: string) => depots.find((d) => d.id === depotId)?.nom ?? '-'

  const cards = [
    { label: 'Dépôts actifs', value: depots.length, color: 'bg-brand-50 text-brand-800' },
    { label: 'Produits référencés', value: produitsCount, color: 'bg-blue-50 text-blue-800' },
    { label: 'Alertes de stock', value: alertes.length, color: 'bg-amber-50 text-amber-600' },
    {
      label: 'Sorties en attente',
      value: bonsSortie.filter((b) => b.statut === 'en_attente').length,
      color: 'bg-danger-50 text-danger-600',
    },
    {
      label: 'Réceptions en attente',
      value: bonsReception.filter((r) => r.statut === 'en_attente').length,
      color: 'bg-danger-50 text-danger-600',
    },
    { label: 'Valeur du stock', value: `${valeurStock.toLocaleString('fr-FR')} GNF`, color: 'bg-gray-100 text-gray-700' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-gray-900">Tableau de bord</h1>

      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium ${
              tab === t.value ? 'bg-brand-800 text-white' : 'bg-white text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="grid grid-cols-2 gap-3">
          {cards.map((card) => (
            <div key={card.label} className={`rounded-2xl p-4 ${card.color}`}>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-xs font-medium">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'bons' && (
        <div className="flex flex-col gap-2">
          {activite.map((item) => (
            <div key={`${item.type}-${item.bon.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  item.type === 'sortie' ? 'bg-danger-50 text-danger-600' : 'bg-brand-50 text-brand-800'
                }`}
              >
                {item.type === 'sortie' ? <PackageMinus size={18} /> : <PackagePlus size={18} />}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.bon.numero}</div>
                <div className="text-xs text-gray-500">
                  {depotNom(item.bon.depot_id)} ·{' '}
                  {item.type === 'sortie' ? item.bon.motif : (item.bon as BonReception).fournisseur} ·{' '}
                  {new Date(item.bon.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <Badge color={statutToColor(item.bon.statut)}>{item.bon.statut}</Badge>
            </div>
          ))}

          {activite.length === 0 && <p className="text-sm text-gray-400">Aucune activité récente</p>}
        </div>
      )}

      {tab === 'alertes' && (
        <div className="flex flex-col gap-2">
          {alertes.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
              <div>
                <div className="font-medium text-gray-900">{s.produit?.nom}</div>
                <div className="text-xs text-gray-500">
                  {depotNom(s.depot_id)} · {s.qte_disponible} {s.produit?.unite} disponible{s.qte_disponible > 1 ? 's' : ''}
                </div>
              </div>
              <Badge color={ALERTE_COLORS[s.statut_stock]}>{s.statut_stock}</Badge>
            </div>
          ))}

          {alertes.length === 0 && <p className="text-sm text-gray-400">Aucune alerte de stock</p>}
        </div>
      )}

      {tab === 'stocks' && (
        <div className="flex flex-col gap-4">
          {depots.map((depot) => {
            const stockDepot = stock.filter((s) => s.depot_id === depot.id)

            return (
              <div key={depot.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-gray-700">{depot.nom}</h2>
                <div className="flex flex-col gap-3">
                  {stockDepot.map((s) => (
                    <StockBar key={s.id} stock={s} />
                  ))}
                  {stockDepot.length === 0 && <p className="text-sm text-gray-400">Aucun produit en stock</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
