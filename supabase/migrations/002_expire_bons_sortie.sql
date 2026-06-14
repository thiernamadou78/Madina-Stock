-- ============================================================
-- Expiration automatique des bons de sortie en attente
-- ============================================================

-- ------------------------------------------------------------
-- Fonction : expire les bons en attente dont le délai est dépassé,
-- puis libère les réservations de stock correspondantes.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION expire_bons_sortie()
RETURNS void AS $$
BEGIN
  UPDATE bons_sortie
  SET statut = 'expire',
      updated_at = now()
  WHERE statut = 'en_attente'
    AND expire_le < now();

  -- Libère les réservations des bons qui viennent d'expirer
  UPDATE stock_produits sp
  SET qte_reservee = qte_reservee - lbs.qte_demandee
  FROM lignes_bon_sortie lbs
  JOIN bons_sortie bs ON bs.id = lbs.bon_id
  WHERE lbs.produit_id = sp.produit_id
    AND bs.depot_id = sp.depot_id
    AND bs.statut = 'expire'
    AND bs.updated_at > now() - INTERVAL '6 minutes';
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- Planification via pg_cron : exécute la fonction toutes les 5 minutes.
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'expire-bons-sortie',
  '*/5 * * * *',
  'SELECT expire_bons_sortie();'
);

-- ------------------------------------------------------------
-- Alternative : déclencher l'Edge Function "expire-bons" via pg_cron +
-- pg_net (utile si vous voulez centraliser la logique d'expiration côté
-- Edge Function plutôt que dans Postgres, ou y ajouter des notifications).
-- Stockez l'URL du projet et la clé service_role dans Supabase Vault, puis :
--
-- CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- SELECT cron.schedule(
--   'expire-bons-edge-function',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/expire-bons',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
--
-- Ou bien, sans pg_cron : configurez un "Cron Trigger" sur la fonction
-- expire-bons depuis le Dashboard Supabase (Edge Functions > expire-bons > Cron),
-- avec l'expression "*/5 * * * *".
