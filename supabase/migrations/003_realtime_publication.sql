-- ============================================================
-- Activation de Supabase Realtime sur les tables suivies côté client
-- (stock_produits, bons_sortie, bons_reception) via postgres_changes.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'stock_produits'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE stock_produits;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bons_sortie'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bons_sortie;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bons_reception'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bons_reception;
  END IF;
END $$;
