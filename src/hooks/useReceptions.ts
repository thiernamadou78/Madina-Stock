import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import { notifier, MESSAGES } from '../lib/notifications'
import { verifierSeuils } from '../lib/alertes'
import type { BonReception, CanalAppro } from '../types'

const RECEPTION_SELECT = `
  *,
  lignes:lignes_reception(*, produit:produits(*)),
  depot:depots(*),
  saisisseur:utilisateurs!bons_reception_saisi_par_fkey(*),
  validateur:utilisateurs!bons_reception_valide_par_fkey(*)
`

interface NouvelleLigneReception {
  produit_id: string
  qte_recue: number
  prix_achat_unitaire?: number | null
}

interface NouveauBonReception {
  fournisseur: string
  canal: CanalAppro
  reference_doc?: string | null
  lignes: NouvelleLigneReception[]
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
   * Crée un nouveau bon de réception avec ses lignes, en statut "en_attente".
   * Le dépôt destination peut être différent du dépôt actif (réception pour un autre dépôt).
   */
  const creerReception = useCallback(async (bon: NouveauBonReception, depotId?: string) => {
    const depot = depotId ?? depotActifId

    if (!depot || !user) {
      return { error: 'Dépôt ou utilisateur non défini' }
    }

    const { data: numero } = await supabase.rpc('next_bon_reception_numero')

    const valeurTotale = bon.lignes.reduce(
      (total, ligne) => total + ligne.qte_recue * (ligne.prix_achat_unitaire ?? 0),
      0
    )

    const { data: created, error: err } = await supabase
      .from('bons_reception')
      .insert({
        numero,
        saisi_par: user.id,
        depot_id: depot,
        fournisseur: bon.fournisseur,
        canal: bon.canal,
        reference_doc: bon.reference_doc ?? null,
        valeur_totale: valeurTotale,
      })
      .select()
      .single()

    if (err || !created) {
      return { error: err?.message ?? 'Erreur lors de la création de la réception' }
    }

    const { error: lignesErr } = await supabase.from('lignes_reception').insert(
      bon.lignes.map((ligne) => ({
        reception_id: created.id,
        produit_id: ligne.produit_id,
        qte_recue: ligne.qte_recue,
        prix_achat_unitaire: ligne.prix_achat_unitaire ?? null,
      }))
    )

    if (lignesErr) {
      return { error: lignesErr.message }
    }

    await refresh()
    return { error: null, reception: created as BonReception }
  }, [depotActifId, user, refresh])

  /**
   * Valide ou rejette un bon de réception en attente.
   */
  const statuerReception = useCallback(async (
    receptionId: string,
    statut: 'valide' | 'rejete'
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

    const { data: result, error: rpcErr } = await supabase.rpc('valider_reception', {
      p_reception_id: receptionId,
      p_validateur_id: user.id,
      p_lignes: reception.lignes.map((ligne) => ({
        ligne_id: ligne.id,
        valide: ligne.valide,
        prix_achat: ligne.prix_achat_unitaire ?? null,
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
