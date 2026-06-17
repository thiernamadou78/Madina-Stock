import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Eye, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import type { Entreprise, StatutEntreprise } from '../../types'

const STATUT_COLORS: Record<StatutEntreprise, string> = {
  actif: 'bg-green-100 text-green-700',
  essai: 'bg-amber-100 text-amber-700',
  suspendu: 'bg-red-100 text-red-700',
  supprime: 'bg-gray-100 text-gray-500',
}

const STATUT_LABELS: Record<StatutEntreprise, string> = {
  actif: 'Actif',
  essai: 'Essai',
  suspendu: 'Suspendu',
  supprime: 'Supprimé',
}

interface EntrepriseStats {
  id: string
  nbDepots: number
  nbUtilisateurs: number
}

interface EntrepriseForm {
  nom: string
  code: string
  statut: 'actif' | 'essai'
  date_expiration: string
  contact_nom: string
  contact_tel: string
  contact_email: string
  adresse: string
}

const EMPTY_FORM: EntrepriseForm = {
  nom: '', code: '', statut: 'essai',
  date_expiration: '', contact_nom: '',
  contact_tel: '', contact_email: '', adresse: '',
}

function genererCode(nom: string): string {
  return nom
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.slice(0, 5))
    .join('-')
    .slice(0, 12)
}

