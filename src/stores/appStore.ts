import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Depot, NotificationItem, Utilisateur } from '../types'

const MAX_NOTIFICATIONS = 20

interface AppState {
  user: Utilisateur | null
  depots: Depot[]
  depotActifId: string | null
  notifications: NotificationItem[]
  setUser: (user: Utilisateur | null) => void
  setDepots: (depots: Depot[]) => void
  setDepotActif: (depotId: string | null) => void
  addNotification: (notification: NotificationItem) => void
  removeNotification: (id: string) => void
  marquerLu: (id: string) => void
  marquerTousLus: () => void
  reset: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      depots: [],
      depotActifId: null,
      notifications: [],
      setUser: (user) => set({ user }),
      setDepots: (depots) => set({ depots }),
      setDepotActif: (depotId) => set({ depotActifId: depotId }),
      addNotification: (notification) =>
        set((state) => ({ notifications: [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS) })),
      removeNotification: (id) =>
        set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
      marquerLu: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) => (n.id === id ? { ...n, lu: true } : n)),
        })),
      marquerTousLus: () =>
        set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, lu: true })) })),
      reset: () => set({ user: null, depots: [], depotActifId: null }),
    }),
    {
      name: 'madina-stock-app',
    }
  )
)
