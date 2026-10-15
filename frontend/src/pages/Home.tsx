import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Department, Equipment } from '../types'

// หน้าแรกหลัง login — เลือกแผนกก่อน แล้วค่อยไปดูของในแผนกนั้น
export default function Home() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [items, setItems] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.listDepartments(), api.listEquipment()])
      .then(([deps, eq]) => {
        setDepartments(deps)
        setItems(eq)
      })
      .catch(() => setError('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p aria-busy="true">กำลังโหลด…</p>
  if (error) return <p className="error">{error}</p>

  const unassigned = items.filter((e) => e.departmentId === null)
  const cards = [
    { key: 'all', to: '/equipment', name: 'อุปกรณ์ทั้งหมด', items },
    ...departments.map((d) => ({
      key: String(d.id),
      to: `/equipment?department=${d.id}`,
      name: d.name,
      items: items.filter((e) => e.departmentId === d.id),
    })),
    // ของที่ยังไม่ได้จัดเข้าแผนก ต้องมีทางเข้าถึงด้วย ไม่งั้นจะหาไม่เจอจากหน้านี้
    ...(departments.length > 0 && unassigned.length > 0
      ? [{ key: 'none', to: '/equipment?department=none', name: 'ไม่สังกัดแผนก', items: unassigned }]
      : []),
  ]

  return (
    <>
      <hgroup>
        <h1>เลือกแผนก</h1>
        <p>ดูอุปกรณ์ที่ยืมได้ของแต่ละแผนก หรือสแกน QR บนตัวอุปกรณ์เพื่อเปิดหน้าของชิ้นนั้นได้เลย</p>
      </hgroup>

      <div className="department-grid">
        {cards.map((c) => {
          const free = c.items.filter((e) => e.available > 0).length
          return (
            <Link key={c.key} to={c.to} className="department-card">
              <strong>{c.name}</strong>
              <span>
                อุปกรณ์ {c.items.length} รายการ
                <small className={free === 0 ? 'stock--empty' : undefined}>
                  ว่างตอนนี้ {free} รายการ
                </small>
              </span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
