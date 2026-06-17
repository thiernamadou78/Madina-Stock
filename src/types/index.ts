// ============================================================
// MadinaStock — Types TypeScript correspondant au schéma DB
// ============================================================

export type Role = 'gestionnaire' | 'responsable' | 'admin' | 'proprietaire' | 'superadmin'
export type MotifSortie = 'vente' | 'transfert' | 'perte' | 'retour'
export type StatutBon = 'en_attente' | 'approuve' | 'rejete' | 'expire'
export type CanalAppro = 'presentiel' | 'appel' | 'app_mobile' | 'conteneur'
export type TypeAlerte = 'alerte' | 'critique' | 'rupture' | 'levee'
export type StatutEntreprise = 'actif' | 'suspendu' | 'essai' | 'supprime'

export interface Entreprise {
  id: string
  nom: string
  code: string
  statut: StatutEntreprise
  date_expiration?: string
  contact_nom?: string
  contact_tel?: string
  contact_email?: string
  adresse?: string
  logo_url?: string
  created_at: string
  updated_at: string
}

export interface Utilisateur {
  id: string
  nom: string
  role: Role
  contact_wa?: string
  actif: boolean
  all_depots?: boolean
  pin_change_required?: boolean
  entreprise_id?: string
}

export interface Depot {
  id: string
  nom: string
  type: 'principal' | 'secondaire'
  localisation?: string
  actif: boolean
  entreprise_id?: string
}

export interface Produit {
  id: string
  nom: string
  reference?: string
  categorie: string
  unite: string
  actif: boolean
  entreprise_id?: string
}

export interface StockProduit {
  id: string
  depot_id: string
  produit_id: string
  produit: Produit
  depot?: Depot
  qte_disponible: number
  qte_reservee: number
  qte_nette: number // qte_disponible - qte_reservee (calculé)
  seuil_alerte: number
  seuil_critique: number
  prix_achat_dernier?: number
  statut_stock: 'ok' | 'alerte' | 'critique' | 'rupture' // calculé
  entreprise_id?: string
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
  gestionnaire?: Utilisateur
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
  entreprise_id?: string
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
  saisisseur?: Utilisateur
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
  entreprise_id?: string
}

export type NotificationType =
  | 'bon_soumis'
  | 'bon_approuve'
  | 'bon_rejete'
  | 'reception_soumise'
  | 'reception'
  | 'alerte'
  | 'alerte_levee'

export interface NotificationItem {
  id: string
  titre: string
  message: string
  type: NotificationType
  lu: boolean
  created_at: string
  bonSortie?: BonSortie
  bonReception?: BonReception
}
