import { supabase } from './supabase'
import { notifier, MESSAGES } from './notifications'
import { verifierSeuils } from './alertes'
import type { BonSortie, MotifSortie, StatutBon, Utilisateur } from '../types'

const BON_SORTIE_SELECT = `
  *,
  lignes:lignes_bon_sortie(*, produit:produits(*)),
  gestionnaire:utilisateurs!bons_sortie_gestionnaire_id_fkey(*),
  depot:depots!bons_sortie_depot_id_fkey(*),
  depot_destination:depots!bons_sortie_depot_destination_id_fkey(*)
`

async function fetchAdmins(roles: string[]): Promise<Utilisateur[]> {
  const { data } = await supabase
    .from('utilisateurs')
    .select('id, nom, role, contact_wa, actif')
    .in('role', roles)
    .eq('actif', true)

  return (data ?? []) as unknown as Utilisateur[]
}

async function fetchBonSortie(bonId: string): Promise<BonSortie | null> {
  const { data } = await supabase
    .from('bons_sortie')
    .select(BON_SORTIE_SELECT)
    .eq('id', bonId)
    .single()

  return (data as unknown as BonSortie) ?? null
}

/**
 * Crée un bon de sortie avec ses lignes, en réservant le stock demandé.
 * La vérification de disponibilité et la réservation (qte_reservee) sont
 * effectuées atomiquement côté base via la fonction RPC `creer_bon_sortie`.
 */
export async function creerBonSortie(data: {
  depotId: string
  gestionnairId: string
  motif: MotifSortie
  depotDestinationId?: string
  lignes: Array<{ produitId: string; qteDemandee: number }>
}): Promise<{ success: boolean; error?: string; bon?: BonSortie }> {
  if (data.lignes.length === 0) {
    return { success: false, error: 'Le bon doit contenir au moins une ligne' }
  }

  const { data: result, error: rpcErr } = await supabase.rpc('creer_bon_sortie', {
    p_gestionnaire_id: data.gestionnairId,
    p_depot_id: data.depotId,
    p_motif: data.motif,
    p_depot_destination_id: data.depotDestinationId ?? null,
    p_lignes: data.lignes.map((ligne) => ({
      produit_id: ligne.produitId,
      qte_demandee: ligne.qteDemandee,
    })),
  })

  if (rpcErr) {
    return { success: false, error: rpcErr.message }
  }

  if (!result?.success) {
    const error =
      result?.disponible !== undefined
        ? `${result.error} (disponible: ${result.disponible}, demandé: ${result.demande})`
        : result?.error ?? 'Erreur lors de la création du bon'

    return { success: false, error }
  }

  const bon = await fetchBonSortie(result.bon_id)
  if (!bon) {
    return { success: false, error: 'Bon créé mais impossible de le récupérer' }
  }

  const admins = await fetchAdmins(['proprietaire', 'responsable'])
  await notifier({
    destinataires: admins,
    titre: '📦 Nouveau bon',
    message: MESSAGES.bonSoumis(bon),
  })

  return { success: true, bon }
}

/**
 * Sortie directe (propriétaire) : débite immédiatement le stock disponible
 * et crée un bon déjà au statut "approuve", sans passer par la file de
 * validation. La vérification de disponibilité et le débit sont effectués
 * atomiquement côté base via la fonction RPC `sortie_directe`.
 */
export async function sortieDirecte(data: {
  depotId: string
  gestionnairId: string
  motif: MotifSortie
  depotDestinationId?: string
  lignes: Array<{ produitId: string; qteDemandee: number }>
}): Promise<{ success: boolean; error?: string; bon?: { numero: string; statut: StatutBon } }> {
  if (data.lignes.length === 0) {
    return { success: false, error: 'Le bon doit contenir au moins une ligne' }
  }

  const { data: result, error: rpcErr } = await supabase.rpc('sortie_directe', {
    p_gestionnaire_id: data.gestionnairId,
    p_depot_id: data.depotId,
    p_motif: data.motif,
    p_depot_destination_id: data.depotDestinationId ?? null,
    p_lignes: data.lignes.map((ligne) => ({
      produit_id: ligne.produitId,
      qte_demandee: ligne.qteDemandee,
    })),
  })

  if (rpcErr) {
    return { success: false, error: rpcErr.message }
  }

  if (!result?.success) {
    const error =
      result?.disponible !== undefined
        ? `${result.error} (disponible: ${result.disponible}, demandé: ${result.demande})`
        : result?.error ?? 'Erreur lors de la création du bon'

    return { success: false, error }
  }

  await verifierSeuils(data.depotId, data.lignes.map((l) => l.produitId))

  return { success: true, bon: { numero: result.numero as string, statut: 'approuve' } }
}

/**
 * Approuve un bon de sortie : fixe les quantités accordées (par défaut la
 * quantité demandée), décrémente le stock disponible et libère la réservation,
 * puis passe le bon au statut "approuve". Notifie le gestionnaire et vérifie
 * les seuils de stock du dépôt.
 */
export async function approuverBon(
  bonId: string,
  validateurId: string,
  modifications?: Array<{ ligneId: string; qteAccordee: number }>
): Promise<{ success: boolean; error?: string; bon?: BonSortie }> {
  const { data: result, error: rpcErr } = await supabase.rpc('approuver_bon', {
    p_bon_id: bonId,
    p_validateur_id: validateurId,
    p_modifications: modifications
      ? modifications.map((m) => ({ ligne_id: m.ligneId, qte_accordee: m.qteAccordee }))
      : null,
  })

  if (rpcErr) {
    return { success: false, error: rpcErr.message }
  }

  if (!result?.success) {
    return { success: false, error: result?.error ?? 'Erreur lors de l\'approbation du bon' }
  }

  const bon = await fetchBonSortie(bonId)
  if (!bon) {
    return { success: false, error: 'Bon approuvé mais impossible de le récupérer' }
  }

  await notifier({
    destinataires: [bon.gestionnaire],
    titre: '✅ Bon approuvé',
    message: MESSAGES.bonApprouve(bon),
  })

  await verifierSeuils(bon.depot_id, bon.lignes.map((l) => l.produit_id))

  return { success: true, bon }
}

/**
 * Rejette un bon de sortie en attente : libère la réservation de stock
 * (qte_reservee) et notifie le gestionnaire.
 */
export async function rejeterBon(
  bonId: string,
  validateurId: string
): Promise<{ success: boolean; error?: string; bon?: BonSortie }> {
  const { data: result, error: rpcErr } = await supabase.rpc('rejeter_bon', {
    p_bon_id: bonId,
    p_validateur_id: validateurId,
  })

  if (rpcErr) {
    return { success: false, error: rpcErr.message }
  }

  if (!result?.success) {
    return { success: false, error: result?.error ?? 'Erreur lors du rejet du bon' }
  }

  const bon = await fetchBonSortie(bonId)
  if (!bon) {
    return { success: false, error: 'Bon rejeté mais impossible de le récupérer' }
  }

  await notifier({
    destinataires: [bon.gestionnaire],
    titre: '❌ Bon rejeté',
    message: MESSAGES.bonRejete(bon),
  })

  return { success: true, bon }
}
