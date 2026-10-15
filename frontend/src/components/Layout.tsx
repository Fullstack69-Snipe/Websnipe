import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { needsPickup } from '../lib/borrow'
import { useAuth } from '../lib/useAuth'
import { ROLE_LABEL } from '../lib/labels'
import type { Role } from '../types'

const MENU: { to: string; label: string; allow: Role[] }[] = [
  { to: '/', label: 'หน้าแรก', allow: ['user', 'staff', 'admin'] },
  { to: '/equipment', label: 'รายการอุปกรณ์', allow: ['user', 'staff', 'admin'] },
  { to: '/my-borrows', label: 'การยืมของฉัน', allow: ['user', 'staff', 'admin'] },
  { to: '/manage/equipment', label: 'จัดการอุปกรณ์', allow: ['staff', 'admin'] },
  { to: '/manage/requests', label: 'คำขอยืม', allow: ['staff', 'admin'] },
  { to: '/manage/categories', label: 'หมวดหมู่', allow: ['staff', 'admin'] },
  { to: '/admin/users', label: 'จัดการผู้ใช้', allow: ['admin'] },
  { to: '/admin/departments', label: 'แผนก', allow: ['admin'] },
]

export default function Layout() {
  const { user, role, signOut } = useAuth()
  const { pathname } = useLocation()
  // ตัวเลขข้างเมนู: ของที่รอไปรับ (ทุกคน) / คำขอที่รออนุมัติ (staff เห็นเฉพาะแผนกตัวเอง)
  const [counts, setCounts] = useState<Record<string, number>>({})

  // shortcut: นับจากรายการทั้งหมดทุกครั้งที่เปลี่ยนหน้า — ถ้ารายการเยอะจนช้าค่อยทำ endpoint นับให้
  useEffect(() => {
    if (!role) return
    const isStaff = role === 'staff' || role === 'admin'
    Promise.all([api.listMyBorrows(), isStaff ? api.listBorrows() : Promise.resolve([])])
      .then(([mine, all]) =>
        setCounts({
          '/my-borrows': mine.filter(needsPickup).length,
          '/manage/requests': all.filter((b) => b.status === 'pending').length,
        }),
      )
      .catch(() => {})
  }, [role, pathname])

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
              {/* end: ไม่งั้น "หน้าแรก" (/) จะขึ้นว่าเลือกอยู่ทุกหน้า */}
              <NavLink to={m.to} end={m.to === '/'}>
                {m.label}
                {counts[m.to] ? (
                  <span className="nav-badge" aria-label={`${counts[m.to]} รายการรอดำเนินการ`}>
                    {counts[m.to]}
                  </span>
                ) : null}
              </NavLink>
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
