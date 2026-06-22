import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useReceptions } from '../hooks/useReceptions'
import { useAppStore } from '../stores/appStore'
import { Button } from '../components/ui/Button'
import { CATEGORIES_PRODUIT, UNITES_PRODUIT } from '../lib/produits'
import type { CanalAppro, Produit } from '../types'

const CANAUX: { value: CanalAppro; label: string; icon: string }[] = [
  { value: 'presentiel', label: 'Présentiel', icon: '🤝' },
  { value: 'appel', label: 'Appel', icon: '📞' },
  { value: 'app_mobile', label: 'App mobile', icon: '📱' },
  { value: 'conteneur', label: 'Conteneur', icon: '🚢' },
]

const STEPS = ['Fournisseur', 'Articles', 'Résumé']

const INPUT_CLASS =
  'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none'

interface LigneForm {
  produitId: string
  nom: string
  unite: string
  qteRecue: number
  prixUnitaire: number
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
  const [lignes, setLignes] = useState<LigneForm[]>([])

  const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null)
  const [stagingQteStr, setStagingQteStr] = useState('1')
  const stagingQte = parseInt(stagingQteStr, 10) || 0
  const [stagingPrix, setStagingPrix] = useState('')

  const [creatingProduct, setCreatingProduct] = useState(false)
  const [newProductNom, setNewProductNom] = useState('')
  const [newProductCategorie, setNewProductCategorie] = useState('')
  const [newProductUnite, setNewProductUnite] = useState('')
  const [newProductSeuilAlerte, setNewProductSeuilAlerte] = useState('10')
  const [newProductSeuilCritique, setNewProductSeuilCritique] = useState('5')
  const [creatingProductError, setCreatingProductError] = useState<string | null>(null)
  const [creatingProductLoading, setCreatingProductLoading] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [numeroCree, setNumeroCree] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('produits')
      .select('*')
      .eq('actif', true)
      .order('nom')
      .then(({ data }) => setProduits((data ?? []) as Produit[]))
  }, [])

  const resultats = produits.filter((p) => p.nom.toLowerCase().includes(search.toLowerCase()))

  const removeLigne = (index: number) => setLignes((prev) => prev.filter((_, i) => i !== index))

  const handleSelectProduit = (p: Produit) => {
    setSelectedProduit(p)
    setSearch('')
    setStagingQteStr('1')
    setStagingPrix('')
  }

  const handleAjouterLigne = () => {
    if (!selectedProduit) return
    setLignes((prev) => [
      ...prev,
      {
        produitId: selectedProduit.id,
        nom: selectedProduit.nom,
        unite: selectedProduit.unite,
        qteRecue: stagingQte,
        prixUnitaire: Number(stagingPrix) || 0,
      },
    ])
    setSelectedProduit(null)
    setStagingQteStr('1')
    setStagingPrix('')
  }

  const handleCreateProductInline = async () => {
    if (!newProductNom.trim() || !newProductCategorie || !newProductUnite) {
      setCreatingProductError('Nom, catégorie et unité sont obligatoires')
      return
    }

    setCreatingProductLoading(true)
    setCreatingProductError(null)

    const { data: produit, error: err } = await supabase
      .from('produits')
      .insert({
        nom: newProductNom.trim(),
        categorie: newProductCategorie,
        unite: newProductUnite,
        actif: true,
      })
      .select()
      .single()

    if (err || !produit) {
      setCreatingProductLoading(false)
      setCreatingProductError(err?.message ?? 'Erreur lors de la création du produit')
      return
    }

    if (depotDestinationId) {
      await supabase.from('stock_produits').insert({
        depot_id: depotDestinationId,
        produit_id: produit.id,
        qte_disponible: 0,
        seuil_alerte: Number(newProductSeuilAlerte) || 10,
        seuil_critique: Number(newProductSeuilCritique) || 5,
      })
    }

    setCreatingProductLoading(false)
    setProduits((prev) => [...prev, produit as Produit])
    setSelectedProduit(produit as Produit)
    setStagingQteStr('1')
    setStagingPrix('')
    setCreatingProduct(false)
    setSearch('')
    setNewProductNom('')
    setNewProductCategorie('')
    setNewProductUnite('')
    setNewProductSeuilAlerte('10')
    setNewProductSeuilCritique('5')
  }

  const valeurTotale = lignes.reduce((total, l) => total + l.qteRecue * l.prixUnitaire, 0)

  const step1Valid = !!fournisseur.trim() && !!depotDestinationId
  const step2Valid = lignes.length > 0

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    const result = await creerReception({
      depotId: depotDestinationId,
      fournisseur: fournisseur.trim(),
      canal,
      referenceDoc: referenceDoc.trim() || undefined,
      lignes: lignes.map((l) => ({
        produitId: l.produitId,
        qteRecue: l.qteRecue,
        prixAchatUnitaire: l.prixUnitaire,
      })),
    })

    setLoading(false)

    if (!result.success || !result.numero) {
      setError(result.error ?? 'Erreur lors de la création de la réception')
      return
    }

    setNumeroCree(result.numero)
  }

  if (numeroCree) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-800">
          <CheckCircle2 size={36} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">✓ Réception {numeroCree} soumise</h1>
        <p className="text-sm text-gray-500">En attente de validation</p>

        <Button fullWidth className="mt-4" onClick={() => navigate('/')}>
          Retour à l'accueil
        </Button>
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
            Fournisseur
            <input
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Nom du fournisseur"
            />
          </label>

          <div>
            <span className="mb-2 block text-sm font-medium text-gray-700">Canal</span>
            <div className="grid grid-cols-4 gap-2">
              {CANAUX.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCanal(c.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 py-2 text-center transition-colors ${
                    canal === c.value
                      ? 'border-brand-400 bg-brand-50 text-brand-800'
                      : 'border-transparent bg-white text-gray-600 shadow-sm'
                  }`}
                >
                  <span className="text-xl">{c.icon}</span>
                  <span className="text-[11px] font-medium leading-tight">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="text-sm font-medium text-gray-700">
            Dépôt destination
            <select
              value={depotDestinationId}
              onChange={(e) => setDepotDestinationId(e.target.value)}
              className={INPUT_CLASS}
            >
              {depots.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Référence document
            <input
              value={referenceDoc}
              onChange={(e) => setReferenceDoc(e.target.value)}
              className={INPUT_CLASS}
              placeholder="N° facture ou bon de livraison"
            />
          </label>

          <Button fullWidth icon={<ArrowRight size={18} />} disabled={!step1Valid} onClick={() => setStep(1)}>
            Suivant
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700">Articles reçus</h2>

            {lignes.map((ligne, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{ligne.nom}</div>
                  <div className="text-xs text-gray-400">
                    {ligne.qteRecue} {ligne.unite} × {ligne.prixUnitaire.toLocaleString()} GNF
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {(ligne.qteRecue * ligne.prixUnitaire).toLocaleString()} GNF
                </div>
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

            {lignes.length === 0 && <p className="text-sm text-gray-400">Aucun article ajouté</p>}
          </div>

          {!selectedProduit && !creatingProduct && (
            <div>
              <span className="mb-1 block text-sm font-medium text-gray-700">Ajouter un article</span>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-brand-400">
                <Search size={16} className="text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="w-full text-sm focus:outline-none"
                />
              </div>

              {search && (
                resultats.length > 0 ? (
                  <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-100 bg-white py-1 shadow-sm">
                    {resultats.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProduit(p)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-brand-50"
                      >
                        {p.nom}
                        <span className="text-xs text-gray-400">{p.unite}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 rounded-xl border border-dashed border-gray-200 p-3 text-center">
                    <p className="text-sm font-medium text-gray-700">« {search} » introuvable</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Ce produit n'existe pas encore dans le catalogue
                    </p>
                    <Button
                      size="sm"
                      className="mt-2"
                      icon={<Plus size={14} />}
                      onClick={() => {
                        setCreatingProduct(true)
                        setNewProductNom(search)
                      }}
                    >
                      Créer « {search} »
                    </Button>
                  </div>
                )
              )}
            </div>
          )}

          {creatingProduct && (
            <div className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-white p-3 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">Nouveau produit</h3>

              <label className="text-sm font-medium text-gray-700">
                Nom
                <input
                  value={newProductNom}
                  onChange={(e) => setNewProductNom(e.target.value)}
                  className={INPUT_CLASS}
                />
              </label>

              <label className="text-sm font-medium text-gray-700">
                Catégorie
                <select
                  value={newProductCategorie}
                  onChange={(e) => setNewProductCategorie(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="">Sélectionner...</option>
                  {CATEGORIES_PRODUIT.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-gray-700">
                Unité
                <select
                  value={newProductUnite}
                  onChange={(e) => setNewProductUnite(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="">Sélectionner...</option>
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
                    min="0"
                    value={newProductSeuilAlerte}
                    onChange={(e) => setNewProductSeuilAlerte(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className="flex-1 text-sm font-medium text-gray-700">
                  Seuil critique
                  <input
                    type="number"
                    min="0"
                    value={newProductSeuilCritique}
                    onChange={(e) => setNewProductSeuilCritique(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>

              <p className="text-xs text-amber-600">⚡ Créé immédiatement sans validation</p>

              {creatingProductError && <p className="text-sm text-danger-600">{creatingProductError}</p>}

              <div className="flex gap-3">
                <Button
                  fullWidth
                  variant="ghost"
                  onClick={() => {
                    setCreatingProduct(false)
                    setCreatingProductError(null)
                  }}
                  disabled={creatingProductLoading}
                >
                  Annuler
                </Button>
                <Button fullWidth onClick={handleCreateProductInline} disabled={creatingProductLoading}>
                  {creatingProductLoading ? 'Création...' : 'Créer le produit'}
                </Button>
              </div>
            </div>
          )}

          {selectedProduit && !creatingProduct && (
            <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">✓ {selectedProduit.nom}</h3>
                <button
                  type="button"
                  onClick={() => setSelectedProduit(null)}
                  className="text-xs font-medium text-gray-400 hover:text-gray-600"
                >
                  Changer
                </button>
              </div>

              <div>
                <span className="mb-1 block text-sm font-medium text-gray-700">Quantité reçue</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Diminuer la quantité"
                    onClick={() => setStagingQteStr(String(Math.max(1, stagingQte - 1)))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    aria-label="Quantité reçue"
                    value={stagingQteStr}
                    onChange={(e) => setStagingQteStr(e.target.value.replace(/[^\d]/g, ''))}
                    className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-center text-sm focus:border-brand-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Augmenter la quantité"
                    onClick={() => setStagingQteStr(String(stagingQte + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700"
                  >
                    <Plus size={16} />
                  </button>
                  <span className="text-sm text-gray-500">{selectedProduit.unite}</span>
                </div>
              </div>

              <label className="text-sm font-medium text-gray-700">
                Prix achat unitaire (GNF)
                <input
                  type="number"
                  min="0"
                  value={stagingPrix}
                  onChange={(e) => setStagingPrix(e.target.value)}
                  placeholder="0"
                  className={INPUT_CLASS}
                />
              </label>

              <div className="text-right text-sm font-semibold text-gray-900">
                Total : {(stagingQte * (Number(stagingPrix) || 0)).toLocaleString()} GNF
              </div>

              <Button fullWidth icon={<Plus size={18} />} disabled={stagingQte <= 0 || !(Number(stagingPrix) > 0)} onClick={handleAjouterLigne}>
                Ajouter à la réception
              </Button>
            </div>
          )}

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
                  {CANAUX.find((c) => c.value === canal)?.icon} {CANAUX.find((c) => c.value === canal)?.label}
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
              {lignes.map((l) => (
                <div key={l.produitId} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="text-gray-700">{l.nom}</div>
                    <div className="text-xs text-gray-400">
                      {l.qteRecue} {l.unite} × {l.prixUnitaire.toLocaleString()} GNF
                    </div>
                  </div>
                  <span className="font-medium text-gray-900">
                    {(l.qteRecue * l.prixUnitaire).toLocaleString()} GNF
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-sm font-semibold text-gray-900">
              <span>Total</span>
              <span>{valeurTotale.toLocaleString()} GNF</span>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-600">
            <span>⏳</span>
            <span>Le stock sera crédité après validation du propriétaire.</span>
          </div>

          {error && <p className="text-sm text-danger-600">{error}</p>}

          <div className="flex flex-col gap-3">
            <Button fullWidth onClick={handleSubmit} disabled={loading}>
              {loading ? 'Envoi...' : 'Soumettre pour validation'}
            </Button>
            <Button fullWidth variant="secondary" icon={<ArrowLeft size={18} />} onClick={() => setStep(1)} disabled={loading}>
              Précédent
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
