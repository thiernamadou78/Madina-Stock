-- ============================================================
-- Politiques RLS de lecture
--
-- Toutes les tables ont RLS activé (001) mais aucune politique n'existe
-- encore : anon et authenticated ne peuvent lire aucune ligne. C'est ce qui
-- bloque le menu "Utilisateur" de LoginPage (la requête sur utilisateurs
-- renvoie 0 ligne, jamais une erreur, donc le sélecteur reste sur
-- "Chargement...").
--
-- Cette application n'utilise jamais Supabase Auth (l'authentification se
-- fait par PIN via la fonction verify_pin) : toutes les requêtes passent
-- avec le rôle anon. Les politiques ci-dessous incluent donc anon ET
-- authenticated (une politique "authenticated only" ne s'appliquerait
-- jamais ici).
-- ============================================================

-- ------------------------------------------------------------
-- utilisateurs : lecture des comptes actifs, colonnes limitées
-- (code_pin — hash bcrypt — n'est jamais exposé au client)
-- ------------------------------------------------------------
REVOKE SELECT ON utilisateurs FROM anon, authenticated;
GRANT SELECT (id, nom, role, contact_wa, actif) ON utilisateurs TO anon, authenticated;

CREATE POLICY "allow_read_utilisateurs"
ON utilisateurs
FOR SELECT
TO anon, authenticated
USING (actif = true);

-- ------------------------------------------------------------
-- depots
-- ------------------------------------------------------------
CREATE POLICY "allow_read_depots"
ON depots
FOR SELECT
TO anon, authenticated
USING (actif = true);

-- ------------------------------------------------------------
-- produits
-- ------------------------------------------------------------
CREATE POLICY "allow_read_produits"
ON produits
FOR SELECT
TO anon, authenticated
USING (actif = true);

-- ------------------------------------------------------------
-- stock_produits
-- ------------------------------------------------------------
CREATE POLICY "allow_read_stock_produits"
ON stock_produits
FOR SELECT
TO anon, authenticated
USING (true);

-- ------------------------------------------------------------
-- bons_sortie / lignes_bon_sortie
-- ------------------------------------------------------------
CREATE POLICY "allow_read_bons_sortie"
ON bons_sortie
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "allow_read_lignes_bon_sortie"
ON lignes_bon_sortie
FOR SELECT
TO anon, authenticated
USING (true);

-- ------------------------------------------------------------
-- bons_reception / lignes_reception
-- ------------------------------------------------------------
CREATE POLICY "allow_read_bons_reception"
ON bons_reception
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "allow_read_lignes_reception"
ON lignes_reception
FOR SELECT
TO anon, authenticated
USING (true);

-- ------------------------------------------------------------
-- alertes
-- ------------------------------------------------------------
CREATE POLICY "allow_read_alertes"
ON alertes
FOR SELECT
TO anon, authenticated
USING (true);

-- ------------------------------------------------------------
-- utilisateurs_depots
-- ------------------------------------------------------------
CREATE POLICY "allow_read_utilisateurs_depots"
ON utilisateurs_depots
FOR SELECT
TO anon, authenticated
USING (true);
