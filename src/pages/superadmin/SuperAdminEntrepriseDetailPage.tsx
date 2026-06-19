import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Download, Upload, Users, History, BarChart3, Home } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { normaliserTelephone } from '../../lib/utils'
import { Button } from '../../components/ui/Button'
import { downloadTemplate1, downloadTemplate2, parseFichier1, parseFichier2 } from '../../lib/excelTemplates'
import { importerFichier1, importerFichier2 } from '../../lib/importOnboarding'
import type { Entreprise, Utilisateur } from '../../types'
import type { DepotRow, GestionnaireRow, ProduitStockRow } from '../../lib/excelTemplates'

type TabKey = 'apercu' | 'onboarding' | 'utilisateurs' | 'activite'

interface KPIs {
  nbDepots: number
  nbUtilisateurs: number
  nbProduits: number
  nbBonsMois: number
}

interface BonActivite {
  id: string
  numero: string
  statut: string
  created_at: string
  type: 'sortie' | 'reception'
}

// ── Composant : preview dépôts ───────────────────────────────
function DepotPreview({ rows }: { rows: DepotRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left text-gray-500">Statut</th>
            <th className="px-3 py-2 text-left text-gray-500">Nom du dépôt</th>
            <th className="px-3 py-2 text-left text-gray-500">Type</th>
            <th className="px-3 py-2 text-left text-gray-500">Localisation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i} className={r.valid ? '' : 'bg-red-50'}>
              <td className="px-3 py-2">
                {r.valid
                  ? <span className="text-green-600 font-bold">✓</span>
                  : <span className="text-red-500" title={r.errors.join(', ')}>⚠</span>}
              </td>
              <td className="px-3 py-2 font-medium text-gray-800">{r.nom || '(vide)'}</td>
              <td className="px-3 py-2 text-gray-600">{r.type}</td>
              <td className="px-3 py-2 text-gray-600">{r.localisation ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Composant : preview gestionnaires ───────────────────────
function GestionnairePreview({ rows }: { rows: GestionnaireRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {['', 'Prénom', 'Nom', 'Téléphone', 'Rôle', 'Dépôts'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i} className={r.valid ? '' : 'bg-red-50'}>
              <td className="px-3 py-2">
                {r.valid
                  ? <span className="text-green-600 font-bold">✓</span>
                  : <span className="text-red-500" title={r.errors.join(', ')}>⚠</span>}
              </td>
              <td className="px-3 py-2">{r.prenom}</td>
              <td className="px-3 py-2">{r.nom}</td>
              <td className="px-3 py-2 font-mono">{r.telephone}</td>
              <td className="px-3 py-2">{r.role}</td>
              <td className="px-3 py-2">{r.all_depots ? 'TOUS' : r.depots.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Composant : preview produits/stocks ─────────────────────
function ProduitPreview({ rows }: { rows: ProduitStockRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {['', 'Produit', 'Catégorie', 'Unité', 'Seuil A.', 'Seuil C.', 'Dépôt', 'Qté'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i} className={r.valid ? '' : 'bg-red-50'}>
              <td className="px-3 py-2">
                {r.valid
                  ? <span className="text-green-600 font-bold">✓</span>
                  : <span className="text-red-500" title={r.errors.join(', ')}>⚠</span>}
              </td>
              <td className="px-3 py-2 font-medium">{r.nom_produit}</td>
              <td className="px-3 py-2">{r.categorie}</td>
              <td className="px-3 py-2">{r.unite}</td>
              <td className="px-3 py-2">{r.seuil_alerte}</td>
              <td className="px-3 py-2">{r.seuil_critique}</td>
              <td className="px-3 py-2">{r.nom_depot}</td>
              <td className="px-3 py-2 font-semibold">{r.qte}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────
export function SuperAdminEntrepriseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('apercu')
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null)
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [bonsActivite, setBonsActivite] = useState<BonActivite[]>([])
  const [loadingPage, setLoadingPage] = useState(true)

  // Onboarding — étape 0 : propriétaire
  const [proprietaireExistant, setProprietaireExistant] = useState<{ nom: string } | null | false>(null)
  const [propForm, setPropForm] = useState({ prenom: '', nom: '', tel: '', pin: '' })
  const [propSaving, setPropSaving] = useState(false)
  const [propError, setPropError] = useState<string | null>(null)
  const [propCree, setPropCree] = useState<{ nom: string; pin: string } | null>(null)

  // Onboarding state
  const [step1Done, setStep1Done] = useState(false)
  const [parsing1, setParsing1] = useState(false)
  const [parsing2, setParsing2] = useState(false)
  const [importing1, setImporting1] = useState(false)
  const [importing2, setImporting2] = useState(false)
  const [parsed1, setParsed1] = useState<{ depots: DepotRow[]; gestionnaires: GestionnaireRow[] } | null>(null)
  const [parsed2, setParsed2] = useState<ProduitStockRow[] | null>(null)
  const [result1, setResult1] = useState<{ depotsCreés: number; gestCreés: number; erreurs: string[] } | null>(null)
  const [result2, setResult2] = useState<{ produitsCreés: number; stocksCreés: number; erreurs: string[] } | null>(null)
  const [parseError1, setParseError1] = useState<string | null>(null)
  const [parseError2, setParseError2] = useState<string | null>(null)
  const [depotsNoms, setDepotsNoms] = useState<string[]>([])

  const fileInput1Ref = useRef<HTMLInputElement>(null)
  const fileInput2Ref = useRef<HTMLInputElement>(null)

  const loadEntreprise = useCallback(async () => {
    if (!id) return
    setLoadingPage(true)
    const { data } = await supabase.from('entreprises').select('*').eq('id', id).single()
    if (data) setEntreprise(data as Entreprise)
    setLoadingPage(false)
  }, [id])

  const loadKpis = useCallback(async () => {
    if (!id) return
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [d, u, p, b] = await Promise.all([
      supabase.from('depots').select('id', { count: 'exact', head: true }).eq('entreprise_id', id).eq('actif', true),
      supabase.from('utilisateurs').select('id', { count: 'exact', head: true }).eq('entreprise_id', id).eq('actif', true).neq('role', 'superadmin'),
      supabase.from('produits').select('id', { count: 'exact', head: true }).eq('entreprise_id', id).eq('actif', true),
      supabase.from('bons_sortie').select('id', { count: 'exact', head: true }).eq('entreprise_id', id).gte('created_at', startOfMonth),
    ])

    setKpis({
      nbDepots: d.count ?? 0,
      nbUtilisateurs: u.count ?? 0,
      nbProduits: p.count ?? 0,
      nbBonsMois: b.count ?? 0,
    })
  }, [id])

  const loadUtilisateurs = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('utilisateurs')
      .select('id, nom, role, contact_wa, actif, all_depots')
      .eq('entreprise_id', id)
      .neq('role', 'superadmin')
      .order('nom')
    setUtilisateurs((data ?? []) as Utilisateur[])
  }, [id])

  const loadActivite = useCallback(async () => {
    if (!id) return
    const [sorties, receptions] = await Promise.all([
      supabase.from('bons_sortie').select('id, numero, statut, created_at').eq('entreprise_id', id).order('created_at', { ascending: false }).limit(25),
      supabase.from('bons_reception').select('id, numero, statut, created_at').eq('entreprise_id', id).order('created_at', { ascending: false }).limit(25),
    ])
    const all: BonActivite[] = [
      ...((sorties.data ?? []) as BonActivite[]).map((b) => ({ ...b, type: 'sortie' as const })),
      ...((receptions.data ?? []) as BonActivite[]).map((r) => ({ ...r, type: 'reception' as const })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50)
    setBonsActivite(all)
  }, [id])

  useEffect(() => {
    loadEntreprise()
    loadKpis()
  }, [loadEntreprise, loadKpis])

  useEffect(() => {
    if (tab === 'utilisateurs') loadUtilisateurs()
    if (tab === 'activite') loadActivite()
    if (tab === 'onboarding' && id && proprietaireExistant === null) {
      supabase
        .from('utilisateurs')
        .select('nom')
        .eq('entreprise_id', id)
        .eq('role', 'proprietaire')
        .eq('actif', true)
        .maybeSingle()
        .then(({ data }) => setProprietaireExistant(data ? { nom: (data as { nom: string }).nom } : false))
    }
  }, [tab, loadUtilisateurs, loadActivite, id, proprietaireExistant])

  // Charger les dépôts existants quand step1 est terminé (pour le template 2)
  useEffect(() => {
    if (!step1Done || !id) return
    supabase.from('depots').select('nom').eq('entreprise_id', id).eq('actif', true)
      .then(({ data }) => {
        if (data) setDepotsNoms((data as { nom: string }[]).map((d) => d.nom))
      })
  }, [step1Done, id])

  const handleFile1 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing1(true)
    setParseError1(null)
    setParsed1(null)
    setResult1(null)
    try {
      const result = await parseFichier1(file)
      setParsed1(result)
    } catch (err) {
      setParseError1(err instanceof Error ? err.message : 'Erreur de lecture du fichier')
    }
    setParsing1(false)
    if (fileInput1Ref.current) fileInput1Ref.current.value = ''
  }

  const handleFile2 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing2(true)
    setParseError2(null)
    setParsed2(null)
    setResult2(null)
    try {
      const rows = await parseFichier2(file)
      setParsed2(rows)
    } catch (err) {
      setParseError2(err instanceof Error ? err.message : 'Erreur de lecture du fichier')
    }
    setParsing2(false)
    if (fileInput2Ref.current) fileInput2Ref.current.value = ''
  }

  const handleImport1 = async () => {
    if (!parsed1 || !id) return
    setImporting1(true)
    const res = await importerFichier1(id, parsed1.depots, parsed1.gestionnaires)
    setResult1(res)
    setImporting1(false)
    if (res.depotsCreés > 0 || res.gestCreés > 0) {
      setStep1Done(true)
      loadKpis()
    }
  }

  const handleImport2 = async () => {
    if (!parsed2 || !id) return
    setImporting2(true)
    const res = await importerFichier2(id, parsed2)
    setResult2(res)
    setImporting2(false)
    if (res.stocksCreés > 0) loadKpis()
  }

  const handleCreerProprietaire = async () => {
    if (!id) return
    const { prenom, nom, tel, pin } = propForm
    if (!prenom.trim() || !nom.trim()) { setPropError('Prénom et nom requis'); return }
    if (!tel.trim()) { setPropError('Le numéro de téléphone est requis'); return }
    if (!/^\d{4}$/.test(pin)) { setPropError('Le PIN doit être exactement 4 chiffres'); return }
    setPropSaving(true)
    setPropError(null)
    const { error } = await supabase.rpc('creer_proprietaire', {
      p_prenom: prenom.trim(),
      p_nom: nom.trim(),
      p_tel: normaliserTelephone(tel.trim()),
      p_code_pin: pin,
      p_entreprise_id: id,
    })
    setPropSaving(false)
    if (error) {
      setPropError(error.message === 'NUMERO_DEJA_UTILISE' ? 'Ce numéro est déjà utilisé par un autre compte de cette entreprise' : error.message)
      return
    }
    const nomComplet = `${prenom.trim()} ${nom.trim()}`
    setPropCree({ nom: nomComplet, pin })
    setProprietaireExistant({ nom: nomComplet })
    loadKpis()
  }

  const handleToggleUser = async (u: Utilisateur) => {
    await supabase.rpc('toggle_utilisateur_actif', { p_user_id: u.id, p_actif: !u.actif })
    loadUtilisateurs()
  }

  const handleResetPin = async (u: Utilisateur) => {
    await supabase.rpc('reinitialiser_pin', { p_user_id: u.id })
  }

  if (loadingPage) return <div className="p-8 text-center text-gray-400">Chargement…</div>
  if (!entreprise) return <div className="p-8 text-center text-red-500">Entreprise introuvable</div>

  const TABS = [
    { key: 'apercu' as const, label: 'Aperçu', icon: Home },
    { key: 'onboarding' as const, label: 'Onboarding', icon: Upload },
    { key: 'utilisateurs' as const, label: 'Utilisateurs', icon: Users },
    { key: 'activite' as const, label: 'Activité', icon: History },
  ]

  const STATUT_COLORS: Record<string, string> = {
    actif: 'bg-green-100 text-green-700',
    essai: 'bg-amber-100 text-amber-700',
    suspendu: 'bg-red-100 text-red-700',
    supprime: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate('/superadmin/entreprises')} className="rounded-lg p-2 hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{entreprise.nom}</h1>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600">{entreprise.code}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUT_COLORS[entreprise.statut] ?? 'bg-gray-100 text-gray-500'}`}>
              {entreprise.statut}
            </span>
          </div>
          {entreprise.contact_nom && (
            <p className="mt-0.5 text-sm text-gray-500">{entreprise.contact_nom}{entreprise.contact_tel ? ` · ${entreprise.contact_tel}` : ''}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab : Aperçu */}
      {tab === 'apercu' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpis && [
              { label: 'Dépôts', value: kpis.nbDepots },
              { label: 'Utilisateurs', value: kpis.nbUtilisateurs },
              { label: 'Produits', value: kpis.nbProduits },
              { label: 'Bons ce mois', value: kpis.nbBonsMois },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-500">{k.label}</p>
                <p className="text-3xl font-bold text-gray-900">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Informations</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Nom', entreprise.nom],
                ['Code', entreprise.code],
                ['Statut', entreprise.statut],
                ['Créé le', new Date(entreprise.created_at).toLocaleDateString('fr-FR')],
                ['Contact', entreprise.contact_nom ?? '—'],
                ['Téléphone', entreprise.contact_tel ?? '—'],
                ['Email', entreprise.contact_email ?? '—'],
                ['Adresse', entreprise.adresse ?? '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-medium text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {/* Tab : Onboarding */}
      {tab === 'onboarding' && (
        <div className="space-y-8 max-w-3xl">

          {/* Étape 0 : Propriétaire */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${proprietaireExistant ? 'bg-green-100 text-green-700' : 'bg-brand-100 text-brand-700'}`}>
                {proprietaireExistant ? <Check size={16} /> : '0'}
              </div>
              <h2 className="text-base font-semibold text-gray-900">Compte propriétaire</h2>
              {proprietaireExistant && (
                <span className="text-xs text-green-600 font-medium">Créé</span>
              )}
            </div>

            {proprietaireExistant ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-sm font-medium text-green-800">
                  ✓ Propriétaire : <span className="font-bold">{proprietaireExistant.nom}</span>
                </p>
                {propCree && (
                  <p className="mt-1 text-xs text-green-700">
                    Identifiants à communiquer — Nom : <strong>{propCree.nom}</strong> · PIN : <strong className="font-mono">{propCree.pin}</strong>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Créez le compte du propriétaire de cette entreprise. Il pourra ensuite se connecter sur <span className="font-mono text-gray-700">/login</span>.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Prénom *</label>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                      value={propForm.prenom}
                      onChange={(e) => setPropForm((f) => ({ ...f, prenom: e.target.value }))}
                      placeholder="Mamadou"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                      value={propForm.nom}
                      onChange={(e) => setPropForm((f) => ({ ...f, nom: e.target.value }))}
                      placeholder="Diallo"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone *</label>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-brand-400 focus:outline-none"
                      value={propForm.tel}
                      onChange={(e) => setPropForm((f) => ({ ...f, tel: e.target.value }))}
                      placeholder="6xx xxx xxx"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">PIN initial (4 chiffres) *</label>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono tracking-widest focus:border-brand-400 focus:outline-none"
                      value={propForm.pin}
                      onChange={(e) => setPropForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="1234"
                      maxLength={4}
                    />
                  </div>
                </div>
                {propError && <p className="text-sm text-red-600">{propError}</p>}
                <Button onClick={handleCreerProprietaire} disabled={propSaving}>
                  {propSaving ? 'Création…' : 'Créer le compte propriétaire'}
                </Button>
              </div>
            )}
          </div>

          {/* Step 1 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step1Done ? 'bg-green-100 text-green-700' : 'bg-brand-100 text-brand-700'}`}>
                {step1Done ? <Check size={16} /> : '1'}
              </div>
              <h2 className="text-base font-semibold text-gray-900">Dépôts &amp; Gestionnaires</h2>
              {step1Done && <span className="text-xs text-green-600 font-medium">Terminé</span>}
            </div>

            <div className="mb-4">
              <Button variant="secondary" onClick={downloadTemplate1}>
                <Download size={15} className="mr-1.5" />
                Télécharger le modèle Excel
              </Button>
            </div>

            <div
              className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 hover:border-brand-300 hover:bg-brand-50 transition-colors"
              onClick={() => fileInput1Ref.current?.click()}
            >
              <Upload size={24} className="text-gray-400" />
              <p className="text-sm text-gray-600">Cliquer pour choisir le fichier Excel</p>
              <p className="text-xs text-gray-400">modele_depots_gestionnaires.xlsx</p>
              <input ref={fileInput1Ref} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile1} />
            </div>

            {parsing1 && <p className="text-sm text-gray-500">Lecture du fichier…</p>}
            {parseError1 && <p className="text-sm text-red-600">{parseError1}</p>}

            {parsed1 && !result1 && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">Dépôts — {parsed1.depots.length} ligne(s)</p>
                  <DepotPreview rows={parsed1.depots} />
                  {parsed1.depots.some((r) => !r.valid) && (
                    <div className="mt-2 space-y-1">
                      {parsed1.depots.flatMap((r, i) => r.errors.map((e) => (
                        <p key={`d-${i}-${e}`} className="text-xs text-red-600">Ligne {i + 2} (Dépôts): {e}</p>
                      )))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">Gestionnaires — {parsed1.gestionnaires.length} ligne(s)</p>
                  <GestionnairePreview rows={parsed1.gestionnaires} />
                  {parsed1.gestionnaires.some((r) => !r.valid) && (
                    <div className="mt-2 space-y-1">
                      {parsed1.gestionnaires.flatMap((r, i) => r.errors.map((e) => (
                        <p key={`g-${i}-${e}`} className="text-xs text-red-600">Ligne {i + 2} (Gestionnaires): {e}</p>
                      )))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setParsed1(null)}>Annuler</Button>
                  <Button onClick={handleImport1} disabled={importing1}>
                    {importing1 ? 'Import en cours…' : 'Confirmer l\'import'}
                  </Button>
                </div>
              </div>
            )}

            {result1 && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-sm font-medium text-green-800">
                  ✓ {result1.depotsCreés} dépôt(s) créé(s) · ✓ {result1.gestCreés} gestionnaire(s) créé(s)
                  {result1.erreurs.length > 0 && ` · ⚠ ${result1.erreurs.length} erreur(s)`}
                </p>
                {result1.erreurs.map((e, i) => (
                  <p key={i} className="mt-1 text-xs text-red-600">{e}</p>
                ))}
              </div>
            )}
          </div>

          {/* Step 2 */}
          <div className={`rounded-xl border border-gray-200 bg-white p-6 ${!step1Done ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${result2 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {result2 ? <Check size={16} /> : '2'}
              </div>
              <h2 className="text-base font-semibold text-gray-900">Produits &amp; Stocks</h2>
              {!step1Done && <span className="text-xs text-gray-400">(Disponible après l'étape 1)</span>}
            </div>

            {step1Done && (
              <>
                <div className="mb-4">
                  <Button variant="secondary" onClick={() => downloadTemplate2(depotsNoms)} disabled={depotsNoms.length === 0}>
                    <Download size={15} className="mr-1.5" />
                    Télécharger le modèle Excel
                  </Button>
                </div>

                <div
                  className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                  onClick={() => fileInput2Ref.current?.click()}
                >
                  <Upload size={24} className="text-gray-400" />
                  <p className="text-sm text-gray-600">Cliquer pour choisir le fichier Excel</p>
                  <p className="text-xs text-gray-400">modele_produits_stocks.xlsx</p>
                  <input ref={fileInput2Ref} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile2} />
                </div>

                {parsing2 && <p className="text-sm text-gray-500">Lecture du fichier…</p>}
                {parseError2 && <p className="text-sm text-red-600">{parseError2}</p>}

                {parsed2 && !result2 && (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-medium text-gray-700">Produits &amp; Stocks — {parsed2.length} ligne(s)</p>
                      <ProduitPreview rows={parsed2} />
                      {parsed2.some((r) => !r.valid) && (
                        <div className="mt-2 space-y-1">
                          {parsed2.flatMap((r, i) => r.errors.map((e) => (
                            <p key={`p-${i}-${e}`} className="text-xs text-red-600">Ligne {i + 2}: {e}</p>
                          )))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <Button variant="secondary" onClick={() => setParsed2(null)}>Annuler</Button>
                      <Button onClick={handleImport2} disabled={importing2}>
                        {importing2 ? 'Import en cours…' : 'Confirmer l\'import'}
                      </Button>
                    </div>
                  </div>
                )}

                {result2 && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                    <p className="text-sm font-medium text-green-800">
                      ✓ {result2.produitsCreés} produit(s) créé(s) · ✓ {result2.stocksCreés} entrée(s) stock créée(s)
                      {result2.erreurs.length > 0 && ` · ⚠ ${result2.erreurs.length} erreur(s)`}
                    </p>
                    {result2.erreurs.map((e, i) => (
                      <p key={i} className="mt-1 text-xs text-red-600">{e}</p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab : Utilisateurs */}
      {tab === 'utilisateurs' && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {utilisateurs.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Aucun utilisateur</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Nom', 'Rôle', 'Téléphone', 'Statut', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {utilisateurs.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.nom}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize">{u.role}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600">{u.contact_wa ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleUser(u)}
                          className="text-xs text-gray-500 hover:text-gray-800 underline"
                        >
                          {u.actif ? 'Désactiver' : 'Activer'}
                        </button>
                        <button
                          onClick={() => handleResetPin(u)}
                          className="text-xs text-brand-600 hover:text-brand-800 underline"
                        >
                          Réinit. PIN
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab : Activité */}
      {tab === 'activite' && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {bonsActivite.length === 0 ? (
            <div className="p-8 text-center">
              <BarChart3 size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-gray-400">Aucune activité</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Type', 'Numéro', 'Statut', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bonsActivite.map((b) => (
                  <tr key={`${b.type}-${b.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.type === 'sortie' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                        {b.type === 'sortie' ? 'Sortie' : 'Réception'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{b.numero}</td>
                    <td className="px-4 py-3 capitalize text-gray-600">{b.statut.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(b.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
