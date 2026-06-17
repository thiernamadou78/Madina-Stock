import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import { demanderPermissionPush } from '../lib/notifications'
import type { Depot, Role, Utilisateur } from '../types'

interface LoginResult {
  user: Utilisateur | null
  error: string | null
}

/**
 * Liste les utilisateurs actifs pour la sélection à l'écran de connexion.
 * Exclut le superadmin qui dispose de son propre écran de connexion.
 */
export async function listerUtilisateurs(): Promise<Utilisateur[]> {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('id, nom, role, contact_wa, actif')
    .eq('actif', true)
    .neq('role', 'superadmin')
    .order('nom')

  if (error) throw error
  return (data ?? []) as unknown as Utilisateur[]
}

/**
 * Charge la liste des dépôts accessibles à un utilisateur selon son rôle,
 * filtrés par entreprise_id pour l'isolation multi-tenant.
 */
async function chargerDepots(user: Utilisateur): Promise<Depot[]> {
  const entrepriseId = user.entreprise_id

  if (user.role === 'proprietaire' || user.role === 'admin') {
    const { data } = await supabase
      .from('depots')
      .select('*')
      .eq('actif', true)
      .eq('entreprise_id', entrepriseId ?? '')
      .order('nom')
    return (data ?? []) as unknown as Depot[]
  }

  if (user.all_depots) {
    const { data } = await supabase
      .from('depots')
      .select('*')
      .eq('actif', true)
      .eq('entreprise_id', entrepriseId ?? '')
      .order('nom')
    return (data ?? []) as unknown as Depot[]
  }

  const { data } = await supabase
    .from('utilisateurs_depots')
    .select('depot:depots(id, nom, type, localisation, actif)')
    .eq('utilisateur_id', user.id)

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
    entreprise_id?: string | null
    all_depots?: boolean | null
    pin_change_required?: boolean | null
  }): Promise<LoginResult> => {
    const utilisateur: Utilisateur = {
      id: row.id,
      nom: row.nom,
      role: row.role as Role,
      contact_wa: row.contact_wa ?? undefined,
      actif: true,
      all_depots: row.all_depots ?? false,
      entreprise_id: row.entreprise_id ?? undefined,
      pin_change_required: row.pin_change_required ?? undefined,
    }

    setAttempts(0)
    setUser(utilisateur)

    // Le superadmin n'a pas de dépôts
    if (utilisateur.role !== 'superadmin') {
      const depotsUtilisateur = await chargerDepots(utilisateur)
      setDepots(depotsUtilisateur)
      void demanderPermissionPush()
    }

    return { user: utilisateur, error: null }
  }, [setUser, setDepots])

  const login = useCallback(async (nom: string, codePin: string): Promise<LoginResult> => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('verify_pin', {
        p_nom: nom,
        p_pin: codePin,
      })

      if (error) {
        setAttempts((a) => a + 1)
        if (error.message?.includes('COMPTE_SUSPENDU')) {
          return { user: null, error: 'Ce compte est suspendu. Contactez l\'administrateur.' }
        }
        if (error.message?.includes('COMPTE_EXPIRE')) {
          return { user: null, error: 'Votre abonnement a expiré. Contactez MadinaStock.' }
        }
        if (error.message?.includes('COMPTE_SUPPRIME')) {
          return { user: null, error: 'Ce compte a été supprimé.' }
        }
        return { user: null, error: 'Code PIN incorrect' }
      }

      if (!data || data.length === 0) {
        setAttempts((a) => a + 1)
        return { user: null, error: 'Code PIN incorrect' }
      }

      return await finalizeLogin(data[0] as {
        id: string; nom: string; role: string; contact_wa: string | null
        entreprise_id: string | null; all_depots: boolean | null; pin_change_required: boolean | null
      })
    } finally {
      setLoading(false)
    }
  }, [finalizeLogin])

  const loginTel = useCallback(async (tel: string, codePin: string): Promise<LoginResult> => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('verify_pin_tel', {
        p_tel: tel,
        p_pin: codePin,
      })

      if (error) {
        setAttempts((a) => a + 1)
        if (error.message?.includes('COMPTE_SUSPENDU')) {
          return { user: null, error: 'Ce compte est suspendu. Contactez l\'administrateur.' }
        }
        if (error.message?.includes('COMPTE_EXPIRE')) {
          return { user: null, error: 'Votre abonnement a expiré. Contactez MadinaStock.' }
        }
        return { user: null, error: 'Téléphone ou code PIN incorrect' }
      }

      if (!data || data.length === 0) {
        setAttempts((a) => a + 1)
        return { user: null, error: 'Téléphone ou code PIN incorrect' }
      }

      return await finalizeLogin(data[0] as {
        id: string; nom: string; role: string; contact_wa: string | null
        entreprise_id: string | null; all_depots: boolean | null; pin_change_required: boolean | null
      })
    } finally {
      setLoading(false)
    }
  }, [finalizeLogin])

  const ouvrirSession = useCallback(async (depotId: string) => {
    if (!user) return
    setDepotActif(depotId)
    await supabase.from('sessions_gestionnaire').insert({ user_id: user.id, depot_id: depotId })
  }, [user, setDepotActif])

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
