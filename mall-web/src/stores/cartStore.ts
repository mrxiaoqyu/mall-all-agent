import { create } from 'zustand'
import { cartApi } from '../api'
import { useAuthStore } from './authStore'

interface CartState {
  count: number
  setCount: (count: number) => void
  refresh: () => Promise<void>
}

export const useCartStore = create<CartState>()((set) => ({
  count: 0,
  setCount: (count) => set({ count }),
  refresh: async () => {
    if (!useAuthStore.getState().token) {
      set({ count: 0 })
      return
    }
    try {
      const groups = await cartApi.list()
      const count = groups.reduce(
        (sum, g) => sum + g.items.reduce((s, item) => s + item.quantity, 0),
        0,
      )
      set({ count })
    } catch {
      // 忽略角标刷新失败
    }
  },
}))
