import { useContext } from 'react'
import { RoleContext } from './role'

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole ต้องอยู่ใน <RoleProvider>')
  return ctx
}