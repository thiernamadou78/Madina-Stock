-- ============================================================
-- 012 — Architecture multi-tenant : table entreprises,
-- colonne entreprise_id sur toutes les tables, rôle superadmin,
-- migration des données existantes vers une entreprise DEMO,
-- et mise à jour des RPC pour inclure entreprise_id.
-- ============================================================

-- ------------------------------------------------------------
-- Table entreprises
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entreprises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             TEXT NOT NULL,
  code            TEXT NOT NULL UNIQUE,
  statut          TEXT NOT NULL DEFAULT 'essai'
    CHECK (statut IN ('actif','suspendu','essai','supprime')),
  date_expiration TIMESTAMPTZ,
  contact_nom     TEXT,
  contact_tel     TEXT,
  contact_email   TEXT,
  adresse         TEXT,
  logo_url        TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- Ajout de entreprise_id sur toutes les tables
-- ------------------------------------------------------------
ALTER TABLE utilisateurs         ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id);
ALTER TABLE depots                ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id);
ALTER TABLE produits              ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id);
ALTER TABLE stock_produits        ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id);
ALTER TABLE bons_sortie           ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id);
ALTER TABLE bons_reception        ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id);
ALTER TABLE lignes_bon_sortie     ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id);
ALTER TABLE lignes_reception      ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id);
ALTER TABLE alertes               ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id);
ALTER TABLE sessions_gestionnaire ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id);

-- ------------------------------------------------------------
-- Rôle superadmin
-- ------------------------------------------------------------
ALTER TABLE utilisateurs DROP CONSTRAINT IF EXISTS utilisateurs_role_check;
ALTER TABLE utilisateurs ADD CONSTRAINT utilisateurs_role_check
  CHECK (role IN ('gestionnaire','responsable','admin','proprietaire','superadmin'));

-- ------------------------------------------------------------
-- Entreprise par défaut pour les données existantes
-- ------------------------------------------------------------
INSERT INTO entreprises (nom, code, statut)
VALUES ('Client Demo', 'DEMO', 'actif')
ON CONFLICT (code) DO NOTHING;

UPDATE utilisateurs         SET entreprise_id = (SELECT id FROM entreprises WHERE code = 'DEMO') WHERE entreprise_id IS NULL;
UPDATE depots               SET entreprise_id = (SELECT id FROM entreprises WHERE code = 'DEMO') WHERE entreprise_id IS NULL;
UPDATE produits             SET entreprise_id = (SELECT id FROM entreprises WHERE code = 'DEMO') WHERE entreprise_id IS NULL;
UPDATE stock_produits       SET entreprise_id = (SELECT id FROM entreprises WHERE code = 'DEMO') WHERE entreprise_id IS NULL;
UPDATE bons_sortie          SET entreprise_id = (SELECT id FROM entreprises WHERE code = 'DEMO') WHERE entreprise_id IS NULL;
UPDATE bons_reception       SET entreprise_id = (SELECT id FROM entreprises WHERE code = 'DEMO') WHERE entreprise_id IS NULL;
UPDATE alertes              SET entreprise_id = (SELECT id FROM entreprises WHERE code = 'DEMO') WHERE entreprise_id IS NULL;
UPDATE sessions_gestionnaire SET entreprise_id = (SELECT id FROM entreprises WHERE code = 'DEMO') WHERE entreprise_id IS NULL;

-- Backfill des lignes depuis leur parent
UPDATE lignes_bon_sortie lbs
SET entreprise_id = bs.entreprise_id
FROM bons_sortie bs
WHERE lbs.bon_id = bs.id AND lbs.entreprise_id IS NULL;

UPDATE lignes_reception lr
SET entreprise_id = br.entreprise_id
FROM bons_reception br
WHERE lr.reception_id = br.id AND lr.entreprise_id IS NULL;

-- ------------------------------------------------------------
-- Compte superadmin (sans entreprise)
-- ------------------------------------------------------------
INSERT INTO utilisateurs (nom, role, code_pin, actif, pin_change_required, entreprise_id)
SELECT 'SuperAdmin', 'superadmin', crypt('0000', gen_salt('bf', 8)), true, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE role = 'superadmin');

