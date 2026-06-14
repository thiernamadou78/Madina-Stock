// ============================================================
// MadinaStock — Types TypeScript correspondant au schéma DB
// ============================================================

export type Role = 'gestionnaire' | 'responsable' | 'admin' | 'proprietaire'
export type MotifSortie = 'vente' | 'transfert' | 'perte' | 'retour'
export type StatutBon = 'en_attente' | 'approuve' | 'rejete' | 'expire'
export type CanalAppro = 'presentiel' | 'appel' | 'app_mobile' | 'conteneur'
export type TypeAlerte = 'alerte' | 'critique' | 'rupture' | 'levee'

export interface Utilisateur {
  id: string
  nom: string
  role: Role
  contact_wa?: string
  actif: boolean
  all_depots?: boolean
  pin_change_required?: boolean
}

export interface Depot {
  id: string
  nom: string
  type: 'principal' | 'secondaire'
  localisation?: string
  actif: boolean
}

export interface Produit {
  id: string
  nom: string
  reference?: string
  categorie: string
  unite: string
  actif: boolean
}

export interface StockProduit {
  id: string
  depot_id: string
  produit_id: string
  produit: Produit
  qte_disponible: number
  qte_reservee: number
  qte_nette: number // qte_disponible - qte_reservee (calculé)
  seuil_alerte: number
  seuil_critique: number
  prix_achat_dernier?: number
  statut_stock: 'ok' | 'alerte' | 'critique' | 'rupture' // calculé
}

export interface LigneBonSortie {
  id: string
  bon_id: string
  produit_id: string
  produit: Produit
  qte_demandee: number
  qte_accordee?: number
}

export interface BonSortie {
  id: string
  numero: string
  gestionnaire_id: string
  gestionnaire: Utilisateur
  depot_id: string
  depot: Depot
  motif: MotifSortie
  depot_destination_id?: string
  depot_destination?: Depot
  statut: StatutBon
  valide_par?: string
  validateur?: Utilisateur
  valide_le?: string
  expire_le: string
  lignes: LigneBonSortie[]
  created_at: string
}

export interface LigneReception {
  id: string
  reception_id: string
  produit_id: string
  produit: Produit
  qte_recue: number
  prix_achat_unitaire?: number
  valide: boolean
}

export interface BonReception {
  id: string
  numero: string
  saisi_par: string
  saisisseur: Utilisateur
  depot_id: string
  depot: Depot
  fournisseur: string
  canal: CanalAppro
  reference_doc?: string
  statut: 'en_attente' | 'valide' | 'rejete'
  valide_par?: string
  validateur?: Utilisateur
  valide_le?: string
  valeur_totale?: number
  lignes: LigneReception[]
  created_at: string
}
