// ============================================================
// MadinaStock — Détection et envoi des alertes de seuil de stock
// ============================================================

import { supabase } from './supabase'
import { notifier, MESSAGES } from './notifications'
import type { StockProduit, TypeAlerte, Utilisateur } from '../types'

const DELAI_ANTI_SPAM_MS = 30 * 60 * 1000

/**
 * Vérifie les seuils de stock des produits indiqués pour un dépôt donné,
 * et notifie les responsables si un seuil d'alerte/critique/rupture est
 * franchi ou levé (avec anti-spam de 30 minutes par type d'alerte).
 */
export async function verifierSeuils(depotId: string, produitIds: string[]): Promise<void> {
  if (produitIds.length === 0) return

  const { data } = await supabase
    .from('stock_produits')
    .select('*, produit:produits(*)')
    .eq('depot_id', depotId)
    .in('produit_id', produitIds)

  const stocks = (data ?? []) as unknown as StockProduit[]

  for (const sp of stocks) {
    const qte = sp.qte_disponible

    let type: TypeAlerte
    if (qte === 0) type = 'rupture'
    else if (qte <= sp.seuil_critique) type = 'critique'
    else if (qte <= sp.seuil_alerte) type = 'alerte'
    else type = 'levee'

    const { data: dernier } = await supabase
      .from('alertes')
      .select('envoyee_le')
      .eq('stock_produit_id', sp.id)
      .eq('type', type)
      .order('envoyee_le', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (dernier) {
      const age = Date.now() - new Date(dernier.envoyee_le).getTime()
      if (age < DELAI_ANTI_SPAM_MS) continue
    }

    await supabase.from('alertes').insert({
      stock_produit_id: sp.id,
      type,
      canal: 'push',
    })

    const message =
      type === 'levee' ? MESSAGES.alerteLevee(sp)
      : type === 'alerte' ? MESSAGES.alerteSeuil(sp)
      : type === 'critique' ? MESSAGES.alerteCritique(sp)
      : MESSAGES.alerteCritique(sp)

    const { data: admins } = await supabase
      .from('utilisateurs')
      .select('id, nom, role, contact_wa, actif')
      .in('role', ['proprietaire', 'admin', 'responsable'])
      .eq('actif', true)

    await notifier({
      destinataires: (admins ?? []) as unknown as Utilisateur[],
      titre: type === 'levee' ? '🟢 Stock rétabli' : '⚠️ Alerte stock',
      message,
      canal: 'auto',
    })
  }
}
