import { createContext, useState, type ReactNode } from 'react'
import type { Role } from '../types'

export const RoleContext = createContext<{
  role: Role
  setRole: (r: Role) => void
} | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('user')
  return <RoleContext value={{ role, setRole }}>{children}</RoleContext>
}