import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import type { Depot, Role, Utilisateur } from '../types'

interface LoginResult {
  user: Utilisateur | null
  error: string | null
}

/**
 * Liste les utilisateurs actifs, pour la sélection à l'écran de connexion.
 */
export async function listerUtilisateurs(): Promise<Utilisateur[]> {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('id, nom, role, contact_wa, actif')
    .eq('actif', true)
    .order('nom')

  if (error) throw error
  return (data ?? []) as unknown as Utilisateur[]
}

async function fetchAllDepotsFlag(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('utilisateurs')
    .select('all_depots')
    .eq('id', userId)
    .single()

  return (data as { all_depots?: boolean } | null)?.all_depots ?? false
}

async function fetchDepotsForUser(userId: string, allDepots: boolean): Promise<Depot[]> {
  if (allDepots) {
    const { data } = await supabase.from('depots').select('*').eq('actif', true)
    return (data ?? []) as unknown as Depot[]
  }

  const { data } = await supabase
    .from('utilisateurs_depots')
    .select('depot:depots(*)')
    .eq('utilisateur_id', userId)

  return (data ?? [])
    .map((row) => row.depot as unknown as Depot)
    .filter(Boolean)
}

export function useAuth() {
  const user = useAppStore((s) => s.user)
  const depots = useAppStore((s) => s.depots)
  const depotActifId = useAppStore((s) => s.depotActifId)
  const setUser = useAppStore((s) => s.setUser)
  const setDepots = useAppStore((s) => s.setDepots)
  const setDepotActif = useAppStore((s) => s.setDepotActif)
  const reset = useAppStore((s) => s.reset)

  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)

  const finalizeLogin = useCallback(async (row: {
    id: string
    nom: string
    role: string
    contact_wa: string | null
  }): Promise<LoginResult> => {
    const allDepots = await fetchAllDepotsFlag(row.id)
    const utilisateur: Utilisateur = {
      id: row.id,
      nom: row.nom,
      role: row.role as Role,
      contact_wa: row.contact_wa ?? undefined,
      actif: true,
      all_depots: allDepots,
    }

    setAttempts(0)
    setUser(utilisateur)

    const depotsUtilisateur = await fetchDepotsForUser(utilisateur.id, allDepots)
    setDepots(depotsUtilisateur)

    return { user: utilisateur, error: null }
  }, [setUser, setDepots])

  /**
   * Connexion propriétaire par nom + code PIN.
   * La vérification du hash bcrypt est déléguée à une fonction RPC
   * Supabase (`verify_pin`) afin de ne jamais exposer le hash au client.
   */
  const login = useCallback(async (nom: string, codePin: string): Promise<LoginResult> => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('verify_pin', {
        p_nom: nom,
        p_pin: codePin,
      })

      if (error || !data || data.length === 0) {
        setAttempts((a) => a + 1)
        return { user: null, error: 'Code PIN incorrect' }
      }

      return await finalizeLogin(data[0] as { id: string; nom: string; role: string; contact_wa: string | null })
    } finally {
      setLoading(false)
    }
  }, [finalizeLogin])

  /**
   * Connexion gestionnaire par numéro de téléphone (contact_wa) + code PIN.
   */
  const loginTel = useCallback(async (tel: string, codePin: string): Promise<LoginResult> => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('verify_pin_tel', {
        p_tel: tel,
        p_pin: codePin,
      })

      if (error || !data || data.length === 0) {
        setAttempts((a) => a + 1)
        return { user: null, error: 'Téléphone ou code PIN incorrect' }
      }

      return await finalizeLogin(data[0] as { id: string; nom: string; role: string; contact_wa: string | null })
    } finally {
      setLoading(false)
    }
  }, [finalizeLogin])

  /**
   * Ouvre une session de gestionnaire pour le dépôt sélectionné.
   */
  const ouvrirSession = useCallback(async (depotId: string) => {
    if (!user) return

    setDepotActif(depotId)

    await supabase
      .from('sessions_gestionnaire')
      .insert({ user_id: user.id, depot_id: depotId })
  }, [user, setDepotActif])

  /**
   * Ferme la session de gestionnaire en cours et déconnecte l'utilisateur.
   */
  const logout = useCallback(async () => {
    if (user) {
      await supabase
        .from('sessions_gestionnaire')
        .update({ ferme_le: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('ferme_le', null)
    }
    reset()
  }, [user, reset])

  return {
    user,
    depots,
    depotActifId,
    loading,
    attempts,
    login,
    loginTel,
    logout,
    ouvrirSession,
    isAuthenticated: !!user,
  }
}
