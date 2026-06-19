-- ============================================================
-- 015 — changer_pin (forced PIN change) + unicité du numéro de
-- téléphone par entreprise (anti-doublon gestionnaire/propriétaire).
-- ============================================================

-- ------------------------------------------------------------
-- changer_pin : permet à l'utilisateur de définir un nouveau PIN
-- (appelé après le login forcé quand pin_change_required = true).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION changer_pin(p_user_id UUID, p_nouveau_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_nouveau_pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'Le PIN doit être composé de 4 chiffres';
  END IF;

  UPDATE utilisateurs
  SET code_pin = crypt(p_nouveau_pin, gen_salt('bf', 8)),
      pin_change_required = false,
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION changer_pin(UUID, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- creer_gestionnaire — refuse les doublons de numéro au sein
-- de la même entreprise (parmi les comptes actifs).
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

  IF EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE contact_wa = p_tel
      AND actif = true
      AND entreprise_id = p_entreprise_id
  ) THEN
    RAISE EXCEPTION 'NUMERO_DEJA_UTILISE';
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
-- modifier_gestionnaire — même contrôle de doublon (hors lui-même)
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

  IF EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE contact_wa = p_tel
      AND actif = true
      AND entreprise_id = v_entreprise_id
      AND id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'NUMERO_DEJA_UTILISE';
  END IF;

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

-- ------------------------------------------------------------
-- creer_proprietaire — téléphone obligatoire + refuse les doublons
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION creer_proprietaire(
  p_prenom         TEXT,
  p_nom            TEXT,
  p_tel            TEXT,
  p_code_pin       TEXT,
  p_entreprise_id  UUID
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_tel TEXT := TRIM(p_tel);
BEGIN
  IF p_code_pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'Le PIN doit être composé de 4 chiffres';
  END IF;

  IF v_tel IS NULL OR v_tel = '' THEN
    RAISE EXCEPTION 'Le numéro de téléphone est requis';
  END IF;

  IF EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE contact_wa = v_tel
      AND actif = true
      AND entreprise_id = p_entreprise_id
  ) THEN
    RAISE EXCEPTION 'NUMERO_DEJA_UTILISE';
  END IF;

  INSERT INTO utilisateurs (
    nom, role, contact_wa, code_pin,
    actif, all_depots, pin_change_required, entreprise_id
  ) VALUES (
    TRIM(p_prenom || ' ' || p_nom),
    'proprietaire',
    v_tel,
    crypt(p_code_pin, gen_salt('bf', 8)),
    true,
    true,
    false,
    p_entreprise_id
  ) RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION creer_proprietaire(TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;

-- ------------------------------------------------------------
-- Filet de sécurité au niveau base : empêche tout doublon de
-- numéro actif au sein d'une même entreprise, même en cas
-- d'écriture concurrente (race condition).
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_utilisateurs_entreprise_tel_actif
  ON utilisateurs (entreprise_id, contact_wa)
  WHERE contact_wa IS NOT NULL AND contact_wa <> '' AND actif = true;
