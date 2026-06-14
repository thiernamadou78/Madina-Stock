import { useEffect, useState } from 'react'
import { ChevronDown, PackageMinus, PackagePlus, Warehouse } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import { computeStatutStock } from '../hooks/useStock'
import { Badge, statutToColor } from '../components/ui/Badge'
import { StockBar } from '../components/ui/StockBar'
import type { BonReception, MotifSortie, StatutBon, StockProduit, TypeAlerte } from '../types'

const STOCK_GLOBAL_SELECT = `
  id, depot_id, produit_id,
  qte_disponible, qte_reservee,
  seuil_alerte, seuil_critique,
  produit:produits(id, nom, unite, categorie),
  depot:depots(id, nom, type)
`

const BON_SORTIE_GLOBAL_SELECT = `
  id, numero, gestionnaire_id, depot_id,
  motif, statut, created_at,
  depot:depots(id, nom)
`

const BON_RECEPTION_GLOBAL_SELECT = `
  id, numero, saisi_par, depot_id,
  fournisseur, statut, valeur_totale, created_at,
  depot:depots(id, nom)
`

const ALERTES_SELECT = `
  id, type, envoyee_le, acquittee,
  stock_produit:stock_produits(
    depot_id, produit_id, qte_disponible,
    seuil_alerte, seuil_critique,
    produit:produits(id, nom, unite),
    depot:depots(id, nom)
  )
`

const MOUVEMENT_SORTIE_SELECT = `
  id, depot_id, valide_le, created_at,
  depot:depots(id, nom),
  lignes:lignes_bon_sortie(produit_id, qte_demandee, qte_accordee, produit:produits(nom, unite))
`

const MOUVEMENT_RECEPTION_SELECT = `
  id, depot_id, valide_le, created_at,
  depot:depots(id, nom),
  lignes:lignes_reception(produit_id, qte_recue, produit:produits(nom, unite))
`

interface StockGlobal {
  id: string
  depot_id: string
  produit_id: string
  qte_disponible: number
  qte_reservee: number
  qte_nette: number
  seuil_alerte: number
  seuil_critique: number
  produit: { id: string; nom: string; unite: string; categorie: string }
  depot: { id: string; nom: string; type: string }
  statut_stock: 'ok' | 'alerte' | 'critique' | 'rupture'
}

type StockGlobalRaw = Omit<StockGlobal, 'qte_nette' | 'statut_stock'>

interface BonSortieGlobal {
  id: string
  numero: string
  gestionnaire_id: string
  depot_id: string
  motif: MotifSortie
  statut: StatutBon
  created_at: string
  depot: { id: string; nom: string }
}

interface BonReceptionGlobal {
  id: string
  numero: string
  saisi_par: string
  depot_id: string
  fournisseur: string
  statut: BonReception['statut']
  valeur_totale?: number
  created_at: string
  depot: { id: string; nom: string }
}

interface AlerteGlobale {
  id: string
  type: TypeAlerte
  envoyee_le: string
  acquittee: boolean
  stock_produit: {
    depot_id: string
    produit_id: string
    qte_disponible: number
    seuil_alerte: number
    seuil_critique: number
    produit: { id: string; nom: string; unite: string }
    depot: { id: string; nom: string }
  } | null
}

interface Mouvement {
  id: string
  type: 'sortie' | 'reception'
  depotNom: string
  produitNom: string
  unite: string
  quantite: number
  date: string
}

interface MouvementSortieRow {
  id: string
  depot_id: string
  valide_le?: string
  created_at: string
  depot: { id: string; nom: string } | null
  lignes: { produit_id: string; qte_demandee: number; qte_accordee?: number; produit: { nom: string; unite: string } | null }[]
}

interface MouvementReceptionRow {
  id: string
  depot_id: string
  valide_le?: string
  created_at: string
  depot: { id: string; nom: string } | null
  lignes: { produit_id: string; qte_recue: number; produit: { nom: string; unite: string } | null }[]
}

type BonJourItem =
  | { type: 'sortie'; bon: BonSortieGlobal }
  | { type: 'reception'; bon: BonReceptionGlobal }

type Tab = 'general' | 'stocks' | 'bons-jour' | 'mouvements'

