import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import type { BonSortie } from '../types'

const BON_SELECT = `
  *,
  lignes:lignes_bon_sortie(*, produit:produits(*)),
  gestionnaire:utilisateurs!bons_sortie_gestionnaire_id_fkey(*),
  depot:depots!bons_sortie_depot_id_fkey(*),
  depot_destination:depots!bons_sortie_depot_destination_id_fkey(*)
`

/**
 * Charge et gère les bons de sortie du dépôt actif.
 */
export function useBons() {
  const depotActifId = useAppStore((s) => s.depotActifId)
  const [bons, setBons] = useState<BonSortie[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!depotActifId) {
      setBons([])
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('bons_sortie')
      .select(BON_SELECT)
      .eq('depot_id', depotActifId)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
    } else {
      setBons((data ?? []) as unknown as BonSortie[])
    }

    setLoading(false)
  }, [depotActifId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!depotActifId) return

    const channel = supabase
      .channel(`bons_sortie:${depotActifId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bons_sortie', filter: `depot_id=eq.${depotActifId}` },
        () => refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [depotActifId, refresh])

  const enAttente = bons.filter((b) => b.statut === 'en_attente').length

  return { bons, enAttente, loading, error, refresh }
}
