// ============================================================
// MadinaStock — Validation/rejet des bons de réception
// Fonctions autonomes (indépendantes du dépôt actif) afin de pouvoir
// être appelées depuis n'importe quel contexte (page Validations,
// centre de notifications, action de notification push, etc.)
// ============================================================

import { supabase } from './supabase'
import { notifier, MESSAGES } from './notifications'
import { verifierSeuils } from './alertes'
import type { BonReception } from '../types'

export interface LigneValidationInput {
  ligneId: string
  valide: boolean
  prixAchat: number | null
}

/**
 * Valide un bon de réception en attente : crédite le stock du dépôt
 * (RPC `valider_reception`), puis notifie le saisisseur et vérifie
 * les seuils de stock du dépôt.
 */
export async function validerReception(
  reception: BonReception,
  validateurId: string,
  lignes?: LigneValidationInput[]
): Promise<{ error: string | null }> {
  const lignesAEnvoyer = lignes ?? reception.lignes.map((ligne) => ({
    ligneId: ligne.id,
    valide: ligne.valide,
    prixAchat: ligne.prix_achat_unitaire ?? null,
  }))

  const { data: result, error: rpcErr } = await supabase.rpc('valider_reception', {
    p_reception_id: reception.id,
    p_validateur_id: validateurId,
    p_lignes: lignesAEnvoyer.map((l) => ({
      ligne_id: l.ligneId,
      valide: l.valide,
      prix_achat: l.prixAchat,
    })),
  })

  if (rpcErr) return { error: rpcErr.message }
  if (!result?.success) return { error: result?.error ?? 'Erreur lors de la validation' }

  if (reception.saisisseur) {
    await notifier({
      destinataires: [reception.saisisseur],
      titre: '✅ Réception validée',
      message: MESSAGES.receptionValidee(reception),
      canal: 'auto',
      type: 'reception',
    })
  }

  await verifierSeuils(reception.depot_id, reception.lignes.map((l) => l.produit_id))

  return { error: null }
}

/**
 * Rejette un bon de réception en attente et notifie le saisisseur.
 */
export async function rejeterReception(
  reception: BonReception,
  validateurId: string
): Promise<{ error: string | null }> {
  const { error: err } = await supabase
    .from('bons_reception')
    .update({
      statut: 'rejete',
      valide_par: validateurId,
      valide_le: new Date().toISOString(),
    })
    .eq('id', reception.id)

  if (err) return { error: err.message }

  if (reception.saisisseur) {
    await notifier({
      destinataires: [reception.saisisseur],
      titre: '❌ Réception rejetée',
      message: MESSAGES.receptionRejetee(reception),
      canal: 'auto',
      type: 'reception',
    })
  }

  return { error: null }
}
