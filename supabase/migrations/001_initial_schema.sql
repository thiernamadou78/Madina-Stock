-- ============================================================
-- MadinaStock — Schéma initial de base de données
-- ============================================================

-- ------------------------------------------------------------
-- Table utilisateurs
-- ------------------------------------------------------------
CREATE TABLE utilisateurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  code_pin TEXT NOT NULL, -- hashé bcrypt
  role TEXT NOT NULL CHECK (role IN ('gestionnaire','responsable','admin','proprietaire')),
  contact_wa TEXT,        -- format +224XXXXXXXXX
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- Table depots
-- ------------------------------------------------------------
CREATE TABLE depots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('principal','secondaire')),
  localisation TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- Table utilisateurs_depots (many-to-many)
-- ------------------------------------------------------------
CREATE TABLE utilisateurs_depots (
  utilisateur_id UUID REFERENCES utilisateurs(id),
  depot_id UUID REFERENCES depots(id),
  PRIMARY KEY (utilisateur_id, depot_id)
);

-- ------------------------------------------------------------
-- Table produits
-- ------------------------------------------------------------
CREATE TABLE produits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  reference TEXT,
  categorie TEXT NOT NULL,
  unite TEXT NOT NULL, -- sac, bidon, carton, pièce, kg...
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- Table stock_produits
-- ------------------------------------------------------------
CREATE TABLE stock_produits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  depot_id UUID NOT NULL REFERENCES depots(id),
  produit_id UUID NOT NULL REFERENCES produits(id),
  qte_disponible INTEGER NOT NULL DEFAULT 0,
  qte_reservee INTEGER NOT NULL DEFAULT 0,
  seuil_alerte INTEGER DEFAULT 10,
  seuil_critique INTEGER DEFAULT 5,
  prix_achat_dernier NUMERIC(15,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(depot_id, produit_id)
);

-- ------------------------------------------------------------
-- Table bons_sortie
-- ------------------------------------------------------------
CREATE TABLE bons_sortie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,        -- ex: BS-0047
  gestionnaire_id UUID NOT NULL REFERENCES utilisateurs(id),
  depot_id UUID NOT NULL REFERENCES depots(id),
  motif TEXT NOT NULL CHECK (motif IN ('vente','transfert','perte','retour')),
  depot_destination_id UUID REFERENCES depots(id), -- si motif=transfert
  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente','approuve','rejete','expire')),
  valide_par UUID REFERENCES utilisateurs(id),
  valide_le TIMESTAMPTZ,
  expire_le TIMESTAMPTZ DEFAULT (now() + INTERVAL '60 minutes'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- Table lignes_bon_sortie
-- ------------------------------------------------------------
CREATE TABLE lignes_bon_sortie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bon_id UUID NOT NULL REFERENCES bons_sortie(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id),
  qte_demandee INTEGER NOT NULL,
  qte_accordee INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- Table bons_reception
-- ------------------------------------------------------------
CREATE TABLE bons_reception (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,        -- ex: BR-0018
  saisi_par UUID NOT NULL REFERENCES utilisateurs(id),
  depot_id UUID NOT NULL REFERENCES depots(id),
  fournisseur TEXT NOT NULL,
  canal TEXT NOT NULL CHECK (canal IN ('presentiel','appel','app_mobile','conteneur')),
  reference_doc TEXT,
  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente','valide','rejete')),
  valide_par UUID REFERENCES utilisateurs(id),
  valide_le TIMESTAMPTZ,
  valeur_totale NUMERIC(15,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- Table lignes_reception
-- ------------------------------------------------------------
CREATE TABLE lignes_reception (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id UUID NOT NULL REFERENCES bons_reception(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id),
  qte_recue INTEGER NOT NULL,
  prix_achat_unitaire NUMERIC(15,2),
  valide BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- Table alertes
-- ------------------------------------------------------------
CREATE TABLE alertes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_produit_id UUID NOT NULL REFERENCES stock_produits(id),
  type TEXT NOT NULL CHECK (type IN ('alerte','critique','rupture','levee')),
  destinataires JSONB,
  canal TEXT,
  envoyee_le TIMESTAMPTZ DEFAULT now(),
  acquittee BOOLEAN DEFAULT false
);

-- ------------------------------------------------------------
-- Table sessions_gestionnaire
-- ------------------------------------------------------------
CREATE TABLE sessions_gestionnaire (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES utilisateurs(id),
  depot_id UUID NOT NULL REFERENCES depots(id),
  ouvert_le TIMESTAMPTZ DEFAULT now(),
  ferme_le TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- Fonction séquence de numérotation
-- ------------------------------------------------------------
CREATE SEQUENCE bon_sortie_seq START 1;
CREATE SEQUENCE bon_reception_seq START 1;

CREATE OR REPLACE FUNCTION next_bon_sortie_numero()
RETURNS TEXT AS $$
  SELECT 'BS-' || LPAD(nextval('bon_sortie_seq')::TEXT, 4, '0');
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION next_bon_reception_numero()
RETURNS TEXT AS $$
  SELECT 'BR-' || LPAD(nextval('bon_reception_seq')::TEXT, 4, '0');
$$ LANGUAGE SQL;

-- ------------------------------------------------------------
-- Row Level Security — active sur toutes les tables
-- ------------------------------------------------------------
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE depots ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_produits ENABLE ROW LEVEL SECURITY;
ALTER TABLE bons_sortie ENABLE ROW LEVEL SECURITY;
ALTER TABLE lignes_bon_sortie ENABLE ROW LEVEL SECURITY;
ALTER TABLE bons_reception ENABLE ROW LEVEL SECURITY;
ALTER TABLE lignes_reception ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions_gestionnaire ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Données de seed pour les tests
-- ------------------------------------------------------------

-- Données test : 1 propriétaire, 2 gestionnaires, 3 dépôts, 4 produits
INSERT INTO depots (nom, type, localisation) VALUES
  ('Magasin principal', 'principal', 'Conakry centre'),
  ('Dépôt Madina', 'secondaire', 'Madina'),
  ('Dépôt Ratoma', 'secondaire', 'Ratoma');

INSERT INTO produits (nom, categorie, unite) VALUES
  ('Riz importé 50kg', 'Céréales', 'sac'),
  ('Huile végétale 20L', 'Huiles', 'bidon'),
  ('Sucre 25kg', 'Sucre', 'sac'),
  ('Farine de blé 50kg', 'Céréales', 'sac');

-- Codes PIN : "1234" hashé bcrypt (à remplacer en production)
INSERT INTO utilisateurs (nom, code_pin, role, contact_wa) VALUES
  ('Ibrahima Diallo', '$2b$10$...', 'proprietaire', '+224620000001'),
  ('Mamadou Baldé', '$2b$10$...', 'gestionnaire', '+224620000002'),
  ('Aliou Souaré', '$2b$10$...', 'gestionnaire', '+224620000003');