-- ------------------------------------------------------------
-- RLS policies : drop all + recreate
-- ------------------------------------------------------------
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "anon_all_entreprises"         ON entreprises         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_depots"              ON depots              FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_produits"            ON produits            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_stock_produits"      ON stock_produits      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_bons_sortie"         ON bons_sortie         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_bons_reception"      ON bons_reception      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_lignes_sortie"       ON lignes_bon_sortie   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_lignes_reception"    ON lignes_reception    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_alertes"             ON alertes             FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_sessions"            ON sessions_gestionnaire FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_select_utilisateurs"     ON utilisateurs        FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_utilisateurs"     ON utilisateurs        FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_utilisateurs"     ON utilisateurs        FOR UPDATE TO anon USING (true);

GRANT SELECT, INSERT, UPDATE ON entreprises TO anon, authenticated;

-- ------------------------------------------------------------
-- creer_bon_sortie — définit entreprise_id depuis le dépôt
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION creer_bon_sortie(
  p_gestionnaire_id UUID,
  p_depot_id UUID,
  p_motif TEXT,
  p_depot_destination_id UUID,
  p_lignes JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bon_id UUID;
  v_numero TEXT;
  v_ligne JSONB;
  v_qte_nette INTEGER;
  v_entreprise_id UUID;
BEGIN
  SELECT entreprise_id INTO v_entreprise_id FROM depots WHERE id = p_depot_id;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    SELECT (qte_disponible - qte_reservee) INTO v_qte_nette
    FROM stock_produits
    WHERE depot_id = p_depot_id
      AND produit_id = (v_ligne->>'produit_id')::UUID
    FOR UPDATE;

    IF v_qte_nette IS NULL OR v_qte_nette < (v_ligne->>'qte_demandee')::INTEGER THEN
      RETURN jsonb_build_object('success', false, 'error', 'Stock insuffisant',
        'disponible', COALESCE(v_qte_nette, 0), 'demande', (v_ligne->>'qte_demandee')::INTEGER);
    END IF;
  END LOOP;

  v_numero := next_bon_sortie_numero();
  INSERT INTO bons_sortie (
    numero, gestionnaire_id, depot_id, motif,
    depot_destination_id, statut, entreprise_id
  ) VALUES (
    v_numero, p_gestionnaire_id, p_depot_id, p_motif,
    p_depot_destination_id, 'en_attente', v_entreprise_id
  ) RETURNING id INTO v_bon_id;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    INSERT INTO lignes_bon_sortie (bon_id, produit_id, qte_demandee, entreprise_id)
    VALUES (v_bon_id, (v_ligne->>'produit_id')::UUID,
            (v_ligne->>'qte_demandee')::INTEGER, v_entreprise_id);

    UPDATE stock_produits
    SET qte_reservee = qte_reservee + (v_ligne->>'qte_demandee')::INTEGER, updated_at = now()
    WHERE depot_id = p_depot_id AND produit_id = (v_ligne->>'produit_id')::UUID;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'bon_id', v_bon_id, 'numero', v_numero);
END;
$$;

