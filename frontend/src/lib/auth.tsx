import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import type { Role, User } from '../types'

export type AuthUser = User & { avatarUrl?: string | null }

export type AuthState = {
  user: AuthUser | null
  role: Role | null
  loading: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

// ถาม /api/me ตอนเปิดแอป — ได้ผู้ใช้ = มี session อยู่, 401 = ยังไม่ได้เข้าสู่ระบบ
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setUser(await api.me())
    } catch {
      // 401 เป็นเรื่องปกติตอนยังไม่ login ไม่ต้องแสดง error
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signOut = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
      // กลับไปหน้าแรกให้ route guard พาไปหน้า sign-in เอง
      window.location.href = '/'
    }
  }, [])

  return (
    <AuthContext value={{ user, role: user?.role ?? null, loading, signOut, refresh }}>
      {children}
    </AuthContext>
  )
}
