-- ============================================================
-- Authentification par code PIN (bcrypt via pgcrypto)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION verify_pin(p_nom TEXT, p_pin TEXT)
RETURNS TABLE(id UUID, nom TEXT, role TEXT, contact_wa TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.nom, u.role::TEXT, u.contact_wa
  FROM utilisateurs u
  WHERE u.nom = p_nom
    AND u.actif = true
    AND u.code_pin = crypt(p_pin, u.code_pin);
END;
$$;

UPDATE utilisateurs
SET code_pin = crypt('1234', gen_salt('bf', 8));

GRANT EXECUTE ON FUNCTION verify_pin(TEXT, TEXT) TO anon, authenticated;
