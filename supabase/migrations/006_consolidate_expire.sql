-- ============================================================
-- Consolidation de l'expiration des bons de sortie
--
-- Remplace les deux fonctions concurrentes :
--   - expire_bons_sortie() (002) : libère qte_reservee via une fenêtre
--     glissante de 6 min sur updated_at -> peut relibérer la même
--     réservation à chaque exécution cron tant que le bon reste dans
--     cette fenêtre (double libération de qte_reservee).
--   - expire_bons() (005) : version idempotente (ne traite que les bons
--     encore 'en_attente'), mais non planifiée.
--
-- Par une unique fonction expire_bons(), idempotente.
--
-- pg_cron n'est pas disponible sur le plan gratuit Supabase : la fonction
-- n'est donc PAS planifiée ici. Elle est appelée côté client via
-- supabase.rpc('expire_bons') (voir src/hooks/useExpiration.ts).
-- ============================================================

DROP FUNCTION IF EXISTS expire_bons_sortie();
DROP FUNCTION IF EXISTS expire_bons();

CREATE OR REPLACE FUNCTION expire_bons()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bon RECORD;
  v_ligne RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_bon IN
    SELECT id, depot_id FROM bons_sortie
    WHERE statut = 'en_attente'
      AND expire_le < now()
  LOOP
    -- Libère les réservations
    FOR v_ligne IN
      SELECT produit_id, qte_demandee
      FROM lignes_bon_sortie
      WHERE bon_id = v_bon.id
    LOOP
      UPDATE stock_produits
      SET qte_reservee = GREATEST(0, qte_reservee - v_ligne.qte_demandee),
          updated_at = now()
      WHERE depot_id = v_bon.depot_id
        AND produit_id = v_ligne.produit_id;
    END LOOP;

    -- Expire le bon
    UPDATE bons_sortie
    SET statut = 'expire',
        updated_at = now()
    WHERE id = v_bon.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_bons() TO authenticated;
