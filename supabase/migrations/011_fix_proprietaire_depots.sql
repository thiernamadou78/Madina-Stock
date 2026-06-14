-- ============================================================
-- Migration 011 : propriétaire/admin voient toujours tous les dépôts
-- ============================================================
-- Problème : à la création d'un nouveau dépôt, seuls les
-- utilisateurs avec all_depots = true sont auto-assignés dans
-- utilisateurs_depots. Les comptes proprietaire/admin créés avant
-- l'activation de all_depots (ou sans ce flag) n'étaient donc pas
-- assignés aux nouveaux dépôts.
--
-- Cette migration met à jour creer_depot() pour auto-assigner
-- systématiquement les utilisateurs proprietaire/admin, en plus de
-- ceux ayant all_depots = true.
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
  SELECT id, v_depot_id FROM utilisateurs u
  WHERE u.all_depots = true
     OR u.role IN ('proprietaire', 'admin');

  RETURN v_depot_id;
END;
$$;

GRANT EXECUTE ON FUNCTION creer_depot(TEXT, TEXT, TEXT) TO anon, authenticated;
