import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'admin' | 'merchant'

interface AuthState {
  token: string | null
  role: Role | null
  userId: number | null
  username: string
  shopId: number | null
  login: (payload: {
    token: string
    role: Role
    userId?: number | null
    username: string
    shopId?: number | null
  }) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      userId: null,
      username: '',
      shopId: null,
      login: ({ token, role, userId, username, shopId }) => {
        localStorage.setItem('admin_token', token)
        set({ token, role, userId: userId ?? null, username, shopId: shopId ?? null })
      },
      logout: () => {
        localStorage.removeItem('admin_token')
        set({ token: null, role: null, userId: null, username: '', shopId: null })
      },
    }),
    {
      name: 'mall-admin-auth',
    },
  ),
)
