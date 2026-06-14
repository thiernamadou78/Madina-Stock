import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useReceptions } from '../hooks/useReceptions'
import { useAppStore } from '../stores/appStore'
import { Button } from '../components/ui/Button'
import { CreateProductModal } from '../components/modals/CreateProductModal'
import type { BonReception, CanalAppro, Produit } from '../types'

const CANAUX: { value: CanalAppro; label: string }[] = [
  { value: 'presentiel', label: 'Présentiel' },
  { value: 'appel', label: 'Appel' },
  { value: 'app_mobile', label: 'Application mobile' },
  { value: 'conteneur', label: 'Conteneur' },
]

const STEPS = ['Fournisseur', 'Articles', 'Résumé']

interface LigneForm {
  produitId: string
  nom: string
  unite: string
  qteRecue: string
  prixUnitaire: string
}

export function ReceptionPage() {
  const { creerReception } = useReceptions()
  const depots = useAppStore((s) => s.depots)
  const depotActifId = useAppStore((s) => s.depotActifId)
  const navigate = useNavigate()

  const [step, setStep] = useState(0)

  const [depotDestinationId, setDepotDestinationId] = useState(depotActifId ?? '')
  const [fournisseur, setFournisseur] = useState('')
  const [canal, setCanal] = useState<CanalAppro>('presentiel')
  const [referenceDoc, setReferenceDoc] = useState('')

  const [produits, setProduits] = useState<Produit[]>([])
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [lignes, setLignes] = useState<LigneForm[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bonCree, setBonCree] = useState<BonReception | null>(null)

  useEffect(() => {
    supabase
      .from('produits')
      .select('*')
      .eq('actif', true)
      .order('nom')
      .then(({ data }) => setProduits((data ?? []) as Produit[]))
  }, [])

  const resultats = produits.filter((p) => p.nom.toLowerCase().includes(search.toLowerCase()))

  const addLigne = (produit: Produit) => {
    setLignes((prev) => [
      ...prev,
      { produitId: produit.id, nom: produit.nom, unite: produit.unite, qteRecue: '', prixUnitaire: '' },
    ])
    setSearch('')
    setShowDropdown(false)
  }

  const updateLigne = (index: number, patch: Partial<LigneForm>) => {
    setLignes((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const removeLigne = (index: number) => setLignes((prev) => prev.filter((_, i) => i !== index))

  const handleProductCreated = (produit: Produit) => {
    setProduits((prev) => [...prev, produit])
    addLigne(produit)
    setModalOpen(false)
  }

  const lignesValides = lignes.filter((l) => l.produitId && Number(l.qteRecue) > 0)
  const valeurTotale = lignesValides.reduce(
    (total, l) => total + Number(l.qteRecue) * (Number(l.prixUnitaire) || 0),
    0
  )

  const step1Valid = !!fournisseur.trim() && !!depotDestinationId
  const step2Valid = lignesValides.length > 0

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    const result = await creerReception(
      {
        fournisseur: fournisseur.trim(),
        canal,
        reference_doc: referenceDoc.trim() || null,
        lignes: lignesValides.map((l) => ({
          produit_id: l.produitId,
          qte_recue: Number(l.qteRecue),
          prix_achat_unitaire: l.prixUnitaire ? Number(l.prixUnitaire) : null,
        })),
      },
      depotDestinationId
    )

    setLoading(false)

    if (result.error || !result.reception) {
      setError(result.error ?? 'Erreur lors de la création de la réception')
      return
    }

    setBonCree(result.reception)
  }

  if (bonCree) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-800">
          <CheckCircle2 size={36} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">Bon de réception créé</h1>
        <p className="text-2xl font-bold text-brand-800">{bonCree.numero}</p>
        <p className="text-sm text-gray-500">En attente de validation</p>

        <div className="mt-4 flex w-full flex-col gap-3">
          <Button fullWidth onClick={() => navigate('/historique')}>
            Voir l'historique
          </Button>
          <Button fullWidth variant="secondary" onClick={() => navigate('/')}>
            Retour à l'accueil
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-gray-900">Nouvelle réception</h1>

      <div className="flex items-center justify-between">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  i <= step ? 'bg-brand-800 text-white' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-xs ${i <= step ? 'text-brand-800 font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 h-0.5 flex-1 ${i < step ? 'bg-brand-800' : 'bg-gray-100'}`} />
            )}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700">
            Dépôt destination
            <select
              value={depotDestinationId}
              onChange={(e) => setDepotDestinationId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            >
              {depots.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Fournisseur
            <input
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              placeholder="Nom du fournisseur"
            />
          </label>

          <div>
            <span className="mb-2 block text-sm font-medium text-gray-700">Canal</span>
            <div className="grid grid-cols-2 gap-2">
              {CANAUX.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCanal(c.value)}
                  className={`rounded-xl border-2 py-2 text-sm font-medium transition-colors ${
                    canal === c.value
                      ? 'border-brand-400 bg-brand-50 text-brand-800'
                      : 'border-transparent bg-white text-gray-600 shadow-sm'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <label className="text-sm font-medium text-gray-700">
            Référence document
            <input
              value={referenceDoc}
              onChange={(e) => setReferenceDoc(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              placeholder="Optionnel"
            />
          </label>

          <Button fullWidth icon={<ArrowRight size={18} />} disabled={!step1Valid} onClick={() => setStep(1)}>
            Suivant
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <span className="mb-1 block text-sm font-medium text-gray-700">Ajouter un article</span>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-brand-400">
              <Search size={16} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Rechercher un produit..."
                className="w-full text-sm focus:outline-none"
              />
            </div>

            {showDropdown && search && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                {resultats.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addLigne(p)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-brand-50"
                  >
                    {p.nom}
                    <span className="text-xs text-gray-400">{p.unite}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="flex w-full items-center gap-1 px-3 py-2 text-left text-sm font-medium text-brand-800 hover:bg-brand-50"
                >
                  <Plus size={16} /> Créer « {search} » comme nouveau produit
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {lignes.map((ligne, i) => (
              <div key={i} className="flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{ligne.nom}</div>
                  <div className="text-xs text-gray-400">{ligne.unite}</div>
                </div>
                <input
                  type="number"
                  min="1"
                  value={ligne.qteRecue}
                  onChange={(e) => updateLigne(i, { qteRecue: e.target.value })}
                  placeholder="Qté"
                  className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  value={ligne.prixUnitaire}
                  onChange={(e) => updateLigne(i, { prixUnitaire: e.target.value })}
                  placeholder="Prix"
                  className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Supprimer la ligne"
                  onClick={() => removeLigne(i)}
                  className="text-gray-400 hover:text-danger-600"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}

            {lignes.length === 0 && (
              <p className="text-sm text-gray-400">Recherchez un produit pour l'ajouter au bon</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button fullWidth variant="secondary" icon={<ArrowLeft size={18} />} onClick={() => setStep(0)}>
              Précédent
            </Button>
            <Button fullWidth icon={<ArrowRight size={18} />} disabled={!step2Valid} onClick={() => setStep(2)}>
              Suivant
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Informations</h2>
            <div className="flex flex-col gap-1 text-sm text-gray-600">
              <div>
                Dépôt :{' '}
                <span className="font-medium text-gray-900">
                  {depots.find((d) => d.id === depotDestinationId)?.nom}
                </span>
              </div>
              <div>
                Fournisseur : <span className="font-medium text-gray-900">{fournisseur}</span>
              </div>
              <div>
                Canal :{' '}
                <span className="font-medium text-gray-900">
                  {CANAUX.find((c) => c.value === canal)?.label}
                </span>
              </div>
              {referenceDoc && (
                <div>
                  Référence : <span className="font-medium text-gray-900">{referenceDoc}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Articles</h2>
            <div className="flex flex-col gap-2">
              {lignesValides.map((l) => (
                <div key={l.produitId} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {l.nom} ({l.qteRecue} {l.unite})
                  </span>
                  <span className="font-medium text-gray-900">
                    {l.prixUnitaire ? `${Number(l.qteRecue) * Number(l.prixUnitaire)} GNF` : '-'}
                  </span>
                </div>
              ))}
            </div>
            {valeurTotale > 0 && (
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-sm font-semibold text-gray-900">
                <span>Total</span>
                <span>{valeurTotale} GNF</span>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-danger-600">{error}</p>}

          <div className="flex gap-3">
            <Button fullWidth variant="secondary" icon={<ArrowLeft size={18} />} onClick={() => setStep(1)}>
              Précédent
            </Button>
            <Button fullWidth onClick={handleSubmit} disabled={loading}>
              {loading ? 'Création...' : 'Confirmer la réception'}
            </Button>
          </div>
        </div>
      )}

      <CreateProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleProductCreated}
        initialNom={search}
      />
    </div>
  )
}