const TABS: { value: Tab; label: string }[] = [
  { value: 'general', label: 'Vue générale' },
  { value: 'stocks', label: 'Stocks par dépôt' },
  { value: 'bons-jour', label: 'Bons du jour' },
  { value: 'mouvements', label: 'Mouvements récents' },
]

const SEVERITE: Record<TypeAlerte, number> = { rupture: 0, critique: 1, alerte: 2, levee: 3 }

const ALERTE_COLORS: Record<TypeAlerte, 'brand' | 'blue' | 'amber' | 'danger' | 'gray'> = {
  rupture: 'danger',
  critique: 'danger',
  alerte: 'amber',
  levee: 'brand',
}

const STATUT_OPTIONS = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'approuve', label: 'Approuvé' },
  { value: 'valide', label: 'Validé' },
  { value: 'rejete', label: 'Rejeté' },
  { value: 'expire', label: 'Expiré' },
]

export function DashboardPage() {
  const depots = useAppStore((s) => s.depots)
  const [tab, setTab] = useState<Tab>('general')
  const [loading, setLoading] = useState(true)

  const [allStock, setAllStock] = useState<StockGlobal[]>([])
  const [bonsSortieAttente, setBonsSortieAttente] = useState<BonSortieGlobal[]>([])
  const [bonsReceptionAttente, setBonsReceptionAttente] = useState<BonReceptionGlobal[]>([])
  const [alertes, setAlertes] = useState<AlerteGlobale[]>([])
  const [bonsSortieJour, setBonsSortieJour] = useState<BonSortieGlobal[]>([])
  const [bonsReceptionJour, setBonsReceptionJour] = useState<BonReceptionGlobal[]>([])
  const [mouvements, setMouvements] = useState<Mouvement[]>([])

  const [expandedDepot, setExpandedDepot] = useState<string | null>(null)
  const [filtreDepot, setFiltreDepot] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('')
  const [filtreType, setFiltreType] = useState<'' | 'sortie' | 'reception'>('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const debutJournee = new Date()
      debutJournee.setHours(0, 0, 0, 0)

      const [stockRes, sortieAttenteRes, receptionAttenteRes, alertesRes, sortieJourRes, receptionJourRes, sortieMouvRes, receptionMouvRes] =
        await Promise.all([
          supabase.from('stock_produits').select(STOCK_GLOBAL_SELECT).order('depot_id'),
          supabase.from('bons_sortie').select(BON_SORTIE_GLOBAL_SELECT).eq('statut', 'en_attente').order('created_at', { ascending: false }),
          supabase.from('bons_reception').select(BON_RECEPTION_GLOBAL_SELECT).eq('statut', 'en_attente').order('created_at', { ascending: false }),
          supabase.from('alertes').select(ALERTES_SELECT).eq('acquittee', false).order('envoyee_le', { ascending: false }).limit(20),
          supabase.from('bons_sortie').select(BON_SORTIE_GLOBAL_SELECT).gte('created_at', debutJournee.toISOString()).order('created_at', { ascending: false }),
          supabase.from('bons_reception').select(BON_RECEPTION_GLOBAL_SELECT).gte('created_at', debutJournee.toISOString()).order('created_at', { ascending: false }),
          supabase.from('bons_sortie').select(MOUVEMENT_SORTIE_SELECT).eq('statut', 'approuve').order('valide_le', { ascending: false }).limit(30),
          supabase.from('bons_reception').select(MOUVEMENT_RECEPTION_SELECT).eq('statut', 'valide').order('valide_le', { ascending: false }).limit(30),
        ])

      if (cancelled) return

      setAllStock(
        ((stockRes.data ?? []) as unknown as StockGlobalRaw[]).map((s) => ({
          ...s,
          qte_nette: s.qte_disponible - s.qte_reservee,
          statut_stock: computeStatutStock(s),
        }))
      )

      setBonsSortieAttente((sortieAttenteRes.data ?? []) as unknown as BonSortieGlobal[])
      setBonsReceptionAttente((receptionAttenteRes.data ?? []) as unknown as BonReceptionGlobal[])
      setAlertes((alertesRes.data ?? []) as unknown as AlerteGlobale[])
      setBonsSortieJour((sortieJourRes.data ?? []) as unknown as BonSortieGlobal[])
      setBonsReceptionJour((receptionJourRes.data ?? []) as unknown as BonReceptionGlobal[])

      const mvtSortie = ((sortieMouvRes.data ?? []) as unknown as MouvementSortieRow[]).flatMap((bon) =>
        bon.lignes.map((ligne) => ({
          id: `sortie-${bon.id}-${ligne.produit_id}`,
          type: 'sortie' as const,
          depotNom: bon.depot?.nom ?? '-',
          produitNom: ligne.produit?.nom ?? '-',
          unite: ligne.produit?.unite ?? '',
          quantite: ligne.qte_accordee ?? ligne.qte_demandee,
          date: bon.valide_le ?? bon.created_at,
        }))
      )

      const mvtReception = ((receptionMouvRes.data ?? []) as unknown as MouvementReceptionRow[]).flatMap((bon) =>
        bon.lignes.map((ligne) => ({
          id: `reception-${bon.id}-${ligne.produit_id}`,
          type: 'reception' as const,
          depotNom: bon.depot?.nom ?? '-',
          produitNom: ligne.produit?.nom ?? '-',
          unite: ligne.produit?.unite ?? '',
          quantite: ligne.qte_recue,
          date: bon.valide_le ?? bon.created_at,
        }))
      )

      setMouvements(
        [...mvtSortie, ...mvtReception]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 50)
      )

      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <p className="text-sm text-gray-400">Chargement...</p>

  const totalArticles = allStock.reduce((total, s) => total + s.qte_disponible, 0)
  const totalBonsAttente = bonsSortieAttente.length + bonsReceptionAttente.length
  const alertesActives = alertes
    .filter((a) => a.type !== 'levee' && a.stock_produit)
    .sort((a, b) => SEVERITE[a.type] - SEVERITE[b.type])

  const enAttenteValidation: BonJourItem[] = [
    ...bonsSortieAttente.map((bon) => ({ type: 'sortie' as const, bon })),
    ...bonsReceptionAttente.map((bon) => ({ type: 'reception' as const, bon })),
  ].sort((a, b) => new Date(b.bon.created_at).getTime() - new Date(a.bon.created_at).getTime())

  const bonsJour: BonJourItem[] = [
    ...bonsSortieJour.map((bon) => ({ type: 'sortie' as const, bon })),
    ...bonsReceptionJour.map((bon) => ({ type: 'reception' as const, bon })),
  ]
    .filter((item) => !filtreDepot || item.bon.depot_id === filtreDepot)
    .filter((item) => !filtreStatut || item.bon.statut === filtreStatut)
    .filter((item) => !filtreType || item.type === filtreType)
    .sort((a, b) => new Date(b.bon.created_at).getTime() - new Date(a.bon.created_at).getTime())

  const cards = [
    { label: 'Articles en stock (tous dépôts)', value: totalArticles, color: 'bg-brand-50 text-brand-800' },
    { label: 'Bons en attente', value: totalBonsAttente, color: 'bg-amber-50 text-amber-600' },
    { label: 'Alertes actives', value: alertesActives.length, color: 'bg-danger-50 text-danger-600' },
    { label: 'Dépôts actifs', value: depots.length, color: 'bg-blue-50 text-blue-800' },
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
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {cards.map((card) => (
              <div key={card.label} className={`rounded-2xl p-4 ${card.color}`}>
                <div className="text-2xl font-bold">{card.value}</div>
                <div className="text-xs font-medium">{card.label}</div>
              </div>
            ))}
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-700">En attente de validation</h2>
            <div className="flex flex-col gap-2">
              {enAttenteValidation.map((item) => (
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
                      {item.bon.depot?.nom ?? '-'} ·{' '}
                      {item.type === 'sortie' ? item.bon.motif : item.bon.fournisseur} ·{' '}
                      {new Date(item.bon.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <Badge color={statutToColor(item.bon.statut)}>{item.bon.statut}</Badge>
                </div>
              ))}

              {enAttenteValidation.length === 0 && <p className="text-sm text-gray-400">Aucun bon en attente</p>}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Alertes actives</h2>
            <div className="flex flex-col gap-2">
              {alertesActives.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
                  <div>
                    <div className="font-medium text-gray-900">{a.stock_produit?.produit?.nom}</div>
                    <div className="text-xs text-gray-500">
                      {a.stock_produit?.depot?.nom} · {a.stock_produit?.qte_disponible}{' '}
                      {a.stock_produit?.produit?.unite} disponible{(a.stock_produit?.qte_disponible ?? 0) > 1 ? 's' : ''}
                    </div>
                  </div>
                  <Badge color={ALERTE_COLORS[a.type]}>{a.type}</Badge>
                </div>
              ))}

              {alertesActives.length === 0 && <p className="text-sm text-gray-400">Aucune alerte active</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'stocks' && (
        <div className="flex flex-col gap-3">
          {depots.map((depot) => {
            const stockDepot = allStock.filter((s) => s.depot_id === depot.id)
            const isOpen = expandedDepot === depot.id

            return (
              <div key={depot.id} className="rounded-2xl bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedDepot(isOpen ? null : depot.id)}
                  className="flex w-full items-center justify-between p-4"
                >
                  <div className="flex items-center gap-2">
                    <Warehouse size={18} className="text-brand-800" />
                    <span className="text-sm font-semibold text-gray-700">{depot.nom}</span>
                    <span className="text-xs text-gray-400">
                      ({stockDepot.length} article{stockDepot.length > 1 ? 's' : ''})
                    </span>
                  </div>
                  <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-3 border-t border-gray-100 p-4">
                    {stockDepot.map((s) => (
                      <StockBar key={s.id} stock={s as unknown as StockProduit} />
                    ))}
                    {stockDepot.length === 0 && <p className="text-sm text-gray-400">Aucun produit en stock</p>}
                  </div>
                )}
              </div>
            )
          })}

          {depots.length === 0 && <p className="text-sm text-gray-400">Aucun dépôt actif</p>}
        </div>
      )}

      {tab === 'bons-jour' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <select
              aria-label="Filtrer par dépôt"
              value={filtreDepot}
              onChange={(e) => setFiltreDepot(e.target.value)}
              className="rounded-xl border border-gray-200 px-2 py-2 text-xs focus:border-brand-400 focus:outline-none"
            >
              <option value="">Dépôt</option>
              {depots.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrer par type"
              value={filtreType}
              onChange={(e) => setFiltreType(e.target.value as '' | 'sortie' | 'reception')}
              className="rounded-xl border border-gray-200 px-2 py-2 text-xs focus:border-brand-400 focus:outline-none"
            >
              <option value="">Type</option>
              <option value="sortie">Sortie</option>
              <option value="reception">Réception</option>
            </select>
            <select
              aria-label="Filtrer par statut"
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value)}
              className="rounded-xl border border-gray-200 px-2 py-2 text-xs focus:border-brand-400 focus:outline-none"
            >
              <option value="">Statut</option>
              {STATUT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            {bonsJour.map((item) => (
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
                    {item.bon.depot?.nom ?? '-'} ·{' '}
                    {item.type === 'sortie' ? item.bon.motif : item.bon.fournisseur} ·{' '}
                    {new Date(item.bon.created_at).toLocaleTimeString('fr-FR')}
                  </div>
                </div>
                <Badge color={statutToColor(item.bon.statut)}>{item.bon.statut}</Badge>
              </div>
            ))}

            {bonsJour.length === 0 && <p className="text-sm text-gray-400">Aucun bon aujourd'hui</p>}
          </div>
        </div>
      )}

      {tab === 'mouvements' && (
        <div className="flex flex-col gap-2">
          {mouvements.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  m.type === 'sortie' ? 'bg-danger-50 text-danger-600' : 'bg-brand-50 text-brand-800'
                }`}
              >
                {m.type === 'sortie' ? <PackageMinus size={18} /> : <PackagePlus size={18} />}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{m.produitNom}</div>
                <div className="text-xs text-gray-500">
                  {m.depotNom} · {new Date(m.date).toLocaleString('fr-FR')}
                </div>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {m.type === 'sortie' ? '-' : '+'}
                {m.quantite} {m.unite}
              </div>
            </div>
          ))}

          {mouvements.length === 0 && <p className="text-sm text-gray-400">Aucun mouvement récent</p>}
        </div>
      )}
    </div>
  )
}
