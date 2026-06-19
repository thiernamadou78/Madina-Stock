import { useCallback, useEffect, useState } from 'react'
import { Building2, Check, KeyRound, Pencil, Plus, Power } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { normaliserTelephone } from '../lib/utils'
import type { Depot, Role } from '../types'

const TEL_VALIDE_REGEX = /^\+224\d{9}$/

const INPUT_CLASS =
  'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-base focus:border-brand-400 focus:outline-none'

const AVATAR_COLORS = [
  'bg-brand-100 text-brand-800',
  'bg-blue-100 text-blue-800',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
]

const ROLE_LABELS: Record<string, string> = {
  gestionnaire: 'Gestionnaire',
  responsable: 'Responsable',
}

interface GestionnaireRow {
  id: string
  nom: string
  role: Role
  contact_wa: string | null
  actif: boolean
  all_depots: boolean
  depotIds: string[]
}

interface GestionnaireForm {
  prenom: string
  nom: string
  tel: string
  role: 'gestionnaire' | 'responsable'
  allDepots: boolean
  depotIds: string[]
}

const EMPTY_FORM: GestionnaireForm = {
  prenom: '',
  nom: '',
  tel: '',
  role: 'gestionnaire',
  allDepots: false,
  depotIds: [],
}

function initiales(nom: string): string {
  const parts = nom.trim().split(/\s+/)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

function avatarColor(id: string): string {
  let hash = 0
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[hash]
}

export function UsersPage() {
  const user = useAppStore((s) => s.user)
  const [gestionnaires, setGestionnaires] = useState<GestionnaireRow[]>([])
  const [depots, setDepots] = useState<Depot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sheet, setSheet] = useState<'gestionnaire' | 'depot' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<GestionnaireForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pinResetId, setPinResetId] = useState<string | null>(null)

  const [depotForm, setDepotForm] = useState<{ nom: string; type: Depot['type']; localisation: string }>({
    nom: '',
    type: 'secondaire',
    localisation: '',
  })
  const [depotFormError, setDepotFormError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const entrepriseId = user?.entreprise_id ?? ''

    const [usersRes, depotsRes, liaisonsRes] = await Promise.all([
      supabase
        .from('utilisateurs')
        .select('id, nom, role, contact_wa, actif, all_depots')
        .in('role', ['gestionnaire', 'responsable'])
        .eq('entreprise_id', entrepriseId)
        .order('nom'),
      supabase.from('depots').select('*').eq('actif', true).eq('entreprise_id', entrepriseId).order('nom'),
      supabase.from('utilisateurs_depots').select('utilisateur_id, depot_id'),
    ])

    if (usersRes.error || depotsRes.error || liaisonsRes.error) {
      setError('Impossible de charger les utilisateurs')
      setLoading(false)
      return
    }

    const liaisons = (liaisonsRes.data ?? []) as { utilisateur_id: string; depot_id: string }[]

    const rows: GestionnaireRow[] = ((usersRes.data ?? []) as unknown as Array<{
      id: string
      nom: string
      role: Role
      contact_wa: string | null
      actif: boolean
      all_depots: boolean | null
    }>).map((u) => ({
      ...u,
      all_depots: u.all_depots ?? false,
      depotIds: liaisons.filter((l) => l.utilisateur_id === u.id).map((l) => l.depot_id),
    }))

    setGestionnaires(rows)
    setDepots((depotsRes.data ?? []) as Depot[])
    setLoading(false)
  }, [user?.entreprise_id])

  useEffect(() => {
    refresh()
  }, [refresh])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setSheet('gestionnaire')
  }

  const openEdit = (g: GestionnaireRow) => {
    const [prenom, ...reste] = g.nom.trim().split(/\s+/)
    setEditingId(g.id)
    setForm({
      prenom: prenom ?? '',
      nom: reste.join(' '),
      tel: g.contact_wa ?? '',
      role: g.role === 'responsable' ? 'responsable' : 'gestionnaire',
      allDepots: g.all_depots,
      depotIds: g.depotIds,
    })
    setFormError(null)
    setSheet('gestionnaire')
  }

  const closeSheet = () => {
    setSheet(null)
    setEditingId(null)
  }

  const toggleDepotForm = (depotId: string) => {
    setForm((f) => ({
      ...f,
      depotIds: f.depotIds.includes(depotId)
        ? f.depotIds.filter((id) => id !== depotId)
        : [...f.depotIds, depotId],
    }))
  }

  const handleSaveGestionnaire = async () => {
    setFormError(null)

    if (form.prenom.trim().length < 2) {
      setFormError('Le prénom doit contenir au moins 2 caractères')
      return
    }
    const telNormalise = normaliserTelephone(form.tel.trim())
    if (!TEL_VALIDE_REGEX.test(telNormalise)) {
      setFormError('Numéro de téléphone invalide')
      return
    }
    if (!form.allDepots && form.depotIds.length === 0) {
      setFormError('Sélectionnez au moins un dépôt, ou activez "Tous les stocks"')
      return
    }

    setSaving(true)

    const { error: err } = editingId
      ? await supabase.rpc('modifier_gestionnaire', {
          p_user_id: editingId,
          p_nom: `${form.prenom} ${form.nom}`.trim(),
          p_tel: telNormalise,
          p_role: form.role,
          p_depot_ids: form.depotIds,
          p_all_depots: form.allDepots,
        })
      : await supabase.rpc('creer_gestionnaire', {
          p_prenom: form.prenom.trim(),
          p_nom: form.nom.trim(),
          p_tel: telNormalise,
          p_role: form.role,
          p_depot_ids: form.depotIds,
          p_all_depots: form.allDepots,
          p_entreprise_id: user?.entreprise_id ?? null,
        })

    setSaving(false)

    if (err) {
      setFormError(err.message === 'NUMERO_DEJA_UTILISE' ? 'Ce numéro est déjà utilisé par un autre compte' : err.message)
      return
    }

    closeSheet()
    await refresh()
  }

  const handleToggleActif = async (g: GestionnaireRow) => {
    await supabase.rpc('toggle_utilisateur_actif', { p_user_id: g.id, p_actif: !g.actif })
    await refresh()
  }

  const handleResetPin = async (g: GestionnaireRow) => {
    await supabase.rpc('reinitialiser_pin', { p_user_id: g.id })
    setPinResetId(g.id)
    setTimeout(() => setPinResetId(null), 3000)
  }

  const openDepotSheet = () => {
    setDepotForm({ nom: '', type: 'secondaire', localisation: '' })
    setDepotFormError(null)
    setSheet('depot')
  }

  const handleSaveDepot = async () => {
    if (depotForm.nom.trim().length < 2) {
      setDepotFormError('Le nom du dépôt doit contenir au moins 2 caractères')
      return
    }

    setSaving(true)
    const { error: err } = await supabase.rpc('creer_depot', {
      p_nom: depotForm.nom.trim(),
      p_type: depotForm.type,
      p_localisation: depotForm.localisation.trim() || null,
      p_entreprise_id: user?.entreprise_id ?? null,
    })
    setSaving(false)

    if (err) {
      setDepotFormError(err.message)
      return
    }

    setSheet(null)
    await refresh()
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      <h1 className="text-lg font-bold text-gray-900">Utilisateurs</h1>

      {error && <p className="text-sm text-danger-600">{error}</p>}
      {loading && <p className="text-sm text-gray-400">Chargement...</p>}

      <div className="flex flex-col gap-3">
        {gestionnaires.map((g) => (
          <div key={g.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarColor(g.id)}`}
                >
                  {initiales(g.nom)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{g.nom}</p>
                  <p className="text-xs text-gray-500">{g.contact_wa ?? '—'}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-brand-50 px-2 py-1 text-xs font-medium text-brand-800">
                {ROLE_LABELS[g.role] ?? g.role}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {g.all_depots ? (
                <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                  Tous les stocks
                </span>
              ) : g.depotIds.length === 0 ? (
                <span className="text-xs text-gray-400">Aucun dépôt assigné</span>
              ) : (
                depots
                  .filter((d) => g.depotIds.includes(d.id))
                  .map((d) => (
                    <span key={d.id} className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      {d.nom}
                    </span>
                  ))
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleToggleActif(g)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  g.actif ? 'bg-brand-50 text-brand-800' : 'bg-gray-100 text-gray-400'
                }`}
              >
                <Power size={14} />
                {g.actif ? 'Actif' : 'Inactif'}
              </button>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => openEdit(g)}>
                  Modifier
                </Button>
                <Button size="sm" variant="ghost" icon={<KeyRound size={14} />} onClick={() => handleResetPin(g)}>
                  {pinResetId === g.id ? 'PIN réinitialisé' : 'Réinitialiser PIN'}
                </Button>
              </div>
            </div>
          </div>
        ))}

        {!loading && gestionnaires.length === 0 && (
          <p className="text-sm text-gray-400">Aucun gestionnaire pour le moment</p>
        )}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Dépôts</h2>
          <Button size="sm" variant="secondary" icon={<Building2 size={14} />} onClick={openDepotSheet}>
            Nouveau dépôt
          </Button>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {depots.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{d.nom}</span>
              <span className="text-xs text-gray-400">{d.type === 'principal' ? 'Principal' : 'Secondaire'}</span>
            </div>
          ))}
          {depots.length === 0 && <p className="text-sm text-gray-400">Aucun dépôt</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={openCreate}
        aria-label="Nouveau gestionnaire"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-800 text-white shadow-lg"
      >
        <Plus size={24} />
      </button>

      <Modal
        isOpen={sheet === 'gestionnaire'}
        onClose={closeSheet}
        title={editingId ? 'Modifier le gestionnaire' : 'Nouveau gestionnaire'}
      >
        <div className="flex flex-col gap-3 pb-4">
          {editingId ? (
            <label className="text-sm font-medium text-gray-700">
              Nom complet
              <input
                type="text"
                value={`${form.prenom} ${form.nom}`.trim()}
                onChange={(e) => {
                  const [prenom, ...reste] = e.target.value.split(/\s+/)
                  setForm((f) => ({ ...f, prenom: prenom ?? '', nom: reste.join(' ') }))
                }}
                className={INPUT_CLASS}
              />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">
                Prénom
                <input
                  type="text"
                  value={form.prenom}
                  onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Nom
                <input
                  type="text"
                  value={form.nom}
                  onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>
            </div>
          )}

          <label className="text-sm font-medium text-gray-700">
            Téléphone
            <input
              type="tel"
              value={form.tel}
              onChange={(e) => setForm((f) => ({ ...f, tel: e.target.value }))}
              placeholder="Ex: 622 000 001"
              className={INPUT_CLASS}
            />
          </label>
          <p className="text-xs text-gray-400">
            Format accepté : 622 000 001 ou +224 622 000 001
          </p>

          <label className="text-sm font-medium text-gray-700">
            Rôle
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as GestionnaireForm['role'] }))}
              className={INPUT_CLASS}
            >
              <option value="gestionnaire">Gestionnaire</option>
              <option value="responsable">Responsable</option>
            </select>
          </label>

          <div>
            <span className="block text-sm font-medium text-gray-700">Stocks assignés</span>

            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, allDepots: !f.allDepots }))}
              className={`mt-2 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium ${
                form.allDepots ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-700'
              }`}
            >
              Tous les stocks
              {form.allDepots && <Check size={16} />}
            </button>

            {!form.allDepots && (
              <div className="mt-2 flex flex-col gap-1.5">
                {depots.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.depotIds.includes(d.id)}
                      onChange={() => toggleDepotForm(d.id)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-800 focus:ring-brand-400"
                    />
                    {d.nom}
                  </label>
                ))}
              </div>
            )}
          </div>

          {!editingId && (
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
              PIN par défaut : <span className="font-semibold text-gray-700">1234</span> (changement
              obligatoire à la première connexion)
            </div>
          )}

          {formError && <p className="text-sm text-danger-600">{formError}</p>}

          <Button fullWidth onClick={handleSaveGestionnaire} disabled={saving}>
            {saving ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Créer le gestionnaire'}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={sheet === 'depot'} onClose={() => setSheet(null)} title="Nouveau dépôt">
        <div className="flex flex-col gap-3 pb-4">
          <label className="text-sm font-medium text-gray-700">
            Nom du dépôt
            <input
              type="text"
              value={depotForm.nom}
              onChange={(e) => setDepotForm((f) => ({ ...f, nom: e.target.value }))}
              className={INPUT_CLASS}
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Type
            <select
              value={depotForm.type}
              onChange={(e) => setDepotForm((f) => ({ ...f, type: e.target.value as Depot['type'] }))}
              className={INPUT_CLASS}
            >
              <option value="principal">Principal</option>
              <option value="secondaire">Secondaire</option>
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Localisation (optionnel)
            <input
              type="text"
              value={depotForm.localisation}
              onChange={(e) => setDepotForm((f) => ({ ...f, localisation: e.target.value }))}
              placeholder="Conakry centre"
              className={INPUT_CLASS}
            />
          </label>

          {depotFormError && <p className="text-sm text-danger-600">{depotFormError}</p>}

          <Button fullWidth onClick={handleSaveDepot} disabled={saving}>
            {saving ? 'Création...' : 'Créer le dépôt'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
