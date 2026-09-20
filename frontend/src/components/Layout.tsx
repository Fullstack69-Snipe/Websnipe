import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { ROLE_LABEL } from '../lib/labels'
import type { Role } from '../types'

const MENU: { to: string; label: string; allow: Role[] }[] = [
  { to: '/equipment', label: 'รายการอุปกรณ์', allow: ['user', 'staff', 'admin'] },
  { to: '/my-borrows', label: 'การยืมของฉัน', allow: ['user', 'staff', 'admin'] },
  { to: '/manage/equipment', label: 'จัดการอุปกรณ์', allow: ['staff', 'admin'] },
  { to: '/manage/requests', label: 'คำขอยืม', allow: ['staff', 'admin'] },
  { to: '/manage/categories', label: 'หมวดหมู่', allow: ['staff', 'admin'] },
  { to: '/admin/users', label: 'จัดการผู้ใช้', allow: ['admin'] },
]

export default function Layout() {
  const { user, role, signOut } = useAuth()

  return (
    <>
      <nav className="container">
        <ul>
          <li>
            <strong>ระบบยืม-คืนอุปกรณ์</strong>
          </li>
        </ul>
        <ul>
          {MENU.filter((m) => role && m.allow.includes(role)).map((m) => (
            <li key={m.to}>
              <NavLink to={m.to}>{m.label}</NavLink>
            </li>
          ))}

          {/* เดิมตรงนี้เป็น select สลับ role สำหรับทดสอบ — ตอนนี้ role มาจากบัญชีที่ login */}
          <li className="user-menu">
            {user?.avatarUrl && (
              <img className="avatar" src={user.avatarUrl} alt="" width={28} height={28} />
            )}
            <span>
              {user?.fullName}
              {role && <small> ({ROLE_LABEL[role]})</small>}
            </span>
          </li>
          <li>
            <button type="button" className="outline secondary" onClick={() => void signOut()}>
              ออกจากระบบ
            </button>
          </li>
        </ul>
      </nav>

      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
