import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, PackageMinus, PackagePlus, Warehouse } from 'lucide-react'
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

const CARTES = ['apercu', 'valider', 'alertes', 'stocks', 'activite'] as const
type Carte = (typeof CARTES)[number]

const CARTE_TITRES: Record<Carte, string> = {
  apercu: 'Aperçu',
  valider: 'À valider',
  alertes: 'Alertes stock',
  stocks: 'Stocks par dépôt',
  activite: 'Activité récente',
}

const SEVERITE: Record<TypeAlerte, number> = { rupture: 0, critique: 1, alerte: 2, levee: 3 }

const ALERTE_COLORS: Record<TypeAlerte, 'brand' | 'blue' | 'amber' | 'danger' | 'gray'> = {
  rupture: 'danger',
  critique: 'danger',
  alerte: 'amber',
  levee: 'brand',
}

type StatutStockKey = 'ok' | 'alerte' | 'critique' | 'rupture'

const RING_STROKE_CLASSES: Record<StatutStockKey, string> = {
  ok: 'stroke-brand-800',
  alerte: 'stroke-amber-500',
  critique: 'stroke-danger-600',
  rupture: 'stroke-gray-500',
}

const RING_DOT_CLASSES: Record<StatutStockKey, string> = {
  ok: 'bg-brand-800',
  alerte: 'bg-amber-500',
  critique: 'bg-danger-600',
  rupture: 'bg-gray-500',
}

function HealthRing({ stock }: { stock: StockGlobal[] }) {
  const total = stock.length
  const counts: Record<StatutStockKey, number> = {
    ok: stock.filter((s) => s.statut_stock === 'ok').length,
    alerte: stock.filter((s) => s.statut_stock === 'alerte').length,
    critique: stock.filter((s) => s.statut_stock === 'critique').length,
    rupture: stock.filter((s) => s.statut_stock === 'rupture').length,
  }
  const radius = 56
  const circumference = 2 * Math.PI * radius
  const pctOk = total > 0 ? Math.round((counts.ok / total) * 100) : 100

  let cumulative = 0
  const segments = (['ok', 'alerte', 'critique', 'rupture'] as const)
    .map((key) => ({ key, value: counts[key] }))
    .filter((s) => s.value > 0)
    .map((s) => {
      const pct = total > 0 ? s.value / total : 0
      const dash = circumference * pct
      const rotation = -90 + (cumulative / Math.max(total, 1)) * 360
      cumulative += s.value
      return { ...s, dash, rotation }
    })

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="168" height="168" viewBox="0 0 168 168">
        <circle cx="84" cy="84" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="16" />
        {segments.map((seg) => (
          <circle
            key={seg.key}
            cx="84"
            cy="84"
            r={radius}
            fill="none"
            strokeWidth="16"
            strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
            transform={`rotate(${seg.rotation} 84 84)`}
            className={`transition-all duration-700 ${RING_STROKE_CLASSES[seg.key]}`}
          />
        ))}
        <text x="84" y="80" textAnchor="middle" className="fill-gray-900 text-[28px] font-bold">
          {pctOk}%
        </text>
        <text x="84" y="100" textAnchor="middle" className="fill-gray-400 text-[10px] font-medium uppercase tracking-wide">
          niveau normal
        </text>
      </svg>

      <div className="flex flex-wrap justify-center gap-3">
        {(['ok', 'alerte', 'critique', 'rupture'] as const).map((key) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`h-2 w-2 rounded-full ${RING_DOT_CLASSES[key]}`} />
            {key === 'ok' ? 'OK' : key.charAt(0).toUpperCase() + key.slice(1)} ({counts[key]})
          </div>
        ))}
      </div>
    </div>
  )
}

