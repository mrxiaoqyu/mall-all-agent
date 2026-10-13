import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, type LoginResult } from '../api'

interface AuthState {
  token: string | null
  userId: number | null
  username: string
  nickname: string
  login: (data: LoginResult) => void
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: localStorage.getItem('mall_token'),
      userId: null,
      username: '',
      nickname: '',
      login: (data) => {
        localStorage.setItem('mall_token', data.token)
        set({
          token: data.token,
          userId: data.user_id,
          username: data.username,
          nickname: data.nickname,
        })
      },
      logout: () => {
        localStorage.removeItem('mall_token')
        set({ token: null, userId: null, username: '', nickname: '' })
      },
      fetchMe: async () => {
        const me = await authApi.me()
        set({ userId: me.id, username: me.username, nickname: me.nickname })
      },
    }),
    { name: 'mall_auth' },
  ),
)