-- ------------------------------------------------------------
-- sortie_directe — définit entreprise_id depuis le dépôt
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sortie_directe(
  p_gestionnaire_id UUID,
  p_depot_id UUID,
  p_motif TEXT,
  p_depot_destination_id UUID,
  p_lignes JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bon_id UUID;
  v_numero TEXT;
  v_ligne JSONB;
  v_qte_nette INTEGER;
  v_entreprise_id UUID;
BEGIN
  SELECT entreprise_id INTO v_entreprise_id FROM depots WHERE id = p_depot_id;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    SELECT (qte_disponible - qte_reservee) INTO v_qte_nette
    FROM stock_produits
    WHERE depot_id = p_depot_id AND produit_id = (v_ligne->>'produit_id')::UUID
    FOR UPDATE;

    IF v_qte_nette IS NULL OR v_qte_nette < (v_ligne->>'qte_demandee')::INTEGER THEN
      RETURN jsonb_build_object('success', false, 'error', 'Stock insuffisant',
        'disponible', COALESCE(v_qte_nette, 0), 'demande', (v_ligne->>'qte_demandee')::INTEGER);
    END IF;
  END LOOP;

  v_numero := next_bon_sortie_numero();
  INSERT INTO bons_sortie (
    numero, gestionnaire_id, depot_id, motif,
    depot_destination_id, statut, valide_par, valide_le, entreprise_id
  ) VALUES (
    v_numero, p_gestionnaire_id, p_depot_id, p_motif,
    p_depot_destination_id, 'approuve', p_gestionnaire_id, now(), v_entreprise_id
  ) RETURNING id INTO v_bon_id;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    INSERT INTO lignes_bon_sortie (bon_id, produit_id, qte_demandee, qte_accordee, entreprise_id)
    VALUES (v_bon_id, (v_ligne->>'produit_id')::UUID,
            (v_ligne->>'qte_demandee')::INTEGER, (v_ligne->>'qte_demandee')::INTEGER,
            v_entreprise_id);

    UPDATE stock_produits
    SET qte_disponible = qte_disponible - (v_ligne->>'qte_demandee')::INTEGER, updated_at = now()
    WHERE depot_id = p_depot_id AND produit_id = (v_ligne->>'produit_id')::UUID;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'bon_id', v_bon_id, 'numero', v_numero);
END;
$$;

