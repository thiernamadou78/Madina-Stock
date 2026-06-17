import { supabase } from './supabase'
import { normaliserTelephone } from './utils'
import type { DepotRow, GestionnaireRow, ProduitStockRow } from './excelTemplates'

export async function importerFichier1(
  entrepriseId: string,
  depots: DepotRow[],
  gestionnaires: GestionnaireRow[]
): Promise<{ depotsCreés: number; gestCreés: number; erreurs: string[] }> {
  const erreurs: string[] = []
  let depotsCreés = 0
  let gestCreés = 0
  const depotMap: Record<string, string> = {}

  for (const depot of depots.filter((d) => d.valid)) {
    const { data, error } = await supabase.rpc('creer_depot', {
      p_nom: depot.nom,
      p_type: depot.type,
      p_localisation: depot.localisation ?? '',
      p_entreprise_id: entrepriseId,
    })
    if (error) {
      erreurs.push(`Dépôt "${depot.nom}": ${error.message}`)
    } else {
      depotMap[depot.nom] = data as string
      depotsCreés++
    }
  }

  for (const g of gestionnaires.filter((g) => g.valid)) {
    const depotIds = g.all_depots
      ? []
      : g.depots.map((nom) => depotMap[nom]).filter((id): id is string => !!id)

    if (!g.all_depots && depotIds.length !== g.depots.length) {
      const manquants = g.depots.filter((n) => !depotMap[n])
      erreurs.push(
        `Gestionnaire "${g.prenom} ${g.nom}": dépôt(s) introuvable(s): ${manquants.join(', ')}`
      )
    }

    const { error } = await supabase.rpc('creer_gestionnaire', {
      p_prenom: g.prenom,
      p_nom: g.nom,
      p_tel: normaliserTelephone(g.telephone),
      p_role: g.role,
      p_depot_ids: depotIds,
      p_all_depots: g.all_depots,
      p_entreprise_id: entrepriseId,
    })
    if (error) {
      erreurs.push(`Gestionnaire "${g.prenom} ${g.nom}": ${error.message}`)
    } else {
      gestCreés++
    }
  }

  return { depotsCreés, gestCreés, erreurs }
}

export async function importerFichier2(
  entrepriseId: string,
  rows: ProduitStockRow[]
): Promise<{ produitsCreés: number; stocksCreés: number; erreurs: string[] }> {
  const erreurs: string[] = []
  let produitsCreés = 0
  let stocksCreés = 0

  const { data: depotData } = await supabase
    .from('depots')
    .select('id, nom')
    .eq('entreprise_id', entrepriseId)
    .eq('actif', true)

  const depotMap: Record<string, string> = {}
  ;(depotData ?? []).forEach((d: { id: string; nom: string }) => {
    depotMap[d.nom] = d.id
  })

  const produitsMap: Record<string, string> = {}
  const seen = new Map<string, ProduitStockRow>()
  for (const row of rows) {
    if (!seen.has(row.nom_produit)) seen.set(row.nom_produit, row)
  }

  for (const row of seen.values()) {
    const { data: existing } = await supabase
      .from('produits')
      .select('id')
      .eq('entreprise_id', entrepriseId)
      .eq('nom', row.nom_produit)
      .maybeSingle()

    if (existing) {
      produitsMap[row.nom_produit] = (existing as { id: string }).id
    } else {
      const { data, error } = await supabase
        .from('produits')
        .insert({
          nom: row.nom_produit,
          categorie: row.categorie,
          unite: row.unite,
          actif: true,
          entreprise_id: entrepriseId,
        })
        .select('id')
        .single()

      if (error) {
        erreurs.push(`Produit "${row.nom_produit}": ${error.message}`)
        continue
      }
      produitsMap[row.nom_produit] = (data as { id: string }).id
      produitsCreés++
    }
  }

  for (const row of rows.filter((r) => r.valid)) {
    const produitId = produitsMap[row.nom_produit]
    const depotId = depotMap[row.nom_depot]

    if (!produitId) {
      erreurs.push(`Stock: produit "${row.nom_produit}" non créé`)
      continue
    }
    if (!depotId) {
      erreurs.push(
        `Stock: dépôt "${row.nom_depot}" introuvable pour cette entreprise — importez d'abord le Fichier 1`
      )
      continue
    }

    const { error } = await supabase.from('stock_produits').upsert(
      {
        depot_id: depotId,
        produit_id: produitId,
        entreprise_id: entrepriseId,
        qte_disponible: row.qte,
        qte_reservee: 0,
        seuil_alerte: row.seuil_alerte,
        seuil_critique: row.seuil_critique,
      },
      { onConflict: 'depot_id,produit_id' }
    )

    if (error) {
      erreurs.push(`Stock "${row.nom_produit}" / "${row.nom_depot}": ${error.message}`)
    } else {
      stocksCreés++
    }
  }

  return { produitsCreés, stocksCreés, erreurs }
}
