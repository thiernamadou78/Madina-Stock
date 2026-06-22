import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { CATEGORIES_PRODUIT, UNITES_PRODUIT } from '../lib/produits'
import type { Depot, Produit } from '../types'

const INPUT_CLASS =
  'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-base focus:border-brand-400 focus:outline-none'

const CATEGORIE_COLORS: Record<string, 'brand' | 'blue' | 'amber' | 'danger' | 'gray'> = {
  'Céréales': 'amber',
  'Huiles & graisses': 'blue',
  'Sucre & confiserie': 'danger',
  'Boissons': 'brand',
  'Conserves': 'gray',
  'Produits laitiers': 'blue',
  'Autres': 'gray',
}

interface ProduitModalProps {
  open: boolean
  onClose: () => void
  produit: Produit | null
  initialNom: string
  depots: Depot[]
  depotActifId: string | null
  entrepriseId?: string
  onSaved: (message: string) => void
}

function ProduitModal({ open, onClose, produit, initialNom, depots, depotActifId, entrepriseId, onSaved }: ProduitModalProps) {
  const [nom, setNom] = useState('')
  const [categorie, setCategorie] = useState(CATEGORIES_PRODUIT[0])
  const [unite, setUnite] = useState(UNITES_PRODUIT[0])
  const [seuilAlerte, setSeuilAlerte] = useState('10')
  const [seuilCritique, setSeuilCritique] = useState('5')
  const [actif, setActif] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!produit

  useEffect(() => {
    if (!open) return

    setError(null)

    if (produit) {
      setNom(produit.nom)
      setCategorie(produit.categorie)
      setUnite(produit.unite)
      setActif(produit.actif)

      if (depotActifId) {
        supabase
          .from('stock_produits')
          .select('seuil_alerte, seuil_critique')
          .eq('produit_id', produit.id)
          .eq('depot_id', depotActifId)
          .maybeSingle()
          .then(({ data }) => {
            setSeuilAlerte(String(data?.seuil_alerte ?? 10))
            setSeuilCritique(String(data?.seuil_critique ?? 5))
          })
      } else {
        setSeuilAlerte('10')
        setSeuilCritique('5')
      }
    } else {
      setNom(initialNom)
      setCategorie(CATEGORIES_PRODUIT[0])
      setUnite(UNITES_PRODUIT[0])
      setSeuilAlerte('10')
      setSeuilCritique('5')
      setActif(true)
    }
  }, [open, produit, initialNom, depotActifId])

  const handleSubmit = async () => {
    if (!nom.trim()) {
      setError('Le nom est obligatoire')
      return
    }

    setLoading(true)
    setError(null)

    const seuilAlerteNum = Number(seuilAlerte) || 10
    const seuilCritiqueNum = Number(seuilCritique) || 5

    if (isEdit && produit) {
      const { error: err } = await supabase
        .from('produits')
        .update({ nom: nom.trim(), categorie, unite, actif })
        .eq('id', produit.id)

      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      if (depotActifId) {
        await supabase
          .from('stock_produits')
          .update({ seuil_alerte: seuilAlerteNum, seuil_critique: seuilCritiqueNum })
          .eq('produit_id', produit.id)
          .eq('depot_id', depotActifId)
      }

      setLoading(false)
      onSaved('✓ Produit mis à jour')
      onClose()
      return
    }

    const { data: created, error: err } = await supabase
      .from('produits')
      .insert({ nom: nom.trim(), categorie, unite, actif: true, entreprise_id: entrepriseId ?? null })
      .select()
      .single()

    if (err || !created) {
      setError(err?.message ?? 'Erreur lors de la création du produit')
      setLoading(false)
      return
    }

    if (depots.length > 0) {
      await supabase.from('stock_produits').insert(
        depots.map((depot) => ({
          depot_id: depot.id,
          produit_id: created.id,
          qte_disponible: 0,
          seuil_alerte: seuilAlerteNum,
          seuil_critique: seuilCritiqueNum,
          entreprise_id: entrepriseId ?? null,
        }))
      )
    }

    setLoading(false)
    onSaved('✓ Produit créé')
    onClose()
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={isEdit ? 'Modifier le produit' : 'Nouveau produit'}>
      <div className="flex flex-col gap-3 pb-4">
        <label className="text-sm font-medium text-gray-700">
          Nom
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Riz importé 50kg"
          />
        </label>

        <label className="text-sm font-medium text-gray-700">
          Catégorie
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={INPUT_CLASS}>
            {CATEGORIES_PRODUIT.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-gray-700">
          Unité
          <select value={unite} onChange={(e) => setUnite(e.target.value)} className={INPUT_CLASS}>
            {UNITES_PRODUIT.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-3">
          <label className="flex-1 text-sm font-medium text-gray-700">
            Seuil alerte
            <input
              type="number"
              value={seuilAlerte}
              onChange={(e) => setSeuilAlerte(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="flex-1 text-sm font-medium text-gray-700">
            Seuil critique
            <input
              type="number"
              value={seuilCritique}
              onChange={(e) => setSeuilCritique(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        </div>

        {isEdit && (
          <label className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-700">
            Produit actif
            <input
              type="checkbox"
              checked={actif}
              onChange={(e) => setActif(e.target.checked)}
              className="h-5 w-5 accent-brand-800"
            />
          </label>
        )}

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <div className="flex gap-3">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button fullWidth onClick={handleSubmit} disabled={loading}>
            {loading ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function ProduitsPage() {
  const role = useAppStore((s) => s.user?.role)
  const entrepriseId = useAppStore((s) => s.user?.entreprise_id)
  const depots = useAppStore((s) => s.depots)
  const depotActifId = useAppStore((s) => s.depotActifId)
  const canEdit = role === 'proprietaire' || role === 'admin'

  const [produits, setProduits] = useState<Produit[]>([])
  const [stockTotals, setStockTotals] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Produit | null>(null)
  const [initialNom, setInitialNom] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)

    const [produitsRes, stockRes] = await Promise.all([
      supabase.from('produits').select('*').eq('actif', true).eq('entreprise_id', entrepriseId ?? '').order('nom'),
      supabase.from('stock_produits').select('produit_id, qte_disponible').eq('entreprise_id', entrepriseId ?? ''),
    ])

    const totals: Record<string, number> = {}
    for (const row of (stockRes.data ?? []) as { produit_id: string; qte_disponible: number }[]) {
      totals[row.produit_id] = (totals[row.produit_id] ?? 0) + row.qte_disponible
    }

    setProduits((produitsRes.data ?? []) as unknown as Produit[])
    setStockTotals(totals)
    setLoading(false)
  }, [entrepriseId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timeout)
  }, [toast])

  const filtres = produits.filter((p) => p.nom.toLowerCase().includes(search.trim().toLowerCase()))

  const openCreate = (nom = '') => {
    setEditing(null)
    setInitialNom(nom)
    setModalOpen(true)
  }

  const openEdit = (produit: Produit) => {
    setEditing(produit)
    setInitialNom('')
    setModalOpen(true)
  }

  const handleSaved = (message: string) => {
    setToast(message)
    refresh()
  }

  if (loading) return <p className="text-sm text-gray-400">Chargement...</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-gray-900">Catalogue produits</h1>
        <Button size="sm" icon={<Plus size={16} />} onClick={() => openCreate()}>
          Nouveau produit
        </Button>
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        {filtres.map((produit) => (
          <div key={produit.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex-1">
              <div className="font-bold text-gray-900">{produit.nom}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge color={CATEGORIE_COLORS[produit.categorie] ?? 'gray'}>{produit.categorie}</Badge>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                  {produit.unite}
                </span>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
                  Stock total : {stockTotals[produit.id] ?? 0}
                </span>
              </div>
            </div>

            {canEdit && (
              <button
                type="button"
                aria-label={`Modifier ${produit.nom}`}
                onClick={() => openEdit(produit)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500"
              >
                <Pencil size={16} />
              </button>
            )}
          </div>
        ))}

        {filtres.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center">
            <p className="text-sm text-gray-400">Aucun produit trouvé</p>
            {search.trim() && (
              <Button size="sm" icon={<Plus size={16} />} onClick={() => openCreate(search.trim())}>
                Créer "{search.trim()}"
              </Button>
            )}
          </div>
        )}
      </div>

      <ProduitModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        produit={editing}
        initialNom={initialNom}
        depots={depots}
        depotActifId={depotActifId}
        entrepriseId={entrepriseId}
        onSaved={handleSaved}
      />

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
