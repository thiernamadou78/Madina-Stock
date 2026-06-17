-- ============================================================
-- 013 — verify_pin / verify_pin_tel : retourne entreprise_id,
-- all_depots, pin_change_required et vérifie le statut du compte
-- (suspendu / supprimé / expiré).
-- ============================================================

CREATE OR REPLACE FUNCTION verify_pin(p_nom TEXT, p_pin TEXT)
RETURNS TABLE(
  id UUID, nom TEXT, role TEXT, contact_wa TEXT,
  entreprise_id UUID, all_depots BOOLEAN, pin_change_required BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_statut TEXT;
  v_expiration TIMESTAMPTZ;
BEGIN
  -- Vérification du statut de l'entreprise (sauf pour superadmin sans entreprise)
  SELECT e.statut, e.date_expiration
  INTO v_statut, v_expiration
  FROM utilisateurs u
  LEFT JOIN entreprises e ON e.id = u.entreprise_id
  WHERE u.nom = p_nom AND u.actif = true
  LIMIT 1;

  IF v_statut = 'suspendu' THEN
    RAISE EXCEPTION 'COMPTE_SUSPENDU';
  END IF;

  IF v_statut = 'supprime' THEN
    RAISE EXCEPTION 'COMPTE_SUPPRIME';
  END IF;

  IF v_expiration IS NOT NULL AND v_expiration < now() THEN
    RAISE EXCEPTION 'COMPTE_EXPIRE';
  END IF;

  RETURN QUERY
  SELECT u.id, u.nom, u.role::TEXT, u.contact_wa,
         u.entreprise_id, COALESCE(u.all_depots, false), COALESCE(u.pin_change_required, false)
  FROM utilisateurs u
  WHERE u.nom = p_nom
    AND u.actif = true
    AND u.code_pin = crypt(p_pin, u.code_pin);
END;
$$;

GRANT EXECUTE ON FUNCTION verify_pin(TEXT, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION verify_pin_tel(p_tel TEXT, p_pin TEXT)
RETURNS TABLE(
  id UUID, nom TEXT, role TEXT, contact_wa TEXT,
  entreprise_id UUID, all_depots BOOLEAN, pin_change_required BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_statut TEXT;
  v_expiration TIMESTAMPTZ;
BEGIN
  SELECT e.statut, e.date_expiration
  INTO v_statut, v_expiration
  FROM utilisateurs u
  LEFT JOIN entreprises e ON e.id = u.entreprise_id
  WHERE u.contact_wa = p_tel AND u.actif = true
  LIMIT 1;

  IF v_statut = 'suspendu' THEN
    RAISE EXCEPTION 'COMPTE_SUSPENDU';
  END IF;

  IF v_statut = 'supprime' THEN
    RAISE EXCEPTION 'COMPTE_SUPPRIME';
  END IF;

  IF v_expiration IS NOT NULL AND v_expiration < now() THEN
    RAISE EXCEPTION 'COMPTE_EXPIRE';
  END IF;

  RETURN QUERY
  SELECT u.id, u.nom, u.role::TEXT, u.contact_wa,
         u.entreprise_id, COALESCE(u.all_depots, false), COALESCE(u.pin_change_required, false)
  FROM utilisateurs u
  WHERE u.contact_wa = p_tel
    AND u.actif = true
    AND u.code_pin = crypt(p_pin, u.code_pin);
END;
$$;

GRANT EXECUTE ON FUNCTION verify_pin_tel(TEXT, TEXT) TO anon, authenticated;