function libelleJour(dateStr: string): string {
  const date = new Date(dateStr)
  const aujourdhui = new Date()
  const hier = new Date()
  hier.setDate(hier.getDate() - 1)

  if (date.toDateString() === aujourdhui.toDateString()) return "Aujourd'hui"
  if (date.toDateString() === hier.toDateString()) return 'Hier'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

export function DashboardPage() {
  const depots = useAppStore((s) => s.depots)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [activeCard, setActiveCard] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [allStock, setAllStock] = useState<StockGlobal[]>([])
  const [bonsSortieAttente, setBonsSortieAttente] = useState<BonSortieGlobal[]>([])
  const [bonsReceptionAttente, setBonsReceptionAttente] = useState<BonReceptionGlobal[]>([])
  const [alertes, setAlertes] = useState<AlerteGlobale[]>([])
  const [mouvements, setMouvements] = useState<Mouvement[]>([])

  const [expandedDepot, setExpandedDepot] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [stockRes, sortieAttenteRes, receptionAttenteRes, alertesRes, sortieMouvRes, receptionMouvRes] =
        await Promise.all([
          supabase.from('stock_produits').select(STOCK_GLOBAL_SELECT).order('depot_id'),
          supabase.from('bons_sortie').select(BON_SORTIE_GLOBAL_SELECT).eq('statut', 'en_attente').order('created_at', { ascending: false }),
          supabase.from('bons_reception').select(BON_RECEPTION_GLOBAL_SELECT).eq('statut', 'en_attente').order('created_at', { ascending: false }),
          supabase.from('alertes').select(ALERTES_SELECT).eq('acquittee', false).order('envoyee_le', { ascending: false }).limit(20),
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

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    setActiveCard(Math.round(el.scrollLeft / el.clientWidth))
  }

  const goToCard = (index: number) => {
    scrollRef.current?.scrollTo({ left: index * (scrollRef.current.clientWidth ?? 0), behavior: 'smooth' })
  }

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

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-bold text-gray-900">Tableau de bord</h1>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="-mx-4 flex snap-x snap-mandatory overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {CARTES.map((carte) => (
          <div key={carte} className="w-full shrink-0 snap-center pr-0">
            <div className="flex min-h-[60vh] flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">{CARTE_TITRES[carte]}</h2>

              {carte === 'apercu' && (
                <div className="flex flex-col gap-5">
                  <HealthRing stock={allStock} />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-brand-50 p-3 text-center">
                      <div className="text-xl font-bold text-brand-800">{totalArticles}</div>
                      <div className="text-[11px] font-medium text-brand-800/70">Articles</div>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3 text-center">
                      <div className="text-xl font-bold text-amber-600">{totalBonsAttente}</div>
                      <div className="text-[11px] font-medium text-amber-600/70">En attente</div>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-3 text-center">
                      <div className="text-xl font-bold text-blue-800">{depots.length}</div>
                      <div className="text-[11px] font-medium text-blue-800/70">Dépôts</div>
                    </div>
                  </div>
                </div>
              )}

              {carte === 'valider' && (
                <div className="flex flex-1 flex-col gap-2">
                  {enAttenteValidation.map((item) => (
                    <button
                      key={`${item.type}-${item.bon.id}`}
                      type="button"
                      onClick={() => navigate('/validations')}
                      className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3 text-left"
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          item.type === 'sortie' ? 'bg-danger-50 text-danger-600' : 'bg-brand-50 text-brand-800'
                        }`}
                      >
                        {item.type === 'sortie' ? <PackageMinus size={18} /> : <PackagePlus size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900">{item.bon.numero}</div>
                        <div className="truncate text-xs text-gray-500">
                          {item.bon.depot?.nom ?? '-'} ·{' '}
                          {item.type === 'sortie' ? item.bon.motif : item.bon.fournisseur} ·{' '}
                          {new Date(item.bon.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                      <Badge color={statutToColor(item.bon.statut)}>{item.bon.statut}</Badge>
                    </button>
                  ))}

                  {enAttenteValidation.length === 0 && (
                    <p className="text-sm text-gray-400">Aucun bon en attente 🎉</p>
                  )}

                  {enAttenteValidation.length > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate('/validations')}
                      className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-brand-800 py-2.5 text-sm font-semibold text-white"
                    >
                      Voir tout dans Validations <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              )}

              {carte === 'alertes' && (
                <div className="flex flex-1 flex-col gap-2">
                  {alertesActives.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-2xl bg-gray-50 p-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900">{a.stock_produit?.produit?.nom}</div>
                        <div className="text-xs text-gray-500">
                          {a.stock_produit?.depot?.nom} · {a.stock_produit?.qte_disponible}{' '}
                          {a.stock_produit?.produit?.unite} disponible{(a.stock_produit?.qte_disponible ?? 0) > 1 ? 's' : ''}
                        </div>
                      </div>
                      <Badge color={ALERTE_COLORS[a.type]}>{a.type}</Badge>
                    </div>
                  ))}

                  {alertesActives.length === 0 && <p className="text-sm text-gray-400">Aucune alerte active 🎉</p>}
                </div>
              )}

              {carte === 'stocks' && (
                <div className="flex flex-1 flex-col gap-3">
                  {depots.map((depot) => {
                    const stockDepot = allStock.filter((s) => s.depot_id === depot.id)
                    const isOpen = expandedDepot === depot.id

                    return (
                      <div key={depot.id} className="rounded-2xl bg-gray-50">
                        <button
                          type="button"
                          onClick={() => setExpandedDepot(isOpen ? null : depot.id)}
                          className="flex w-full items-center justify-between p-3"
                        >
                          <div className="flex items-center gap-2">
                            <Warehouse size={16} className="text-brand-800" />
                            <span className="text-sm font-semibold text-gray-700">{depot.nom}</span>
                            <span className="text-xs text-gray-400">
                              ({stockDepot.length} article{stockDepot.length > 1 ? 's' : ''})
                            </span>
                          </div>
                          <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isOpen && (
                          <div className="flex flex-col gap-3 border-t border-gray-200 p-3">
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

              {carte === 'activite' && (
                <div className="flex flex-1 flex-col gap-3">
                  {mouvements.length === 0 && <p className="text-sm text-gray-400">Aucun mouvement récent</p>}

                  {mouvements.map((m, i) => {
                    const jourPrecedent = i > 0 ? libelleJour(mouvements[i - 1].date) : null
                    const jour = libelleJour(m.date)

                    return (
                      <div key={m.id}>
                        {jour !== jourPrecedent && (
                          <div className="mb-2 mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                            {jour}
                          </div>
                        )}
                        <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              m.type === 'sortie' ? 'bg-danger-50 text-danger-600' : 'bg-brand-50 text-brand-800'
                            }`}
                          >
                            {m.type === 'sortie' ? <PackageMinus size={18} /> : <PackagePlus size={18} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-gray-900">{m.produitNom}</div>
                            <div className="text-xs text-gray-500">
                              {m.depotNom} · {new Date(m.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="shrink-0 text-sm font-semibold text-gray-900">
                            {m.type === 'sortie' ? '-' : '+'}
                            {m.quantite} {m.unite}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-1.5">
        {CARTES.map((carte, i) => (
          <button
            key={carte}
            type="button"
            aria-label={`Aller à ${CARTE_TITRES[carte]}`}
            onClick={() => goToCard(i)}
            className={`h-1.5 rounded-full transition-all ${
              activeCard === i ? 'w-6 bg-brand-800' : 'w-1.5 bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
