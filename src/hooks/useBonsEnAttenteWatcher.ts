import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import { fetchUtilisateursByIds, BON_SORTIE_SELECT } from '../lib/bons'
import { RECEPTION_SELECT } from './useReceptions'
import { MESSAGES, envoyerPushLocal } from '../lib/notifications'
import type { BonReception, BonSortie } from '../types'

/**
 * Surveille en continu, tous dépôts confondus, les bons de sortie et les
 * réceptions en attente de validation, et alimente le centre de
 * notifications du propriétaire/responsable avec les détails complets
 * (lignes, dépôt, demandeur...) afin de permettre Valider/Rejeter
 * directement depuis la notification — quel que soit le dépôt actif
 * sur cet appareil.
 */
export function useBonsEnAttenteWatcher() {
  const user = useAppStore((s) => s.user)

  useEffect(() => {
    if (!user) return
    if (user.role !== 'proprietaire' && user.role !== 'responsable') return

    let cancelled = false
    let premierPassage = true

    const checkPending = async () => {
      const [sortieRes, receptionRes] = await Promise.all([
        supabase
          .from('bons_sortie')
          .select(BON_SORTIE_SELECT)
          .eq('statut', 'en_attente')
          .order('created_at', { ascending: false }),
        supabase
          .from('bons_reception')
          .select(RECEPTION_SELECT)
          .eq('statut', 'en_attente')
          .order('created_at', { ascending: false }),
      ])

      if (cancelled) return

      const sorties = (sortieRes.data ?? []) as unknown as BonSortie[]
      const receptions = (receptionRes.data ?? []) as unknown as BonReception[]

      const sortieIds = new Set(sorties.map((b) => b.id))
      const receptionIds = new Set(receptions.map((r) => r.id))

      // Nettoie les notifications dont le bon a déjà été traité (depuis
      // un autre appareil ou la page Validations).
      for (const n of useAppStore.getState().notifications) {
        if (n.bonSortie && !sortieIds.has(n.bonSortie.id)) {
          useAppStore.getState().removeNotification(n.id)
        }
        if (n.bonReception && !receptionIds.has(n.bonReception.id)) {
          useAppStore.getState().removeNotification(n.id)
        }
      }

      const utilisateurs = await fetchUtilisateursByIds([
        ...sorties.map((b) => b.gestionnaire_id),
        ...receptions.map((r) => r.saisi_par),
      ])

      if (cancelled) return

      const existing = useAppStore.getState().notifications
      const knownSortieIds = new Set(existing.filter((n) => n.bonSortie).map((n) => n.bonSortie!.id))
      const knownReceptionIds = new Set(existing.filter((n) => n.bonReception).map((n) => n.bonReception!.id))

      for (const bon of sorties) {
        if (knownSortieIds.has(bon.id)) continue

        const enrichi = { ...bon, gestionnaire: utilisateurs.get(bon.gestionnaire_id) }
        const notifId = crypto.randomUUID()

        useAppStore.getState().addNotification({
          id: notifId,
          titre: '📦 Bon à valider',
          message: MESSAGES.bonSoumis(enrichi),
          type: 'bon_soumis',
          lu: false,
          created_at: bon.created_at,
          bonSortie: enrichi,
        })

        if (!premierPassage) {
          void envoyerPushLocal(
            '📦 Bon à valider',
            MESSAGES.bonSoumis(enrichi),
            { url: '/validations', bonId: bon.id, notifId, type: 'bon_soumis', tag: `madina-bon-${bon.id}` },
            [
              { action: 'valider', title: '✅ Valider' },
              { action: 'rejeter', title: '❌ Rejeter' },
            ]
          )
        }
      }

      for (const r of receptions) {
        if (knownReceptionIds.has(r.id)) continue

        const enrichi = { ...r, saisisseur: utilisateurs.get(r.saisi_par) }
        const notifId = crypto.randomUUID()

        useAppStore.getState().addNotification({
          id: notifId,
          titre: '📥 Réception à valider',
          message: MESSAGES.receptionSoumise(enrichi),
          type: 'reception_soumise',
          lu: false,
          created_at: r.created_at,
          bonReception: enrichi,
        })

        if (!premierPassage) {
          void envoyerPushLocal(
            '📥 Réception à valider',
            MESSAGES.receptionSoumise(enrichi),
            { url: '/validations', bonId: r.id, notifId, type: 'reception_soumise', tag: `madina-reception-${r.id}` },
            [
              { action: 'valider', title: '✅ Valider' },
              { action: 'rejeter', title: '❌ Rejeter' },
            ]
          )
        }
      }

      premierPassage = false
    }

    checkPending()

    const channel = supabase
      .channel(`bons-en-attente-watcher:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bons_sortie' }, checkPending)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bons_reception' }, checkPending)
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user])
}
