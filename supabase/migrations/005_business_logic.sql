-- ============================================================
-- Logique métier centralisée côté PostgreSQL (RPC)
-- Remplace toute mutation directe des tables depuis le client.
-- ============================================================

CREATE OR REPLACE FUNCTION creer_bon_sortie(
  p_gestionnaire_id UUID,
  p_depot_id UUID,
  p_motif TEXT,
  p_depot_destination_id UUID,
  p_lignes JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bon_id UUID;
  v_numero TEXT;
  v_ligne JSONB;
  v_qte_nette INTEGER;
BEGIN
  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    SELECT (qte_disponible - qte_reservee) INTO v_qte_nette
    FROM stock_produits
    WHERE depot_id = p_depot_id
      AND produit_id = (v_ligne->>'produit_id')::UUID
    FOR UPDATE;

    IF v_qte_nette IS NULL OR v_qte_nette < (v_ligne->>'qte_demandee')::INTEGER THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Stock insuffisant',
        'disponible', COALESCE(v_qte_nette, 0),
        'demande', (v_ligne->>'qte_demandee')::INTEGER
      );
    END IF;
  END LOOP;

  v_numero := next_bon_sortie_numero();
  INSERT INTO bons_sortie (
    numero, gestionnaire_id, depot_id, motif,
    depot_destination_id, statut
  ) VALUES (
    v_numero, p_gestionnaire_id, p_depot_id, p_motif,
    p_depot_destination_id, 'en_attente'
  ) RETURNING id INTO v_bon_id;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    INSERT INTO lignes_bon_sortie (bon_id, produit_id, qte_demandee)
    VALUES (
      v_bon_id,
      (v_ligne->>'produit_id')::UUID,
      (v_ligne->>'qte_demandee')::INTEGER
    );

    UPDATE stock_produits
    SET qte_reservee = qte_reservee + (v_ligne->>'qte_demandee')::INTEGER,
        updated_at = now()
    WHERE depot_id = p_depot_id
      AND produit_id = (v_ligne->>'produit_id')::UUID;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'bon_id', v_bon_id, 'numero', v_numero);
END;
$$;

CREATE OR REPLACE FUNCTION approuver_bon(
  p_bon_id UUID,
  p_validateur_id UUID,
  p_modifications JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ligne RECORD;
  v_qte_accordee INTEGER;
  v_depot_id UUID;
BEGIN
  SELECT depot_id INTO v_depot_id FROM bons_sortie WHERE id = p_bon_id;

  FOR v_ligne IN
    SELECT id, produit_id, qte_demandee FROM lignes_bon_sortie WHERE bon_id = p_bon_id
  LOOP
    v_qte_accordee := v_ligne.qte_demandee;
    IF p_modifications IS NOT NULL THEN
      SELECT (m->>'qte_accordee')::INTEGER INTO v_qte_accordee
      FROM jsonb_array_elements(p_modifications) m
      WHERE (m->>'ligne_id')::UUID = v_ligne.id LIMIT 1;
      v_qte_accordee := COALESCE(v_qte_accordee, v_ligne.qte_demandee);
    END IF;

    UPDATE lignes_bon_sortie SET qte_accordee = v_qte_accordee WHERE id = v_ligne.id;

    UPDATE stock_produits
    SET qte_disponible = qte_disponible - v_qte_accordee,
        qte_reservee   = GREATEST(0, qte_reservee - v_ligne.qte_demandee),
        updated_at = now()
    WHERE depot_id = v_depot_id AND produit_id = v_ligne.produit_id;
  END LOOP;

  UPDATE bons_sortie
  SET statut = 'approuve', valide_par = p_validateur_id, valide_le = now()
  WHERE id = p_bon_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION rejeter_bon(
  p_bon_id UUID,
  p_validateur_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ligne RECORD;
  v_depot_id UUID;
BEGIN
  SELECT depot_id INTO v_depot_id FROM bons_sortie WHERE id = p_bon_id;

  FOR v_ligne IN
    SELECT produit_id, qte_demandee FROM lignes_bon_sortie WHERE bon_id = p_bon_id
  LOOP
    UPDATE stock_produits
    SET qte_reservee = GREATEST(0, qte_reservee - v_ligne.qte_demandee),
        updated_at = now()
    WHERE depot_id = v_depot_id AND produit_id = v_ligne.produit_id;
  END LOOP;

  UPDATE bons_sortie
  SET statut = 'rejete', valide_par = p_validateur_id, valide_le = now()
  WHERE id = p_bon_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION valider_reception(
  p_reception_id UUID,
  p_validateur_id UUID,
  p_lignes JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ligne RECORD;
  v_params JSONB;
  v_valide BOOLEAN;
  v_prix NUMERIC;
  v_depot_id UUID;
BEGIN
  SELECT depot_id INTO v_depot_id FROM bons_reception WHERE id = p_reception_id;

  FOR v_ligne IN
    SELECT id, produit_id, qte_recue FROM lignes_reception WHERE reception_id = p_reception_id
  LOOP
    SELECT m INTO v_params
    FROM jsonb_array_elements(p_lignes) m
    WHERE (m->>'ligne_id')::UUID = v_ligne.id LIMIT 1;

    v_valide := COALESCE((v_params->>'valide')::BOOLEAN, true);
    v_prix   := (v_params->>'prix_achat')::NUMERIC;

    UPDATE lignes_reception
    SET valide = v_valide, prix_achat_unitaire = v_prix
    WHERE id = v_ligne.id;

    IF v_valide THEN
      INSERT INTO stock_produits (depot_id, produit_id, qte_disponible, prix_achat_dernier)
      VALUES (v_depot_id, v_ligne.produit_id, v_ligne.qte_recue, v_prix)
      ON CONFLICT (depot_id, produit_id) DO UPDATE
        SET qte_disponible    = stock_produits.qte_disponible + v_ligne.qte_recue,
            prix_achat_dernier = COALESCE(v_prix, stock_produits.prix_achat_dernier),
            updated_at = now();
    END IF;
  END LOOP;

  UPDATE bons_reception
  SET statut = 'valide', valide_par = p_validateur_id, valide_le = now()
  WHERE id = p_reception_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

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
    WHERE statut = 'en_attente' AND expire_le < now()
  LOOP
    FOR v_ligne IN
      SELECT produit_id, qte_demandee FROM lignes_bon_sortie WHERE bon_id = v_bon.id
    LOOP
      UPDATE stock_produits
      SET qte_reservee = GREATEST(0, qte_reservee - v_ligne.qte_demandee),
          updated_at = now()
      WHERE depot_id = v_bon.depot_id AND produit_id = v_ligne.produit_id;
    END LOOP;
    UPDATE bons_sortie SET statut = 'expire' WHERE id = v_bon.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION creer_bon_sortie TO authenticated;
GRANT EXECUTE ON FUNCTION approuver_bon TO authenticated;
GRANT EXECUTE ON FUNCTION rejeter_bon TO authenticated;
GRANT EXECUTE ON FUNCTION valider_reception TO authenticated;
GRANT EXECUTE ON FUNCTION expire_bons TO authenticated;
