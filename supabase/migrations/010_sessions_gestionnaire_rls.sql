-- ============================================================
-- 010 — Politique RLS et privilèges pour sessions_gestionnaire
-- ============================================================
--
-- Comme pour 008/009, cette application ne crée jamais de session
-- Supabase Auth : toutes les requêtes passent en tant que anon.
-- sessions_gestionnaire a RLS activé depuis 001 mais n'a jamais reçu
-- de policy ni de GRANT, ce qui bloque silencieusement ouvrirSession()
-- (INSERT à l'ouverture de dépôt) et logout() (UPDATE ferme_le).
-- ------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON sessions_gestionnaire TO anon, authenticated;

CREATE POLICY "allow_all_sessions_gestionnaire"
ON sessions_gestionnaire
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
