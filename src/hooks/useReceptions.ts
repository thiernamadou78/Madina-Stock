import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import { notifier, MESSAGES } from '../lib/notifications'
import { fetchAdmins, fetchUtilisateursByIds } from '../lib/bons'
import type { BonReception, CanalAppro } from '../types'

export const RECEPTION_SELECT = `
  id,
  numero,
  saisi_par,
  depot_id,
  fournisseur,
  canal,
  reference_doc,
  statut,
  valide_par,
  valide_le,
  valeur_totale,
  created_at,
  updated_at,
  depot:depots(id, nom, type),
  lignes:lignes_reception(
    id,
    produit_id,
    qte_recue,
    prix_achat_unitaire,
    valide,
    produit:produits(id, nom, unite, categorie)
  )
`

interface NouvelleLigneReceptionInput {
  produitId: string
  qteRecue: number
  prixAchatUnitaire: number
}

interface NouvelleReceptionInput {
  depotId: string
  fournisseur: string
  canal: CanalAppro
  referenceDoc?: string
  lignes: NouvelleLigneReceptionInput[]
}

/**
 * Charge et gère les bons de réception du dépôt actif.
 */
export function useReceptions() {
  const depotActifId = useAppStore((s) => s.depotActifId)
  const user = useAppStore((s) => s.user)
  const [receptions, setReceptions] = useState<BonReception[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelIdRef = useRef(Math.random().toString(36).slice(2))

  const refresh = useCallback(async () => {
    if (!depotActifId) {
      setReceptions([])
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('bons_reception')
      .select(RECEPTION_SELECT)
      .eq('depot_id', depotActifId)
      .order('created_at', { ascending: false })

    if (err) {
      console.error('bons_reception fetch error:', err)
      setError(err.message)
      setLoading(false)
      return
    }

    const recus = (data ?? []) as unknown as BonReception[]
    const utilisateurs = await fetchUtilisateursByIds(recus.map((r) => r.saisi_par))

    setReceptions(recus.map((r) => ({ ...r, saisisseur: utilisateurs.get(r.saisi_par) })))
    setLoading(false)
  }, [depotActifId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!depotActifId) return

    const channel = supabase
      .channel(`bons_reception:${depotActifId}:${channelIdRef.current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bons_reception', filter: `depot_id=eq.${depotActifId}` },
        () => refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [depotActifId, refresh])

  /**
   * Crée un nouveau bon de réception avec ses lignes, en statut "en_attente",
   * puis notifie les propriétaires/responsables.
   */
  const creerReception = useCallback(async (
    data: NouvelleReceptionInput
  ): Promise<{ success: boolean; numero?: string; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Utilisateur non défini' }
    }

    const { data: numero } = await supabase.rpc('next_bon_reception_numero')

    const { data: created, error: err } = await supabase
      .from('bons_reception')
      .insert({
        numero,
        saisi_par: user.id,
        depot_id: data.depotId,
        fournisseur: data.fournisseur,
        canal: data.canal,
        reference_doc: data.referenceDoc ?? null,
      })
      .select(RECEPTION_SELECT)
      .single()

    if (err || !created) {
      return { success: false, error: err?.message ?? 'Erreur lors de la création de la réception' }
    }

    const reception = created as unknown as BonReception

    const { error: lignesErr } = await supabase.from('lignes_reception').insert(
      data.lignes.map((ligne) => ({
        reception_id: reception.id,
        produit_id: ligne.produitId,
        qte_recue: ligne.qteRecue,
        prix_achat_unitaire: ligne.prixAchatUnitaire,
      }))
    )

    if (lignesErr) {
      return { success: false, error: lignesErr.message }
    }

    const valeurTotale = data.lignes.reduce(
      (total, ligne) => total + ligne.qteRecue * ligne.prixAchatUnitaire,
      0
    )

    await supabase.from('bons_reception').update({ valeur_totale: valeurTotale }).eq('id', reception.id)

    const admins = await fetchAdmins(['proprietaire', 'responsable'])
    await notifier({
      destinataires: admins,
      titre: '📥 Nouvelle réception',
      message: MESSAGES.receptionSoumise({ ...reception, valeur_totale: valeurTotale }),
      priorite: 'haute',
      type: 'reception_soumise',
    })

    await refresh()
    return { success: true, numero: reception.numero }
  }, [user, refresh])

  return { receptions, loading, error, refresh, creerReception }
}
