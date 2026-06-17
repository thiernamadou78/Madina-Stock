import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, CheckCircle2, Clock, Minus, Plus, Search, ShoppingCart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStock } from '../hooks/useStock'
import { useAppStore } from '../stores/appStore'
import { creerBonSortie, sortieDirecte } from '../lib/bons'
import { Button } from '../components/ui/Button'
import type { Depot, MotifSortie, StatutBon } from '../types'

const MOTIFS: { value: MotifSortie; label: string; icon: string }[] = [
  { value: 'vente', label: 'Vente', icon: '🛒' },
  { value: 'transfert', label: 'Transfert', icon: '↔' },
]

export function NouvelleSortiePage() {
  const { stock } = useStock()
  const depotActifId = useAppStore((s) => s.depotActifId)
  const user = useAppStore((s) => s.user)
  const navigate = useNavigate()

  const [motif, setMotif] = useState<MotifSortie>('vente')
  const [depots, setDepots] = useState<Depot[]>([])
  const [depotDestinationId, setDepotDestinationId] = useState('')

  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [produitId, setProduitId] = useState<string | null>(null)
  const [quantite, setQuantite] = useState(1)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bonCree, setBonCree] = useState<{ numero: string; statut: StatutBon } | null>(null)

  const isProprietaire = user?.role === 'proprietaire'

  useEffect(() => {
    if (motif !== 'transfert') return

    supabase
      .from('depots')
      .select('*')
      .eq('actif', true)
      .neq('id', depotActifId ?? '')
      .then(({ data }) => setDepots((data ?? []) as Depot[]))
  }, [motif, depotActifId])

  const selectedStock = stock.find((s) => s.produit_id === produitId)
  const disponible = selectedStock?.qte_disponible ?? 0
  const unite = selectedStock?.produit?.unite ?? ''

  const resultats = stock.filter((s) =>
    s.produit?.nom.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelectProduit = (s: (typeof stock)[number]) => {
    setProduitId(s.produit_id)
    setSearch(s.produit?.nom ?? '')
    setShowDropdown(false)
    setQuantite(1)
  }

  const quantiteInvalide = selectedStock != null && disponible > 0 && quantite > disponible

  const isValid =
    !!produitId &&
    disponible > 0 &&
    quantite > 0 &&
    !quantiteInvalide &&
    (motif !== 'transfert' || !!depotDestinationId)

  const handleSubmit = async () => {
    if (!isValid || !depotActifId || !user || !produitId) return

    setLoading(true)
    setError(null)

    const params = {
      depotId: depotActifId,
      gestionnairId: user.id,
      motif,
      depotDestinationId: motif === 'transfert' ? depotDestinationId : undefined,
      lignes: [{ produitId, qteDemandee: quantite }],
      entrepriseId: user.entreprise_id,
    }

    const result = isProprietaire ? await sortieDirecte(params) : await creerBonSortie(params)

    setLoading(false)

    if (!result.success || !result.bon) {
      setError(result.error ?? 'Erreur lors de la création du bon')
      return
    }

    setBonCree(result.bon)
  }

  const handleNouveauBon = () => {
    setBonCree(null)
    setProduitId(null)
    setSearch('')
    setQuantite(1)
    setMotif('vente')
    setDepotDestinationId('')
  }

  if (bonCree) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-800">
          <CheckCircle2 size={36} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">Bon de sortie créé</h1>
        <p className="text-2xl font-bold text-brand-800">{bonCree.numero}</p>
        {bonCree.statut === 'approuve' ? (
          <p className="text-sm font-medium text-brand-600">
            Sortie immédiate — aucune validation requise
          </p>
        ) : (
          <p className="text-sm text-gray-500">En attente de validation du propriétaire</p>
        )}

        <div className="mt-4 flex w-full flex-col gap-3">
          <Button fullWidth onClick={handleNouveauBon}>
            Nouveau bon
          </Button>
          <Button fullWidth variant="secondary" onClick={() => navigate('/historique')}>
            Voir l'historique
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-gray-900">Nouvelle sortie</h1>

      {isProprietaire ? (
        <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
          <CheckCircle2 size={16} />
          Sortie immédiate — aucune validation requise
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-600">
          <Clock size={16} />
          En attente de validation du propriétaire
        </div>
      )}

      <div>
        <span className="mb-2 block text-sm font-medium text-gray-700">Motif</span>
        <div className="grid grid-cols-2 gap-3">
          {MOTIFS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMotif(m.value)}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 py-5 text-sm font-semibold transition-colors ${
                motif === m.value
                  ? 'border-brand-400 bg-brand-50 text-brand-800'
                  : 'border-transparent bg-white text-gray-600 shadow-sm'
              }`}
            >
              <span className="text-2xl">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {motif === 'transfert' && (
        <label className="text-sm font-medium text-gray-700">
          Dépôt destination
          <select
            value={depotDestinationId}
            onChange={(e) => setDepotDestinationId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          >
            <option value="">Sélectionner...</option>
            {depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="relative">
        <span className="mb-1 block text-sm font-medium text-gray-700">Article</span>
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-brand-400">
          <Search size={16} className="text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setProduitId(null)
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Rechercher un produit..."
            className="w-full text-sm focus:outline-none"
          />
        </div>

        {showDropdown && search && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
            {resultats.map((s) => (
              <button
                key={s.produit_id}
                type="button"
                onClick={() => handleSelectProduit(s)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-brand-50"
              >
                {s.produit?.nom}
                <span className="text-xs text-gray-400">
                  {s.qte_disponible} {s.produit?.unite}
                </span>
              </button>
            ))}
            {resultats.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-400">Aucun produit trouvé</p>
            )}
          </div>
        )}

        {selectedStock && (
          <div className="mt-2">
            {disponible > 0 ? (
              <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800">
                Disponible : {disponible} {unite}
                {disponible > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-danger-50 px-3 py-1 text-xs font-medium text-danger-600">
                Rupture de stock
              </span>
            )}
          </div>
        )}
      </div>

      {selectedStock && disponible > 0 && (
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">Quantité</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Diminuer la quantité"
              onClick={() => setQuantite((q) => Math.max(1, q - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700"
            >
              <Minus size={18} />
            </button>
            <input
              type="number"
              min="1"
              aria-label="Quantité"
              placeholder="Quantité"
              value={quantite}
              onChange={(e) => setQuantite(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-center text-sm focus:border-brand-400 focus:outline-none"
            />
            <button
              type="button"
              aria-label="Augmenter la quantité"
              onClick={() => setQuantite((q) => q + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700"
            >
              <Plus size={18} />
            </button>
            <span className="text-sm text-gray-500">{unite}</span>
          </div>

          {quantiteInvalide && (
            <p className="mt-2 text-sm font-medium text-danger-600">
              Quantité supérieure au stock disponible ({disponible})
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-danger-600">{error}</p>}

      <Button
        fullWidth
        icon={motif === 'vente' ? <ShoppingCart size={18} /> : <ArrowLeftRight size={18} />}
        onClick={handleSubmit}
        disabled={!isValid || loading}
        className={isValid ? '' : '!bg-gray-200 !text-gray-400 hover:!bg-gray-200'}
      >
        {loading ? 'Création...' : 'Générer le bon de sortie'}
      </Button>
    </div>
  )
}
