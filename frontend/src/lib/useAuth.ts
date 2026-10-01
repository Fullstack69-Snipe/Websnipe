import { createContext, useContext } from 'react'
import type { AuthState } from './auth'

// อยู่ไฟล์นี้แทน auth.tsx เพราะ Fast Refresh ต้องการให้ไฟล์ .tsx export แต่ component
export const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth ต้องอยู่ใน <AuthProvider>')
  return ctx
}
