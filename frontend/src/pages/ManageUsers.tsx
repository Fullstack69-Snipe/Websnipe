import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/useAuth'
import { ROLE_LABEL } from '../lib/labels'
import type { Role, User } from '../types'

const ROLES: Role[] = ['user', 'staff', 'admin']

export default function ManageUsers() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = () =>
    api
      .listUsers()
      .then(setUsers)
      .catch(() => setError('โหลดรายชื่อผู้ใช้ไม่สำเร็จ'))
      .finally(() => setLoading(false))

  useEffect(() => {
    void load()
  }, [])

  async function changeRole(u: User, role: Role) {
    if (role === u.role) return
    if (!confirm(`เปลี่ยนสิทธิ์ของ ${u.fullName} เป็น "${ROLE_LABEL[role]}"?`)) return

    setSaving(u.id)
    setError('')
    try {
      await api.updateUserRole(u.id, role)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เปลี่ยนสิทธิ์ไม่สำเร็จ')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <p aria-busy="true">กำลังโหลด...</p>

  return (
    <section>
      <hgroup>
        <h2>จัดการผู้ใช้</h2>
        <p>กำหนดสิทธิ์ให้ผู้ที่เข้าสู่ระบบแล้ว — ผู้ใช้ใหม่จะได้สิทธิ์ "ผู้ยืม" เสมอ</p>
      </hgroup>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>อีเมล</th>
              <th>สิทธิ์</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isMe = u.id === me?.id
              return (
                <tr key={u.id}>
                  <td>
                    {u.fullName}
                    {isMe && <small> (คุณ)</small>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      aria-label={`สิทธิ์ของ ${u.fullName}`}
                      // กันเผลอถอดสิทธิ์ตัวเองจนไม่มี admin เหลือ
                      disabled={saving === u.id || isMe}
                      onChange={(e) => void changeRole(u, e.target.value as Role)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
