import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Team {
  id: string
  name: string
  qr_token: string
}

interface User {
  id: string
  email: string
  full_name: string
  role: 'ratownik' | 'koordynator' | 'admin'
}

interface AppState {
  user: User | null
  currentTeam: Team | null
  offlineQueue: any[]
  setUser: (user: User | null) => void
  setCurrentTeam: (team: Team | null) => void
  addToOfflineQueue: (action: any) => void
  clearOfflineQueue: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      currentTeam: null,
      offlineQueue: [],
      setUser: (user) => set({ user }),
      setCurrentTeam: (team) => set({ currentTeam: team }),
      addToOfflineQueue: (action) => 
        set((state) => ({ offlineQueue: [...state.offlineQueue, action] })),
      clearOfflineQueue: () => set({ offlineQueue: [] }),
    }),
    {
      name: 'medstock-storage',
    }
  )
)