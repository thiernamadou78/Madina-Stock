-- ============================================================
-- 016 — La table utilisateurs n'autorise la lecture que de colonnes
-- précises (008_rls_policies.sql), jamais mise à jour avec
-- entreprise_id (ajoutée en 012). Toute requête filtrant ou
-- sélectionnant cette colonne échoue silencieusement (permission denied)
-- pour le rôle anon — cassant UsersPage, fetchAdmins() (notifications
-- de nouveaux bons) et les pages SuperAdmin.
-- ============================================================

GRANT SELECT (entreprise_id) ON utilisateurs TO anon, authenticated;