-- ------------------------------------------------------------
-- valider_reception — définit entreprise_id sur le stock créé
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION valider_reception(
  p_reception_id UUID,
  p_validateur_id UUID,
  p_lignes JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ligne RECORD;
  v_params JSONB;
  v_valide BOOLEAN;
  v_prix NUMERIC;
  v_depot_id UUID;
  v_entreprise_id UUID;
BEGIN
  SELECT depot_id INTO v_depot_id FROM bons_reception WHERE id = p_reception_id;
  SELECT entreprise_id INTO v_entreprise_id FROM depots WHERE id = v_depot_id;

  FOR v_ligne IN
    SELECT id, produit_id, qte_recue FROM lignes_reception WHERE reception_id = p_reception_id
  LOOP
    SELECT m INTO v_params FROM jsonb_array_elements(p_lignes) m
    WHERE (m->>'ligne_id')::UUID = v_ligne.id LIMIT 1;

    v_valide := COALESCE((v_params->>'valide')::BOOLEAN, true);
    v_prix   := (v_params->>'prix_achat')::NUMERIC;

    UPDATE lignes_reception SET valide = v_valide, prix_achat_unitaire = v_prix WHERE id = v_ligne.id;

    IF v_valide THEN
      INSERT INTO stock_produits
        (depot_id, produit_id, qte_disponible, prix_achat_dernier, entreprise_id)
      VALUES
        (v_depot_id, v_ligne.produit_id, v_ligne.qte_recue, v_prix, v_entreprise_id)
      ON CONFLICT (depot_id, produit_id) DO UPDATE
        SET qte_disponible     = stock_produits.qte_disponible + v_ligne.qte_recue,
            prix_achat_dernier = COALESCE(v_prix, stock_produits.prix_achat_dernier),
            entreprise_id      = EXCLUDED.entreprise_id,
            updated_at         = now();
    END IF;
  END LOOP;

  UPDATE bons_reception SET statut = 'valide', valide_par = p_validateur_id, valide_le = now()
  WHERE id = p_reception_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------
-- creer_gestionnaire — accepte p_entreprise_id (optionnel)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION creer_gestionnaire(
  p_prenom TEXT,
  p_nom TEXT,
  p_tel TEXT,
  p_role TEXT,
  p_depot_ids UUID[],
  p_all_depots BOOLEAN DEFAULT false,
  p_entreprise_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF p_role NOT IN ('gestionnaire', 'responsable') THEN
    RAISE EXCEPTION 'Rôle invalide : %', p_role;
  END IF;

  INSERT INTO utilisateurs (
    nom, role, contact_wa, code_pin, actif, pin_change_required, entreprise_id
  ) VALUES (
    TRIM(p_prenom || ' ' || p_nom),
    p_role,
    p_tel,
    crypt('1234', gen_salt('bf', 8)),
    true,
    true,
    p_entreprise_id
  ) RETURNING id INTO v_user_id;

  IF p_all_depots THEN
    INSERT INTO utilisateurs_depots (utilisateur_id, depot_id)
    SELECT v_user_id, d.id FROM depots d
    WHERE d.actif = true
      AND (p_entreprise_id IS NULL OR d.entreprise_id = p_entreprise_id);

    UPDATE utilisateurs SET all_depots = true WHERE id = v_user_id;
  ELSE
    INSERT INTO utilisateurs_depots (utilisateur_id, depot_id)
    SELECT v_user_id, unnest(p_depot_ids);
  END IF;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION creer_gestionnaire(TEXT, TEXT, TEXT, TEXT, UUID[], BOOLEAN, UUID) TO anon, authenticated;

-- ------------------------------------------------------------
-- creer_depot — accepte p_entreprise_id (optionnel)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION creer_depot(
  p_nom TEXT,
  p_type TEXT,
  p_localisation TEXT,
  p_entreprise_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_depot_id UUID;
BEGIN
  INSERT INTO depots (nom, type, localisation, entreprise_id)
  VALUES (p_nom, p_type, p_localisation, p_entreprise_id)
  RETURNING id INTO v_depot_id;

  -- Auto-assigne les utilisateurs avec all_depots = true de la même entreprise
  INSERT INTO utilisateurs_depots (utilisateur_id, depot_id)
  SELECT id, v_depot_id FROM utilisateurs
  WHERE all_depots = true
    AND (p_entreprise_id IS NULL OR entreprise_id = p_entreprise_id);

  RETURN v_depot_id;
END;
$$;

GRANT EXECUTE ON FUNCTION creer_depot(TEXT, TEXT, TEXT, UUID) TO anon, authenticated;

-- ------------------------------------------------------------
-- modifier_gestionnaire — scoped à la même entreprise
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION modifier_gestionnaire(
  p_user_id UUID,
  p_nom TEXT,
  p_tel TEXT,
  p_role TEXT,
  p_depot_ids UUID[],
  p_all_depots BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entreprise_id UUID;
BEGIN
  IF p_role NOT IN ('gestionnaire', 'responsable') THEN
    RAISE EXCEPTION 'Rôle invalide : %', p_role;
  END IF;

  SELECT entreprise_id INTO v_entreprise_id FROM utilisateurs WHERE id = p_user_id;

  UPDATE utilisateurs
  SET nom = TRIM(p_nom), contact_wa = p_tel, role = p_role,
      all_depots = p_all_depots, updated_at = now()
  WHERE id = p_user_id;

  DELETE FROM utilisateurs_depots WHERE utilisateur_id = p_user_id;

  IF p_all_depots THEN
    INSERT INTO utilisateurs_depots (utilisateur_id, depot_id)
    SELECT p_user_id, d.id FROM depots d
    WHERE d.actif = true
      AND (v_entreprise_id IS NULL OR d.entreprise_id = v_entreprise_id);
  ELSE
    INSERT INTO utilisateurs_depots (utilisateur_id, depot_id)
    SELECT p_user_id, unnest(p_depot_ids);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION modifier_gestionnaire(UUID, TEXT, TEXT, TEXT, UUID[], BOOLEAN) TO anon, authenticated;

-- Republier les grants pour les fonctions modifiées
GRANT EXECUTE ON FUNCTION creer_bon_sortie TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sortie_directe TO anon, authenticated;
GRANT EXECUTE ON FUNCTION valider_reception TO anon, authenticated;
GRANT EXECUTE ON FUNCTION expire_bons TO anon, authenticated;
GRANT EXECUTE ON FUNCTION approuver_bon TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rejeter_bon TO anon, authenticated;
