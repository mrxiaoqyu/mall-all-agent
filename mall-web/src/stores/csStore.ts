import { create } from 'zustand'
import { csApi } from '../api'
import { useAuthStore } from './authStore'

interface CsState {
  unread: number
  setUnread: (unread: number) => void
  refresh: () => Promise<void>
}

export const useCsStore = create<CsState>()((set) => ({
  unread: 0,
  setUnread: (unread) => set({ unread }),
  refresh: async () => {
    if (!useAuthStore.getState().token) {
      set({ unread: 0 })
      return
    }
    try {
      const res = await csApi.unread()
      set({ unread: res.unread })
    } catch {
      // 忽略未读数刷新失败
    }
  },
}))
