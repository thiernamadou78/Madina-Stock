-- ============================================================
-- 009 — Connexion gestionnaire par téléphone, sortie directe
-- propriétaire, gestion CRUD des gestionnaires et dépôts.
-- ============================================================

-- ------------------------------------------------------------
-- Nouvelles colonnes utilisateurs
-- ------------------------------------------------------------
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS all_depots BOOLEAN DEFAULT false;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS pin_change_required BOOLEAN DEFAULT false;

-- all_depots doit être lisible par le client (StockSwitcher, UsersPage)
GRANT SELECT (all_depots) ON utilisateurs TO anon, authenticated;

-- La politique de lecture de 008 ne couvre que actif = true ; UsersPage
-- doit aussi pouvoir voir les comptes désactivés pour les réactiver.
CREATE POLICY "allow_read_utilisateurs_tous"
ON utilisateurs
FOR SELECT
TO anon, authenticated
USING (true);

-- ------------------------------------------------------------
-- Connexion gestionnaire par numéro de téléphone (contact_wa)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_pin_tel(
  p_tel TEXT,
  p_pin TEXT
)
RETURNS TABLE(id UUID, nom TEXT, role TEXT, contact_wa TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.nom, u.role::TEXT, u.contact_wa
  FROM utilisateurs u
  WHERE u.contact_wa = p_tel
    AND u.actif = true
    AND u.code_pin = crypt(p_pin, u.code_pin);
END;
$$;

GRANT EXECUTE ON FUNCTION verify_pin_tel(TEXT, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- Sortie directe (propriétaire) : bon créé déjà approuvé,
-- débit immédiat de qte_disponible (pas de réservation).
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
BEGIN
  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    SELECT (qte_disponible - qte_reservee) INTO v_qte_nette
    FROM stock_produits
    WHERE depot_id = p_depot_id
      AND produit_id = (v_ligne->>'produit_id')::UUID
    FOR UPDATE;

    IF v_qte_nette IS NULL OR
       v_qte_nette < (v_ligne->>'qte_demandee')::INTEGER THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Stock insuffisant',
        'disponible', COALESCE(v_qte_nette, 0),
        'demande', (v_ligne->>'qte_demandee')::INTEGER
      );
    END IF;
  END LOOP;

  v_numero := next_bon_sortie_numero();
  INSERT INTO bons_sortie (
    numero, gestionnaire_id, depot_id, motif,
    depot_destination_id, statut,
    valide_par, valide_le
  ) VALUES (
    v_numero, p_gestionnaire_id, p_depot_id, p_motif,
    p_depot_destination_id, 'approuve',
    p_gestionnaire_id, now()
  ) RETURNING id INTO v_bon_id;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    INSERT INTO lignes_bon_sortie (
      bon_id, produit_id, qte_demandee, qte_accordee
    ) VALUES (
      v_bon_id,
      (v_ligne->>'produit_id')::UUID,
      (v_ligne->>'qte_demandee')::INTEGER,
      (v_ligne->>'qte_demandee')::INTEGER
    );

    UPDATE stock_produits
    SET qte_disponible = qte_disponible - (v_ligne->>'qte_demandee')::INTEGER,
        updated_at = now()
    WHERE depot_id = p_depot_id
      AND produit_id = (v_ligne->>'produit_id')::UUID;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'bon_id', v_bon_id, 'numero', v_numero);
END;
$$;

GRANT EXECUTE ON FUNCTION sortie_directe(UUID, UUID, TEXT, UUID, JSONB) TO anon, authenticated;

