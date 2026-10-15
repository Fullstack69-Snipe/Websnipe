import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Boxes,
  Building2,
  ChartColumn,
  ClipboardList,
  House,
  Inbox,
  LogOut,
  Moon,
  Package,
  Sun,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../lib/api'
import { needsPickup } from '../lib/borrow'
import { useAuth } from '../lib/useAuth'
import { currentTheme, setTheme, type Theme } from '../lib/theme'
import { ROLE_LABEL } from '../lib/labels'
import type { Role } from '../types'
import BrandMark from './BrandMark'
import NotificationBell from './NotificationBell'

const MENU: { to: string; label: string; icon: LucideIcon; allow: Role[] }[] = [
  { to: '/', label: 'หน้าแรก', icon: House, allow: ['user', 'staff', 'admin'] },
  { to: '/equipment', label: 'รายการอุปกรณ์', icon: Package, allow: ['user', 'staff', 'admin'] },
  { to: '/my-borrows', label: 'การยืมของฉัน', icon: ClipboardList, allow: ['user', 'staff', 'admin'] },
  { to: '/manage/equipment', label: 'จัดการอุปกรณ์', icon: Boxes, allow: ['staff', 'admin'] },
  { to: '/manage/requests', label: 'คำขอยืม', icon: Inbox, allow: ['staff', 'admin'] },
  { to: '/manage/categories', label: 'หมวดหมู่', icon: Tags, allow: ['staff', 'admin'] },
  { to: '/manage/reports', label: 'รายงาน', icon: ChartColumn, allow: ['staff', 'admin'] },
  { to: '/admin/users', label: 'จัดการผู้ใช้', icon: Users, allow: ['admin'] },
  { to: '/admin/departments', label: 'แผนก', icon: Building2, allow: ['admin'] },
]

export default function Layout() {
  const { user, role, signOut } = useAuth()
  const { pathname } = useLocation()
  // ตัวเลขข้างเมนู: ของที่รอไปรับ (ทุกคน) / คำขอที่รออนุมัติ (staff เห็นเฉพาะแผนกตัวเอง)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [theme, setThemeState] = useState<Theme>(currentTheme)

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

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
      {/* หัวเว็บ 2 ชั้น: โลโก้ + ผู้ใช้ข้างบน เมนูข้างล่าง — staff/admin มีเมนูเยอะ อยู่แถวเดียวกับโลโก้จะแน่นเกิน
          จอมือถือ แถบเมนูย้ายไปติดล่างจอแบบแอป (ดู App.css) */}
      <header className="app-header">
        <div className="container app-header__top">
          <Link to="/" className="brand-link" aria-label="BORROW APP หน้าแรก">
            <BrandMark />
          </Link>

          <div className="user-menu">
            {user?.avatarUrl ? (
              <img className="avatar" src={user.avatarUrl} alt="" width={32} height={32} />
            ) : (
              <span className="avatar avatar--initial" aria-hidden="true">
                {user?.fullName.trim().charAt(0)}
              </span>
            )}
            <span className="user-menu__name">
              {user?.fullName}
              {role && <small>{ROLE_LABEL[role]}</small>}
            </span>
            <NotificationBell refreshKey={pathname} />
            <button
              type="button"
              className="outline secondary theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
              title={theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}
            >
              {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="outline secondary user-menu__logout"
              onClick={() => void signOut()}
            >
              <LogOut aria-hidden="true" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>

        <nav className="app-nav" aria-label="เมนูหลัก">
          <ul className="container">
            {MENU.filter((m) => role && m.allow.includes(role)).map(({ to, label, icon: Icon }) => (
              <li key={to}>
                {/* end: ไม่งั้น "หน้าแรก" (/) จะขึ้นว่าเลือกอยู่ทุกหน้า */}
                <NavLink to={to} end={to === '/'}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                  {counts[to] ? (
                    <span className="nav-badge" aria-label={`${counts[to]} รายการรอดำเนินการ`}>
                      {counts[to]}
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
