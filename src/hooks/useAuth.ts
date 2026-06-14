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

export function useAuth() {
  const user = useAppStore((s) => s.user)
  const depots = useAppStore((s) => s.depots)
  const depotActifId = useAppStore((s) => s.depotActifId)
  const setUser = useAppStore((s) => s.setUser)
  const setDepots = useAppStore((s) => s.setDepots)
  const setDepotActif = useAppStore((s) => s.setDepotActif)
  const reset = useAppStore((s) => s.reset)

  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)

  /**
   * Connexion par nom + code PIN.
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

      const row = data[0] as { id: string; nom: string; role: string; contact_wa: string | null }
      const utilisateur: Utilisateur = {
        id: row.id,
        nom: row.nom,
        role: row.role as Role,
        contact_wa: row.contact_wa ?? undefined,
        actif: true,
      }

      setAttempts(0)
      setUser(utilisateur)

      const { data: depotsData } = await supabase
        .from('utilisateurs_depots')
        .select('depot:depots(*)')
        .eq('utilisateur_id', utilisateur.id)

      const depotsUtilisateur = (depotsData ?? [])
        .map((row) => row.depot as unknown as Depot)
        .filter(Boolean)

      setDepots(depotsUtilisateur)

      return { user: utilisateur, error: null }
    } finally {
      setLoading(false)
    }
  }, [setUser, setDepots])

  /**
   * Ouvre une session de gestionnaire pour le dépôt sélectionné.
   */
  const ouvrirSession = useCallback(async (depotId: string) => {
    if (!user) return

    setDepotActif(depotId)

    const { data } = await supabase
      .from('sessions_gestionnaire')
      .insert({ user_id: user.id, depot_id: depotId })
      .select('id')
      .single()

    if (data) setSessionId(data.id)
  }, [user, setDepotActif])

  /**
   * Ferme la session de gestionnaire en cours et déconnecte l'utilisateur.
   */
  const logout = useCallback(async () => {
    if (sessionId) {
      await supabase
        .from('sessions_gestionnaire')
        .update({ ferme_le: new Date().toISOString() })
        .eq('id', sessionId)
    }
    setSessionId(null)
    reset()
  }, [sessionId, reset])

  return {
    user,
    depots,
    depotActifId,
    loading,
    attempts,
    login,
    logout,
    ouvrirSession,
    isAuthenticated: !!user,
  }
}
