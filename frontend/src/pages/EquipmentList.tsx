import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { api } from '../lib/api'
import type { Category, Equipment, EquipmentStatus } from '../types'
import EquipmentCard from '../components/EquipmentCard'

type Filter = 'all' | EquipmentStatus

export default function EquipmentList() {
  const [items, setItems] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  // '' = ทุกหมวดหมู่ / 'none' = เฉพาะที่ไม่ระบุหมวด
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [categories, setCategories] = useState<Category[]>([])

  // อุปกรณ์ที่กำลังจะยืม (null = ไม่ได้เปิด dialog)
  const [target, setTarget] = useState<Equipment | null>(null)
  const [dueDate, setDueDate] = useState(dayjs().add(7, 'day').format('YYYY-MM-DD'))
  const [submitting, setSubmitting] = useState(false)
  // เหตุผลที่ขอยืม — ไม่บังคับ แต่ช่วยให้เจ้าหน้าที่ตัดสินใจง่ายขึ้น
  const [purpose, setPurpose] = useState('')

  useEffect(() => {
    Promise.all([api.listEquipment(), api.listCategories()])
      .then(([eq, cats]) => {
        setItems(eq)
        setCategories(cats)
      })
      .catch(() => setError('โหลดรายการอุปกรณ์ไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [])

  const visible = items.filter((item) => {
    const matchKeyword = item.name.toLowerCase().includes(keyword.trim().toLowerCase())
    const status = item.available > 0 ? 'available' : 'borrowed'
    const matchStatus = filter === 'all' || status === filter
    const matchCategory =
      categoryFilter === ''
        ? true
        : categoryFilter === 'none'
          ? item.categoryId === null
          : item.categoryId === Number(categoryFilter)
    return matchKeyword && matchStatus && matchCategory
  })

  async function handleBorrow() {
    if (!target) return
    setSubmitting(true)
    try {
      await api.requestBorrow(target.id, dueDate, purpose.trim() || undefined)
      setTarget(null)
      setPurpose('')
      alert('ส่งคำขอยืมเรียบร้อย รอเจ้าหน้าที่อนุมัติ')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p aria-busy="true">กำลังโหลดรายการอุปกรณ์…</p>
  if (error) return <p className="error">{error}</p>

  return (
    <>
      <hgroup>
        <h1>รายการอุปกรณ์</h1>
        <p>เลือกอุปกรณ์ที่ต้องการยืม แล้วกดปุ่มขอยืม</p>
      </hgroup>

      <div className="toolbar">
        <input
          type="search"
          placeholder="ค้นหาชื่ออุปกรณ์…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select
          value={categoryFilter}
          aria-label="กรองตามหมวดหมู่"
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">ทุกหมวดหมู่</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">ไม่ระบุหมวดหมู่</option>
        </select>
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">ทั้งหมด</option>
          <option value="available">ว่าง</option>
          <option value="borrowed">หมด</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <article className="empty">
          <p>ไม่พบอุปกรณ์ที่ตรงกับเงื่อนไข</p>
        </article>
      ) : (
        <div className="equipment-grid">
          {visible.map((item) => (
          <EquipmentCard key={item.id} item={item} onBorrow={setTarget} />
          ))}
        </div>
      )}

      <dialog open={target !== null}>
        <article>
          <header>
            <strong>ขอยืม: {target?.name}</strong>
          </header>
          <label>
            วันที่ครบกำหนดคืน
            <input
              type="date"
              value={dueDate}
              min={dayjs().format('YYYY-MM-DD')}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label>
            เหตุผลที่ขอยืม (ไม่บังคับ)
            <textarea
              rows={2}
              value={purpose}
              placeholder="เช่น ใช้ถ่ายงานสัมมนา"
              onChange={(e) => setPurpose(e.target.value)}
            />
          </label>
          <footer>
            <button type="button" className="secondary" onClick={() => setTarget(null)}>
              ยกเลิก
            </button>
            <button type="button" onClick={handleBorrow} aria-busy={submitting}>
              ยืนยันขอยืม
            </button>
          </footer>
        </article>
      </dialog>
    </>
  )
}