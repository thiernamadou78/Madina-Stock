import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../stores/appStore'
import { Button } from '../ui/Button'
import type { Produit } from '../../types'

interface CreateProductModalProps {
  open: boolean
  onClose: () => void
  onCreated: (produit: Produit) => void
  initialNom?: string
}

const CATEGORIES = ['Céréales', 'Huiles', 'Sucre', 'Boissons', 'Hygiène', 'Cosmétique', 'Conserves', 'Épices']
const UNITES = ['sac', 'bidon', 'carton', 'pièce', 'kg', 'litre', 'boîte', 'sachet']

const AUTRE = '__autre__'

export function CreateProductModal({ open, onClose, onCreated, initialNom = '' }: CreateProductModalProps) {
  const depotActifId = useAppStore((s) => s.depotActifId)

  const [nom, setNom] = useState(initialNom)
  const [reference, setReference] = useState('')
  const [categorie, setCategorie] = useState('')
  const [categorieAutre, setCategorieAutre] = useState('')
  const [unite, setUnite] = useState('')
  const [uniteAutre, setUniteAutre] = useState('')
  const [seuilAlerte, setSeuilAlerte] = useState('10')
  const [seuilCritique, setSeuilCritique] = useState('5')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) setNom(initialNom)
  }, [open, initialNom])

  if (!open) return null

  const reset = () => {
    setNom('')
    setReference('')
    setCategorie('')
    setCategorieAutre('')
    setUnite('')
    setUniteAutre('')
    setSeuilAlerte('10')
    setSeuilCritique('5')
    setError(null)
  }

  const categorieFinale = categorie === AUTRE ? categorieAutre.trim() : categorie
  const uniteFinale = unite === AUTRE ? uniteAutre.trim() : unite

  const handleSubmit = async () => {
    if (!nom.trim() || !categorieFinale || !uniteFinale) {
      setError('Nom, catégorie et unité sont obligatoires')
      return
    }

    setLoading(true)
    setError(null)

    const { data: produit, error: err } = await supabase
      .from('produits')
      .insert({
        nom: nom.trim(),
        reference: reference.trim() || null,
        categorie: categorieFinale,
        unite: uniteFinale,
      })
      .select()
      .single()

    if (err || !produit) {
      setError(err?.message ?? 'Erreur lors de la création du produit')
      setLoading(false)
      return
    }

    if (depotActifId) {
      await supabase.from('stock_produits').insert({
        depot_id: depotActifId,
        produit_id: produit.id,
        qte_disponible: 0,
        seuil_alerte: Number(seuilAlerte) || 10,
        seuil_critique: Number(seuilCritique) || 5,
      })
    }

    setLoading(false)
    onCreated(produit as Produit)
    reset()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Nouveau produit</h2>
          <button type="button" aria-label="Fermer" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700">
            Nom
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              placeholder="Riz importé 50kg"
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Référence
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              placeholder="Optionnel"
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Catégorie
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            >
              <option value="">Sélectionner...</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={AUTRE}>Autre...</option>
            </select>
          </label>

          {categorie === AUTRE && (
            <input
              value={categorieAutre}
              onChange={(e) => setCategorieAutre(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              placeholder="Nom de la catégorie"
            />
          )}

          <label className="text-sm font-medium text-gray-700">
            Unité
            <select
              value={unite}
              onChange={(e) => setUnite(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            >
              <option value="">Sélectionner...</option>
              {UNITES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
              <option value={AUTRE}>Autre...</option>
            </select>
          </label>

          {unite === AUTRE && (
            <input
              value={uniteAutre}
              onChange={(e) => setUniteAutre(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              placeholder="Nom de l'unité"
            />
          )}

          <div className="flex gap-3">
            <label className="flex-1 text-sm font-medium text-gray-700">
              Seuil alerte
              <input
                type="number"
                value={seuilAlerte}
                onChange={(e) => setSeuilAlerte(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              />
            </label>
            <label className="flex-1 text-sm font-medium text-gray-700">
              Seuil critique
              <input
                type="number"
                value={seuilCritique}
                onChange={(e) => setSeuilCritique(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              />
            </label>
          </div>

          {error && <p className="text-sm text-danger-600">{error}</p>}
        </div>

        <div className="mt-5 flex gap-3">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button fullWidth onClick={handleSubmit} disabled={loading}>
            {loading ? 'Création...' : 'Créer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
