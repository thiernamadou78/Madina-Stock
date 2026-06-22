import { useEffect } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
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
 * WhatsApp cross-appareil ; ce watcher couvre le cas où l'auteur est
 * lui-même connecté sur l'app au moment de la décision (son propre store
 * Zustand, sur son propre appareil, n'est jamais mis à jour autrement).
 *
 * Comme aucune table n'a REPLICA IDENTITY FULL, `payload.old` ne contient
 * que l'id — on suit donc nous-mêmes l'ensemble des bons "en attente" pour
 * détecter une transition de statut plutôt que de se fier à l'ancien état.
 */
export function useMesBonsResultatsWatcher() {
  const user = useAppStore((s) => s.user)

  useEffect(() => {
    if (!user) return
    if (user.role === 'proprietaire' || user.role === 'superadmin') return

    let cancelled = false
    const pendingSortieIds = new Set<string>()
    const pendingReceptionIds = new Set<string>()

    const initPending = async () => {
      const [sortieRes, receptionRes] = await Promise.all([
        supabase.from('bons_sortie').select('id').eq('gestionnaire_id', user.id).eq('statut', 'en_attente'),
        supabase.from('bons_reception').select('id').eq('saisi_par', user.id).eq('statut', 'en_attente'),
      ])
      if (cancelled) return
      for (const row of (sortieRes.data ?? []) as { id: string }[]) pendingSortieIds.add(row.id)
      for (const row of (receptionRes.data ?? []) as { id: string }[]) pendingReceptionIds.add(row.id)
    }

    const handleSortieChange = async (
      payload: RealtimePostgresChangesPayload<{ id: string; statut: string }>
    ) => {
      const row = payload.new as { id?: string; statut?: string }
      if (!row.id || !row.statut) return

      if (row.statut === 'en_attente') {
        pendingSortieIds.add(row.id)
        return
      }
      if (!pendingSortieIds.has(row.id)) return
      pendingSortieIds.delete(row.id)
      if (row.statut !== 'approuve' && row.statut !== 'rejete') return

      const { data } = await supabase.from('bons_sortie').select(BON_SORTIE_SELECT).eq('id', row.id).single()
      if (cancelled || !data) return

      const bon = data as unknown as BonSortie
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

    const handleReceptionChange = async (
      payload: RealtimePostgresChangesPayload<{ id: string; statut: string }>
    ) => {
      const row = payload.new as { id?: string; statut?: string }
      if (!row.id || !row.statut) return

      if (row.statut === 'en_attente') {
        pendingReceptionIds.add(row.id)
        return
      }
      if (!pendingReceptionIds.has(row.id)) return
      pendingReceptionIds.delete(row.id)
      if (row.statut !== 'valide' && row.statut !== 'rejete') return

      const { data } = await supabase.from('bons_reception').select(RECEPTION_SELECT).eq('id', row.id).single()
      if (cancelled || !data) return

      const reception = data as unknown as BonReception
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

    void initPending()

    const channel = supabase
      .channel(`mes-bons-resultats:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bons_sortie', filter: `gestionnaire_id=eq.${user.id}` },
        handleSortieChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bons_reception', filter: `saisi_par=eq.${user.id}` },
        handleReceptionChange
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user])
}
