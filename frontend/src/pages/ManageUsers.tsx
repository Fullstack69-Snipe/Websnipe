import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/useAuth'
import { useFeedback } from '../lib/useFeedback'
import { ROLE_LABEL } from '../lib/labels'
import { usePage } from '../lib/usePage'
import Pagination from '../components/Pagination'
import type { Role, User } from '../types'

const ROLES: Role[] = ['user', 'staff', 'admin']

export default function ManageUsers() {
  const { user: me } = useAuth()
  const { toast, confirm } = useFeedback()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

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
    const ok = await confirm({
      title: 'เปลี่ยนสิทธิ์ผู้ใช้',
      message: `เปลี่ยนสิทธิ์ของ ${u.fullName} เป็น "${ROLE_LABEL[role]}"?`,
      confirmLabel: 'เปลี่ยนสิทธิ์',
      danger: role === 'admin',
    })
    if (!ok) return

    setSaving(u.id)
    setError('')
    try {
      await api.updateUserRole(u.id, role)
      toast(`เปลี่ยนสิทธิ์ ${u.fullName} เป็น "${ROLE_LABEL[role]}" แล้ว`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เปลี่ยนสิทธิ์ไม่สำเร็จ')
    } finally {
      setSaving(null)
    }
  }

  const needle = q.trim().toLowerCase()
  const filtered = users.filter(
    (u) => u.fullName.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle),
  )
  const pg = usePage(filtered, needle)

  if (loading) return <p aria-busy="true">กำลังโหลด...</p>

  return (
    <section>
      <hgroup>
        <h1>จัดการผู้ใช้</h1>
        <p>กำหนดสิทธิ์ให้ผู้ที่เข้าสู่ระบบแล้ว — ผู้ใช้ใหม่จะได้สิทธิ์ "ผู้ยืม" เสมอ</p>
      </hgroup>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="toolbar">
        <input
          type="search"
          placeholder="ค้นหาชื่อหรืออีเมล"
          aria-label="ค้นหาผู้ใช้"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <p className="muted">{filtered.length} คน</p>
      </div>

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
            {pg.rows.map((u) => {
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
                      className="role-select"
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  ไม่พบผู้ใช้ที่ตรงกับ "{q}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination {...pg} />
    </section>
  )
}
