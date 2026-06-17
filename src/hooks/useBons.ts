import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import { fetchUtilisateursByIds } from '../lib/bons'
import type { BonSortie } from '../types'

const BON_SELECT = `
  *,
  lignes:lignes_bon_sortie(*, produit:produits(*)),
  depot:depots!bons_sortie_depot_id_fkey(*),
  depot_destination:depots!bons_sortie_depot_destination_id_fkey(*)
`

export function useBons() {
  const depotActifId = useAppStore((s) => s.depotActifId)
  const entrepriseId = useAppStore((s) => s.user?.entreprise_id)
  const [bons, setBons] = useState<BonSortie[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelIdRef = useRef(Math.random().toString(36).slice(2))

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
      .eq('entreprise_id', entrepriseId ?? '')
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const bons = (data ?? []) as unknown as BonSortie[]
    const utilisateurs = await fetchUtilisateursByIds(bons.map((b) => b.gestionnaire_id))

    setBons(bons.map((b) => ({ ...b, gestionnaire: utilisateurs.get(b.gestionnaire_id) })))
    setLoading(false)
  }, [depotActifId, entrepriseId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!depotActifId) return

    const channel = supabase
      .channel(`bons_sortie:${depotActifId}:${channelIdRef.current}`)
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

  return { bons, loading, error, refresh }
}
