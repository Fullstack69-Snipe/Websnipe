import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  Building2,
  CircleCheck,
  Clock,
  LayoutGrid,
  Package,
  PackageCheck,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../lib/api'
import { isHolding, isPickedUp, needsPickup } from '../lib/borrow'
import { useAuth } from '../lib/useAuth'
import type { Borrow, Department, Equipment } from '../types'

// หน้าแรกหลัง login — ทักทาย + สรุปการยืมของตัวเอง + เลือกแผนกเพื่อไปดูของ
export default function Home() {
  const { user } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [items, setItems] = useState<Equipment[]>([])
  const [mine, setMine] = useState<Borrow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.listDepartments(), api.listEquipment(), api.listMyBorrows()])
      .then(([deps, eq, my]) => {
        setDepartments(deps)
        setItems(eq)
        setMine(my)
      })
      .catch(() => setError('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p aria-busy="true">กำลังโหลด…</p>
  if (error) return <p className="error">{error}</p>

  const stats: { label: string; value: number; icon: LucideIcon; tone: string }[] = [
    { label: 'กำลังยืมอยู่', value: mine.filter((b) => isHolding(b) && isPickedUp(b)).length, icon: Package, tone: '' },
    { label: 'รอไปรับของ', value: mine.filter(needsPickup).length, icon: PackageCheck, tone: 'stat--warn' },
    { label: 'รออนุมัติ', value: mine.filter((b) => b.status === 'pending').length, icon: Clock, tone: 'stat--pending' },
  ]

  const unassigned = items.filter((e) => e.departmentId === null)
  const cards = [
    { key: 'all', to: '/equipment', name: 'อุปกรณ์ทั้งหมด', icon: LayoutGrid, items },
    ...departments.map((d) => ({
      key: String(d.id),
      to: `/equipment?department=${d.id}`,
      name: d.name,
      icon: Building2,
      items: items.filter((e) => e.departmentId === d.id),
    })),
    // ของที่ยังไม่ได้จัดเข้าแผนก ต้องมีทางเข้าถึงด้วย ไม่งั้นจะหาไม่เจอจากหน้านี้
    ...(departments.length > 0 && unassigned.length > 0
      ? [{ key: 'none', to: '/equipment?department=none', name: 'ไม่สังกัดแผนก', icon: Package, items: unassigned }]
      : []),
  ]

  return (
    <>
      <section className="home-welcome">
        <hgroup>
          <h1>สวัสดี คุณ{user?.fullName.split(' ')[0]}</h1>
          <p>{dayjs().format('dddd D MMMM BBBB')}</p>
        </hgroup>

        <div className="stats">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <Link key={label} to="/my-borrows" className={`stat home-stat ${tone}`}>
              <span className="home-stat__icon" aria-hidden="true">
                <Icon />
              </span>
              <strong>{value}</strong>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <hgroup className="section-title">
        <h2>เลือกแผนก</h2>
        <p>ดูอุปกรณ์ที่ยืมได้ของแต่ละแผนก หรือสแกน QR บนตัวอุปกรณ์เพื่อเปิดหน้าของชิ้นนั้นได้เลย</p>
      </hgroup>

      <div className="department-grid">
        {cards.map(({ key, to, name, icon: Icon, items: list }) => {
          const free = list.filter((e) => e.available > 0).length
          const photos = list.filter((e) => e.imageUrl).slice(0, 3)
          return (
            <Link key={key} to={to} className="department-card">
              <span className="department-card__photos" aria-hidden="true">
                {photos.length > 0 ? (
                  photos.map((e) => <img key={e.id} src={e.imageUrl!} alt="" loading="lazy" />)
                ) : (
                  <span className="department-card__empty">
                    <Icon />
                  </span>
                )}
              </span>
              <span className="department-card__body">
                <strong>
                  <Icon aria-hidden="true" />
                  {name}
                </strong>
                <span className="department-card__meta">
                  <span>
                    <Package aria-hidden="true" />
                    อุปกรณ์ {list.length} รายการ
                  </span>
                  <span className={free === 0 ? 'stock--empty' : undefined}>
                    <CircleCheck aria-hidden="true" />
                    ว่างตอนนี้ {free} รายการ
                  </span>
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
