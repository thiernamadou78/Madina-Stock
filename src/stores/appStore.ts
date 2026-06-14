import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Depot, Utilisateur } from '../types'

interface AppState {
  user: Utilisateur | null
  depots: Depot[]
  depotActifId: string | null
  setUser: (user: Utilisateur | null) => void
  setDepots: (depots: Depot[]) => void
  setDepotActif: (depotId: string | null) => void
  reset: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      depots: [],
      depotActifId: null,
      setUser: (user) => set({ user }),
      setDepots: (depots) => set({ depots }),
      setDepotActif: (depotId) => set({ depotActifId: depotId }),
      reset: () => set({ user: null, depots: [], depotActifId: null }),
    }),
    {
      name: 'madina-stock-app',
    }
  )
)
