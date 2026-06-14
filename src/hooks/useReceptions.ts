import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import { notifier, MESSAGES } from '../lib/notifications'
import { fetchAdmins } from '../lib/bons'
import { verifierSeuils } from '../lib/alertes'
import type { BonReception, CanalAppro } from '../types'

const RECEPTION_SELECT = `
  *,
  lignes:lignes_reception(*, produit:produits(*)),
  depot:depots(*),
  saisisseur:utilisateurs!bons_reception_saisi_par_fkey(*),
  validateur:utilisateurs!bons_reception_valide_par_fkey(*)
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

interface LigneValidationInput {
  ligneId: string
  valide: boolean
  prixAchat: number | null
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
      setError(err.message)
    } else {
      setReceptions((data ?? []) as unknown as BonReception[])
    }

    setLoading(false)
  }, [depotActifId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!depotActifId) return

    const channel = supabase
      .channel(`bons_reception:${depotActifId}`)
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
    })

    await refresh()
    return { success: true, numero: reception.numero }
  }, [user, refresh])

  /**
   * Valide ou rejette un bon de réception en attente. Pour une validation,
   * `lignes` permet de transmettre l'état (cochée/prix) édité dans l'UI ;
   * à défaut, l'état enregistré en base est utilisé.
   */
  const statuerReception = useCallback(async (
    receptionId: string,
    statut: 'valide' | 'rejete',
    lignes?: LigneValidationInput[]
  ) => {
    if (!user) return { error: 'Utilisateur non défini' }

    if (statut === 'rejete') {
      const { error: err } = await supabase
        .from('bons_reception')
        .update({
          statut: 'rejete',
          valide_par: user.id,
          valide_le: new Date().toISOString(),
        })
        .eq('id', receptionId)

      if (err) return { error: err.message }

      await refresh()
      return { error: null }
    }

    const reception = receptions.find((r) => r.id === receptionId)
    if (!reception) return { error: 'Réception introuvable' }

    const lignesAEnvoyer = lignes ?? reception.lignes.map((ligne) => ({
      ligneId: ligne.id,
      valide: ligne.valide,
      prixAchat: ligne.prix_achat_unitaire ?? null,
    }))

    const { data: result, error: rpcErr } = await supabase.rpc('valider_reception', {
      p_reception_id: receptionId,
      p_validateur_id: user.id,
      p_lignes: lignesAEnvoyer.map((l) => ({
        ligne_id: l.ligneId,
        valide: l.valide,
        prix_achat: l.prixAchat,
      })),
    })

    if (rpcErr) return { error: rpcErr.message }
    if (!result?.success) return { error: result?.error ?? 'Erreur lors de la validation' }

    await notifier({
      destinataires: [reception.saisisseur],
      titre: '✅ Réception validée',
      message: MESSAGES.receptionValidee(reception),
    })

    await verifierSeuils(reception.depot_id, reception.lignes.map((l) => l.produit_id))

    await refresh()
    return { error: null }
  }, [user, receptions, refresh])

  const enAttente = receptions.filter((r) => r.statut === 'en_attente').length

  return { receptions, enAttente, loading, error, refresh, creerReception, statuerReception }
}
