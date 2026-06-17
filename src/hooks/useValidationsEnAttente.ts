import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import { fetchUtilisateursByIds, BON_SORTIE_SELECT } from '../lib/bons'
import { RECEPTION_SELECT } from './useReceptions'
import type { BonReception, BonSortie } from '../types'

/**
 * Charge les bons de sortie et réceptions en attente de validation sur
 * l'ensemble des dépôts accessibles à l'utilisateur (et non uniquement le
 * dépôt actif), afin que le propriétaire/responsable puisse voir les
 * détails et valider/rejeter une demande quel que soit son dépôt actif.
 * Filtrés par entreprise_id pour l'isolation multi-tenant.
 */
export function useValidationsEnAttente() {
  const user = useAppStore((s) => s.user)
  const depots = useAppStore((s) => s.depots)
  const [bonsEnAttente, setBonsEnAttente] = useState<BonSortie[]>([])
  const [receptionsEnAttente, setReceptionsEnAttente] = useState<BonReception[]>([])
  const [loading, setLoading] = useState(false)
  const channelIdRef = useRef(Math.random().toString(36).slice(2))

  const depotIds = depots.map((d) => d.id)
  const entrepriseId = user?.entreprise_id

  const refresh = useCallback(async () => {
    if (depotIds.length === 0) {
      setBonsEnAttente([])
      setReceptionsEnAttente([])
      return
    }

    setLoading(true)

    const [sortieRes, receptionRes] = await Promise.all([
      supabase
        .from('bons_sortie')
        .select(BON_SORTIE_SELECT)
        .eq('statut', 'en_attente')
        .in('depot_id', depotIds)
        .eq('entreprise_id', entrepriseId ?? '')
        .order('created_at', { ascending: false }),
      supabase
        .from('bons_reception')
        .select(RECEPTION_SELECT)
        .eq('statut', 'en_attente')
        .in('depot_id', depotIds)
        .eq('entreprise_id', entrepriseId ?? '')
        .order('created_at', { ascending: false }),
    ])

    const sorties = (sortieRes.data ?? []) as unknown as BonSortie[]
    const receptions = (receptionRes.data ?? []) as unknown as BonReception[]

    const utilisateurs = await fetchUtilisateursByIds([
      ...sorties.map((b) => b.gestionnaire_id),
      ...receptions.map((r) => r.saisi_par),
    ])

    setBonsEnAttente(sorties.map((b) => ({ ...b, gestionnaire: utilisateurs.get(b.gestionnaire_id) })))
    setReceptionsEnAttente(receptions.map((r) => ({ ...r, saisisseur: utilisateurs.get(r.saisi_par) })))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depotIds.join(','), entrepriseId])

  useEffect(() => {
    if (!user) return
    if (user.role !== 'proprietaire' && user.role !== 'responsable') return

    refresh()

    const channel = supabase
      .channel(`validations-en-attente:${user.id}:${channelIdRef.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bons_sortie' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bons_reception' }, () => refresh())
      .subscribe()

    const interval = setInterval(refresh, 30_000)

    return () => { clearInterval(interval); supabase.removeChannel(channel) }
  }, [user, refresh])

  return { bonsEnAttente, receptionsEnAttente, loading, refresh }
}
