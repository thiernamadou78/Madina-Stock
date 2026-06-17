-- ============================================================
-- 014 — creer_proprietaire : crée le compte propriétaire
-- d'une entreprise avec un PIN défini par le SuperAdmin.
-- ============================================================

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
BEGIN
  IF p_code_pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'Le PIN doit être composé de 4 chiffres';
  END IF;

  INSERT INTO utilisateurs (
    nom, role, contact_wa, code_pin,
    actif, all_depots, pin_change_required, entreprise_id
  ) VALUES (
    TRIM(p_prenom || ' ' || p_nom),
    'proprietaire',
    NULLIF(TRIM(p_tel), ''),
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