export function SuperAdminEntreprisesPage() {
  const navigate = useNavigate()
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [stats, setStats] = useState<Record<string, EntrepriseStats>>({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EntrepriseForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('entreprises')
      .select('*')
      .neq('statut', 'supprime')
      .order('created_at', { ascending: false })

    const list = (data ?? []) as Entreprise[]
    setEntreprises(list)

    if (list.length > 0) {
      const ids = list.map((e) => e.id)
      const [depotsRes, usersRes] = await Promise.all([
        supabase.from('depots').select('id, entreprise_id').in('entreprise_id', ids).eq('actif', true),
        supabase.from('utilisateurs').select('id, entreprise_id').in('entreprise_id', ids).eq('actif', true).neq('role', 'superadmin'),
      ])

      const newStats: Record<string, EntrepriseStats> = {}
      for (const id of ids) {
        newStats[id] = {
          id,
          nbDepots: (depotsRes.data ?? []).filter((d: { entreprise_id: string }) => d.entreprise_id === id).length,
          nbUtilisateurs: (usersRes.data ?? []).filter((u: { entreprise_id: string }) => u.entreprise_id === id).length,
        }
      }
      setStats(newStats)
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (e: Entreprise) => {
    setEditingId(e.id)
    setForm({
      nom: e.nom, code: e.code,
      statut: (e.statut === 'actif' || e.statut === 'essai') ? e.statut : 'actif',
      date_expiration: e.date_expiration ? e.date_expiration.slice(0, 10) : '',
      contact_nom: e.contact_nom ?? '',
      contact_tel: e.contact_tel ?? '',
      contact_email: e.contact_email ?? '',
      adresse: e.adresse ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  const handleNomChange = (nom: string) => {
    setForm((f) => ({
      ...f,
      nom,
      code: editingId ? f.code : genererCode(nom),
    }))
  }

  const handleSave = async () => {
    if (!form.nom.trim()) { setFormError('Le nom est requis'); return }
    if (!form.code.trim()) { setFormError('Le code est requis'); return }
    setSaving(true)
    setFormError(null)

    const payload = {
      nom: form.nom.trim(),
      code: form.code.trim().toUpperCase(),
      statut: form.statut,
      date_expiration: form.statut === 'essai' && form.date_expiration ? form.date_expiration : null,
      contact_nom: form.contact_nom.trim() || null,
      contact_tel: form.contact_tel.trim() || null,
      contact_email: form.contact_email.trim() || null,
      adresse: form.adresse.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = editingId
      ? await supabase.from('entreprises').update(payload).eq('id', editingId)
      : await supabase.from('entreprises').insert({ ...payload })

    setSaving(false)
    if (error) { setFormError(error.message); return }

    setModalOpen(false)
    await refresh()
  }

  const handleToggleStatut = async (e: Entreprise) => {
    const newStatut = e.statut === 'suspendu' ? 'actif' : 'suspendu'
    await supabase.from('entreprises').update({ statut: newStatut, updated_at: new Date().toISOString() }).eq('id', e.id)
    await refresh()
  }

  const handleDelete = async (e: Entreprise) => {
    if (!confirm(`Archiver "${e.nom}" ? Les données seront conservées 30 jours.`)) return
    await supabase.from('entreprises').update({ statut: 'supprime', updated_at: new Date().toISOString() }).eq('id', e.id)
    await refresh()
  }

  const counts = {
    total: entreprises.length,
    actif: entreprises.filter((e) => e.statut === 'actif').length,
    essai: entreprises.filter((e) => e.statut === 'essai').length,
    suspendu: entreprises.filter((e) => e.statut === 'suspendu').length,
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Entreprises</h1>
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-1" />
          Nouvelle entreprise
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: counts.total, color: 'text-gray-900' },
          { label: 'Actifs', value: counts.actif, color: 'text-green-700' },
          { label: 'Essai', value: counts.essai, color: 'text-amber-700' },
          { label: 'Suspendus', value: counts.suspendu, color: 'text-red-700' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : entreprises.length === 0 ? (
        <div className="text-center py-12">
          <Building2 size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">Aucune entreprise. Créez-en une.</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {entreprises.map((e) => (
            <div key={e.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900">{e.nom}</h2>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600">{e.code}</span>
                  </div>
                  {e.contact_nom && (
                    <p className="mt-0.5 text-sm text-gray-500">{e.contact_nom}{e.contact_tel ? ` · ${e.contact_tel}` : ''}</p>
                  )}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUT_COLORS[e.statut]}`}>
                  {STATUT_LABELS[e.statut]}
                </span>
              </div>

              <div className="flex gap-4 text-xs text-gray-500 mb-4">
                <span>{stats[e.id]?.nbDepots ?? '–'} dépôt(s)</span>
                <span>{stats[e.id]?.nbUtilisateurs ?? '–'} utilisateur(s)</span>
                <span>Créé le {new Date(e.created_at).toLocaleDateString('fr-FR')}</span>
                {e.statut === 'essai' && e.date_expiration && (
                  <span className="text-amber-600">Expire le {new Date(e.date_expiration).toLocaleDateString('fr-FR')}</span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/superadmin/entreprises/${e.id}`)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Eye size={13} /> Voir
                </button>
                <button
                  onClick={() => openEdit(e)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Pencil size={13} /> Modifier
                </button>
                <button
                  onClick={() => handleToggleStatut(e)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    e.statut === 'suspendu'
                      ? 'border-green-200 text-green-700 hover:bg-green-50'
                      : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <Power size={13} />
                  {e.statut === 'suspendu' ? 'Activer' : 'Suspendre'}
                </button>
                <button
                  onClick={() => handleDelete(e)}
                  className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={13} /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Modifier l\'entreprise' : 'Nouvelle entreprise'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise *</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base focus:border-brand-400 focus:outline-none"
              value={form.nom}
              onChange={(e) => handleNomChange(e.target.value)}
              placeholder="Ex: Diallo Commerce"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code unique *</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-base uppercase focus:border-brand-400 focus:outline-none"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="EX: DIALLO-COMM"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base focus:border-brand-400 focus:outline-none"
              value={form.statut}
              onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value as 'actif' | 'essai' }))}
            >
              <option value="actif">Actif</option>
              <option value="essai">Essai</option>
            </select>
          </div>
          {form.statut === 'essai' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date d'expiration</label>
              <input
                type="date"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base focus:border-brand-400 focus:outline-none"
                value={form.date_expiration}
                onChange={(e) => setForm((f) => ({ ...f, date_expiration: e.target.value }))}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
              <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" value={form.contact_nom} onChange={(e) => setForm((f) => ({ ...f, contact_nom: e.target.value }))} placeholder="Nom du contact" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" value={form.contact_tel} onChange={(e) => setForm((f) => ({ ...f, contact_tel: e.target.value }))} placeholder="6xx xxx xxx" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (optionnel)</label>
            <input type="email" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} placeholder="contact@exemple.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse (optionnel)</label>
            <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" value={form.adresse} onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))} placeholder="Conakry, Guinée" />
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex gap-3 pt-2">
            <Button fullWidth variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button fullWidth onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
