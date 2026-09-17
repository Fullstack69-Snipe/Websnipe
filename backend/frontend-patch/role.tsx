import { createContext, useState, type ReactNode } from 'react'
import type { Role } from '../types'
import { setCurrentRole } from './realApi'

export const RoleContext = createContext<{
  role: Role
  setRole: (r: Role) => void
} | null>(null)

// เพิ่มจากเดิมแค่บรรทัด setCurrentRole ใน setRole
// เพื่อให้ role ที่สลับบนจอถูกส่งไปกับทุก request (header x-role)
// ไม่งั้นสลับเป็น staff บนหน้าจอแล้วยังโดน backend ตอบ 403 อยู่
export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
    const saved = localStorage.getItem('role') as Role | null
    const initial = saved ?? 'user'
    setCurrentRole(initial)
    return initial
  })

  const setRole = (r: Role) => {
    setRoleState(r)
    setCurrentRole(r)
    localStorage.setItem('role', r)
  }

  return <RoleContext value={{ role, setRole }}>{children}</RoleContext>
}
