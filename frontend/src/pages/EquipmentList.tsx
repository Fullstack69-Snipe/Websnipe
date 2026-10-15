import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { api } from '../lib/api'
import { useFeedback } from '../lib/useFeedback'
import type { Category, Equipment, EquipmentStatus } from '../types'
import EquipmentCard from '../components/EquipmentCard'

type Filter = 'all' | EquipmentStatus

export default function EquipmentList() {
  const { toast } = useFeedback()
  const [items, setItems] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  // '' = ทุกหมวดหมู่ / 'none' = เฉพาะที่ไม่ระบุหมวด
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [categories, setCategories] = useState<Category[]>([])

  // อุปกรณ์ที่ติ๊กเลือกไว้ — เก็บทั้ง object เพื่อโชว์ชื่อใน dialog ได้โดยไม่ต้องหาใหม่
  const [picked, setPicked] = useState<Equipment[]>([])
  // true = เปิด dialog ขอยืม (ยืมของที่ติ๊กไว้ทั้งหมด)
  const [borrowing, setBorrowing] = useState(false)
  // ช่วงเวลายืม — เก็บเป็น 'YYYY-MM-DD' ให้ <input type="date"> ใช้ได้ตรง ๆ
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [dueDate, setDueDate] = useState(dayjs().add(7, 'day').format('YYYY-MM-DD'))
  const [submitting, setSubmitting] = useState(false)
  // เหตุผลที่ขอยืม — ไม่บังคับ แต่ช่วยให้เจ้าหน้าที่ตัดสินใจง่ายขึ้น
  const [purpose, setPurpose] = useState('')

  // โหลดใหม่หลังขอยืม เพื่อให้จำนวนคงเหลือตรงกับของจริง
  async function reload() {
    try {
      setItems(await api.listEquipment())
    } catch {
      // เงียบไว้ — ข้อมูลเดิมยังใช้ได้ ไม่ต้องทำให้ทั้งหน้าพัง
    }
  }

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

  function toggleSelect(item: Equipment) {
    setPicked((list) =>
      list.some((p) => p.id === item.id)
        ? list.filter((p) => p.id !== item.id)
        : [...list, item],
    )
  }

  async function handleBorrow() {
    if (picked.length === 0) return
    if (!dayjs(dueDate).isAfter(dayjs(startDate), 'day')) {
      return toast('วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น', 'error')
    }

    // backend ต้องการ ISO พร้อม timezone — ยืมทั้งวันตั้งแต่ 00:00 ถึง 23:59
    const startAt = dayjs(startDate).startOf('day').format()
    const endAt = dayjs(dueDate).endOf('day').format()
    const note = purpose.trim() || undefined

    setSubmitting(true)
    try {
      // backend ยังไม่มี endpoint ยืมหลายชิ้นในครั้งเดียว จึงยิงทีละชิ้น
      // ใช้ allSettled เพราะถ้าชิ้นใดชิ้นหนึ่งพลาด (เช่น มีคนตัดหน้า) ชิ้นที่เหลือควรผ่านไปได้
      const results = await Promise.allSettled(
        picked.map((item) => api.requestBorrow(item.id, startAt, endAt, note)),
      )

      const failed = picked.filter((_, i) => results[i].status === 'rejected')
      const okCount = picked.length - failed.length

      if (okCount > 0) toast(`ส่งคำขอยืม ${okCount} ชิ้นเรียบร้อย รอเจ้าหน้าที่อนุมัติ`)
      if (failed.length > 0) {
        toast(`ขอยืมไม่สำเร็จ ${failed.length} ชิ้น: ${failed.map((f) => f.name).join(', ')}`, 'error')
      }

      // เหลือเฉพาะชิ้นที่ยังไม่สำเร็จไว้ให้ลองใหม่ ปิด dialog เมื่อผ่านครบ
      setPicked(failed)
      if (failed.length === 0) {
        setBorrowing(false)
        setPurpose('')
      }
      await reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error')
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
        <p>ติ๊กเลือกอุปกรณ์ที่ต้องการ จะเลือกหลายชิ้นพร้อมกันก็ได้ แล้วกดขอยืม</p>
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
            <EquipmentCard
              key={item.id}
              item={item}
              onBorrow={() => {
                setPicked([item])
                setBorrowing(true)
              }}
              selected={picked.some((p) => p.id === item.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* แถบลอยด้านล่าง — ขึ้นเมื่อติ๊กของไว้อย่างน้อย 1 ชิ้น */}
      {picked.length > 0 && !borrowing && (
        <div className="pick-bar" role="status">
          <span>
            เลือกไว้ <strong>{picked.length}</strong> ชิ้น
          </span>
          <div className="actions">
            <button type="button" className="outline secondary" onClick={() => setPicked([])}>
              ล้างที่เลือก
            </button>
            <button type="button" onClick={() => setBorrowing(true)}>
              ขอยืม {picked.length} ชิ้น
            </button>
          </div>
        </div>
      )}

      <dialog open={borrowing}>
        <article>
          <header>
            <strong>
              ขอยืม {picked.length > 1 ? `${picked.length} ชิ้น` : picked[0]?.name}
            </strong>
          </header>

          {picked.length > 1 && (
            <ul className="pick-list">
              {picked.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <button
                    type="button"
                    className="outline secondary"
                    aria-label={`เอา ${p.name} ออก`}
                    onClick={() => toggleSelect(p)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="date-range">
            <label>
              วันที่เริ่มยืม
              <input
                type="date"
                value={startDate}
                min={dayjs().format('YYYY-MM-DD')}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  // ถ้าวันเริ่มเลยวันคืนไปแล้ว ดันวันคืนตามให้อัตโนมัติ
                  if (!dayjs(dueDate).isAfter(dayjs(e.target.value), 'day')) {
                    setDueDate(dayjs(e.target.value).add(7, 'day').format('YYYY-MM-DD'))
                  }
                }}
              />
            </label>
            <label>
              วันที่ครบกำหนดคืน
              <input
                type="date"
                value={dueDate}
                min={dayjs(startDate).add(1, 'day').format('YYYY-MM-DD')}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>

          <p className="range-summary">
            ยืมทั้งหมด <strong>{dayjs(dueDate).diff(dayjs(startDate), 'day')}</strong> วัน
          </p>

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
            <button type="button" className="secondary" onClick={() => setBorrowing(false)}>
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleBorrow}
              aria-busy={submitting}
              disabled={picked.length === 0}
            >
              ยืนยันขอยืม{picked.length > 1 ? ` ${picked.length} ชิ้น` : ''}
            </button>
          </footer>
        </article>
      </dialog>
    </>
  )
}