import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import type { StockProduit } from '../types'

export function computeStatutStock(
  stock: Pick<StockProduit, 'qte_disponible' | 'seuil_alerte' | 'seuil_critique'>
): StockProduit['statut_stock'] {
  if (stock.qte_disponible <= 0) return 'rupture'
  if (stock.qte_disponible <= stock.seuil_critique) return 'critique'
  if (stock.qte_disponible <= stock.seuil_alerte) return 'alerte'
  return 'ok'
}

export function enrichirStock(stock: StockProduit): StockProduit {
  return {
    ...stock,
    qte_nette: stock.qte_disponible - stock.qte_reservee,
    statut_stock: computeStatutStock(stock),
  }
}

/**
 * Charge le stock du dépôt actuellement actif (sélectionné dans appStore).
 */
export function useStock() {
  const depotActifId = useAppStore((s) => s.depotActifId)
  const [stock, setStock] = useState<StockProduit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!depotActifId) {
      setStock([])
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('stock_produits')
      .select('*, produit:produits(*)')
      .eq('depot_id', depotActifId)
      .order('created_at', { ascending: true })

    if (err) {
      setError(err.message)
    } else {
      setStock(((data ?? []) as unknown as StockProduit[]).map(enrichirStock))
    }

    setLoading(false)
  }, [depotActifId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!depotActifId) return

    const channel = supabase
      .channel(`stock_produits:${depotActifId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_produits', filter: `depot_id=eq.${depotActifId}` },
        () => refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [depotActifId, refresh])

  const alertes = stock.filter((s) => s.statut_stock !== 'ok')

  return { stock, alertes, loading, error, refresh }
}
