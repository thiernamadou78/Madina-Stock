-- ============================================================
-- Onboarding : création du premier compte propriétaire et de son
-- premier dépôt. Affiché uniquement quand la table utilisateurs
-- est vide (voir src/router/index.tsx et src/pages/OnboardingPage.tsx).
-- ============================================================

CREATE OR REPLACE FUNCTION creer_proprietaire(
  p_nom TEXT,
  p_contact_wa TEXT,
  p_pin TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER;
BEGIN
  -- Sécurité : ne fonctionne que si aucun propriétaire n'existe encore
  SELECT COUNT(*) INTO v_count
  FROM utilisateurs
  WHERE role = 'proprietaire';

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Un propriétaire existe déjà';
  END IF;

  INSERT INTO utilisateurs (nom, role, contact_wa, code_pin, actif)
  VALUES (
    p_nom,
    'proprietaire',
    p_contact_wa,
    crypt(p_pin, gen_salt('bf', 8)),
    true
  )
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$;

-- Autorise les appels anonymes : l'onboarding se fait avant toute connexion
GRANT EXECUTE ON FUNCTION creer_proprietaire(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- Crée le premier dépôt et l'associe au propriétaire créé ci-dessus.
-- Passe par une fonction SECURITY DEFINER pour éviter les écritures
-- directes sur depots/utilisateurs_depots, bloquées par la RLS pour
-- le rôle anon pendant l'onboarding (avant toute connexion).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION creer_premier_depot(
  p_proprietaire_id UUID,
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
  VALUES (p_proprietaire_id, v_depot_id);

  RETURN v_depot_id;
END;
$$;

GRANT EXECUTE ON FUNCTION creer_premier_depot(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