-- ------------------------------------------------------------
-- Création d'un compte gestionnaire/responsable par le propriétaire.
-- PIN par défaut "1234", changement obligatoire à la première connexion.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION creer_gestionnaire(
  p_prenom TEXT,
  p_nom TEXT,
  p_tel TEXT,
  p_role TEXT,
  p_depot_ids UUID[],
  p_all_depots BOOLEAN DEFAULT false
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
    nom, role, contact_wa, code_pin, actif, pin_change_required
  ) VALUES (
    TRIM(p_prenom || ' ' || p_nom),
    p_role,
    p_tel,
    crypt('1234', gen_salt('bf', 8)),
    true,
    true
  ) RETURNING id INTO v_user_id;

  IF p_all_depots THEN
    -- Assigne tous les dépôts actifs
    INSERT INTO utilisateurs_depots (utilisateur_id, depot_id)
    SELECT v_user_id, d.id FROM depots d WHERE d.actif = true;

    -- Marque pour auto-assignation des futurs dépôts
    UPDATE utilisateurs SET all_depots = true WHERE id = v_user_id;
  ELSE
    INSERT INTO utilisateurs_depots (utilisateur_id, depot_id)
    SELECT v_user_id, unnest(p_depot_ids);
  END IF;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION creer_gestionnaire(TEXT, TEXT, TEXT, TEXT, UUID[], BOOLEAN) TO anon, authenticated;

-- ------------------------------------------------------------
-- Modification d'un compte gestionnaire/responsable existant
-- (nom, téléphone, rôle, dépôts assignés).
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
BEGIN
  IF p_role NOT IN ('gestionnaire', 'responsable') THEN
    RAISE EXCEPTION 'Rôle invalide : %', p_role;
  END IF;

  UPDATE utilisateurs
  SET nom = TRIM(p_nom),
      contact_wa = p_tel,
      role = p_role,
      all_depots = p_all_depots,
      updated_at = now()
  WHERE id = p_user_id;

  DELETE FROM utilisateurs_depots WHERE utilisateur_id = p_user_id;

  IF p_all_depots THEN
    INSERT INTO utilisateurs_depots (utilisateur_id, depot_id)
    SELECT p_user_id, d.id FROM depots d WHERE d.actif = true;
  ELSE
    INSERT INTO utilisateurs_depots (utilisateur_id, depot_id)
    SELECT p_user_id, unnest(p_depot_ids);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION modifier_gestionnaire(UUID, TEXT, TEXT, TEXT, UUID[], BOOLEAN) TO anon, authenticated;

-- ------------------------------------------------------------
-- Active / désactive un compte utilisateur
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION toggle_utilisateur_actif(p_user_id UUID, p_actif BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE utilisateurs
  SET actif = p_actif, updated_at = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_utilisateur_actif(UUID, BOOLEAN) TO anon, authenticated;

-- ------------------------------------------------------------
-- Réinitialise le PIN d'un utilisateur à "1234"
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION reinitialiser_pin(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE utilisateurs
  SET code_pin = crypt('1234', gen_salt('bf', 8)),
      pin_change_required = true,
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION reinitialiser_pin(UUID) TO anon, authenticated;

-- ------------------------------------------------------------
-- Création d'un nouveau dépôt + auto-assignation aux utilisateurs
-- "tous dépôts" (all_depots = true).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION creer_depot(
  p_nom TEXT,
  p_type TEXT,
  p_localisation TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_depot_id UUID;
BEGIN
  INSERT INTO depots (nom, type, localisation)
  VALUES (p_nom, p_type, p_localisation)
  RETURNING id INTO v_depot_id;

  INSERT INTO utilisateurs_depots (utilisateur_id, depot_id)
  SELECT id, v_depot_id FROM utilisateurs WHERE all_depots = true;

  RETURN v_depot_id;
END;
$$;

GRANT EXECUTE ON FUNCTION creer_depot(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- Comme pour les politiques RLS (008), cette application ne crée
-- jamais de session Supabase Auth : toutes les requêtes passent en
-- tant que anon. Supabase révoque EXECUTE sur PUBLIC par défaut, donc
-- les fonctions ci-dessous (accordées seulement à authenticated en
-- 005/006) ne sont en réalité jamais appelables par le client.
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION creer_bon_sortie TO anon;
GRANT EXECUTE ON FUNCTION approuver_bon TO anon;
GRANT EXECUTE ON FUNCTION rejeter_bon TO anon;
GRANT EXECUTE ON FUNCTION valider_reception TO anon;
GRANT EXECUTE ON FUNCTION expire_bons TO anon;
