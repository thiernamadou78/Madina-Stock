import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const INTERVALLE_MS = 5 * 60 * 1000

/**
 * Appelle expire_bons() au montage puis toutes les 5 minutes, afin de
 * faire passer en 'expire' les bons de sortie en attente dont le délai
 * est dépassé et de libérer leur qte_reservee. Remplace le cron pg_cron
 * (indisponible sur le plan gratuit Supabase) par un polling client.
 */
export function useExpiration(onExpired?: () => void) {
  const onExpiredRef = useRef(onExpired)
  onExpiredRef.current = onExpired

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase.rpc('expire_bons')
      if (error) {
        console.warn('expire_bons:', error.message)
        return
      }
      if (data > 0) {
        console.log(`${data} bon(s) expiré(s)`)
        onExpiredRef.current?.()
      }
    }

    run()
    const interval = setInterval(run, INTERVALLE_MS)
    return () => clearInterval(interval)
  }, [])
}
