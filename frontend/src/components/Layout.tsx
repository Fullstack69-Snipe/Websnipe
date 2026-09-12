import { NavLink, Outlet } from 'react-router'
import { useRole } from '../lib/useRole'
import type { Role } from '../types'

const MENU: { to: string; label: string; allow: Role[] }[] = [
  { to: '/equipment', label: 'รายการอุปกรณ์', allow: ['user', 'staff', 'admin'] },
  { to: '/my-borrows', label: 'การยืมของฉัน', allow: ['user', 'staff', 'admin'] },
  { to: '/manage/equipment', label: 'จัดการอุปกรณ์', allow: ['staff', 'admin'] },
  { to: '/manage/requests', label: 'คำขอยืม', allow: ['staff', 'admin'] },
  { to: '/admin/users', label: 'จัดการผู้ใช้', allow: ['admin'] },
]

export default function Layout() {
  const { role, setRole } = useRole()

  return (
    <>
      <nav className="container">
        <ul>
          <li>
            <strong>ระบบยืม-คืนอุปกรณ์</strong>
          </li>
        </ul>
        <ul>
          {MENU.filter((m) => m.allow.includes(role)).map((m) => (
            <li key={m.to}>
              <NavLink to={m.to}>{m.label}</NavLink>
            </li>
          ))}
          <li>
            {/* ชั่วคราว — ลบทิ้งตอนทำ login จริง */}
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              aria-label="สลับ role สำหรับทดสอบ"
            >
              <option value="user">ผู้ยืม</option>
              <option value="staff">เจ้าหน้าที่</option>
              <option value="admin">ผู้ดูแลระบบ</option>
            </select>
          </li>
        </ul>
      </nav>

      <main className="container">
        <Outlet />
      </main>
    </>
  )
}