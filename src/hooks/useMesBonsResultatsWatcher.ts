import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import { BON_SORTIE_SELECT } from '../lib/bons'
import { RECEPTION_SELECT } from './useReceptions'
import { MESSAGES } from '../lib/notifications'
import type { BonReception, BonSortie } from '../types'

/**
 * Notifie en direct (cloche + pop-up) l'auteur d'un bon de sortie ou d'une
 * réception quand le propriétaire/responsable le valide ou le rejette.
 * `notifier()` (appelé depuis approuverBon/rejeterBon) gère déjà le push/
 * WhatsApp cross-appareil, mais ne met à jour que le store de l'appareil
 * qui exécute l'action (le validateur) — jamais celui de l'auteur.
 *
 * Repose sur un sondage (30s) + temps réel en complément (latence plus
 * faible si activé), comme useBonsEnAttenteWatcher côté propriétaire :
 * on ne peut pas se fier uniquement au canal Realtime (peut être désactivé
 * sur ces tables côté Supabase), ni à payload.old (aucune table n'a
 * REPLICA IDENTITY FULL) — on détecte donc la résolution d'un bon en
 * comparant l'ensemble des bons "en attente" d'un sondage à l'autre.
 */
export function useMesBonsResultatsWatcher() {
  const user = useAppStore((s) => s.user)

  useEffect(() => {
    if (!user) return
    if (user.role === 'proprietaire' || user.role === 'superadmin') return

    let cancelled = false
    let initialized = false
    let previousPendingSortie = new Set<string>()
    let previousPendingReception = new Set<string>()

    const notifierSortieResolue = async (id: string) => {
      const { data } = await supabase.from('bons_sortie').select(BON_SORTIE_SELECT).eq('id', id).single()
      if (cancelled || !data) return

      const bon = data as unknown as BonSortie
      if (bon.statut !== 'approuve' && bon.statut !== 'rejete') return

      const approuve = bon.statut === 'approuve'
      const titre = approuve ? '✅ Bon approuvé' : '❌ Bon rejeté'
      const message = approuve ? MESSAGES.bonApprouve(bon) : MESSAGES.bonRejete(bon)

      useAppStore.getState().addNotification({
        id: crypto.randomUUID(),
        titre,
        message,
        type: approuve ? 'bon_approuve' : 'bon_rejete',
        lu: false,
        created_at: new Date().toISOString(),
        bonSortie: bon,
      })
      useAppStore.getState().showToast({
        id: crypto.randomUUID(),
        titre,
        message,
        variant: approuve ? 'success' : 'error',
      })
    }

    const notifierReceptionResolue = async (id: string) => {
      const { data } = await supabase.from('bons_reception').select(RECEPTION_SELECT).eq('id', id).single()
      if (cancelled || !data) return

      const reception = data as unknown as BonReception
      if (reception.statut !== 'valide' && reception.statut !== 'rejete') return

      const validee = reception.statut === 'valide'
      const titre = validee ? '✅ Réception validée' : '❌ Réception rejetée'
      const message = validee ? MESSAGES.receptionValidee(reception) : MESSAGES.receptionRejetee(reception)

      useAppStore.getState().addNotification({
        id: crypto.randomUUID(),
        titre,
        message,
        type: validee ? 'reception' : 'bon_rejete',
        lu: false,
        created_at: new Date().toISOString(),
        bonReception: reception,
      })
      useAppStore.getState().showToast({
        id: crypto.randomUUID(),
        titre,
        message,
        variant: validee ? 'success' : 'error',
      })
    }

    const checkResultats = async () => {
      const [sortieRes, receptionRes] = await Promise.all([
        supabase.from('bons_sortie').select('id').eq('gestionnaire_id', user.id).eq('statut', 'en_attente'),
        supabase.from('bons_reception').select('id').eq('saisi_par', user.id).eq('statut', 'en_attente'),
      ])
      if (cancelled) return

      const currentPendingSortie = new Set(((sortieRes.data ?? []) as { id: string }[]).map((r) => r.id))
      const currentPendingReception = new Set(((receptionRes.data ?? []) as { id: string }[]).map((r) => r.id))

      if (initialized) {
        const resolusSortie = [...previousPendingSortie].filter((id) => !currentPendingSortie.has(id))
        const resolusReception = [...previousPendingReception].filter((id) => !currentPendingReception.has(id))

        for (const id of resolusSortie) await notifierSortieResolue(id)
        for (const id of resolusReception) await notifierReceptionResolue(id)
      }

      previousPendingSortie = currentPendingSortie
      previousPendingReception = currentPendingReception
      initialized = true
    }

    void checkResultats()

    const channel = supabase
      .channel(`mes-bons-resultats:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bons_sortie', filter: `gestionnaire_id=eq.${user.id}` },
        checkResultats
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bons_reception', filter: `saisi_par=eq.${user.id}` },
        checkResultats
      )
      .subscribe()

    const interval = setInterval(checkResultats, 30_000)

    return () => {
      cancelled = true
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [user])
}
