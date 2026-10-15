import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Category, Department, Equipment, EquipmentStatus } from '../types'
import EquipmentCard from '../components/EquipmentCard'
import BorrowDialog from '../components/BorrowDialog'

type Filter = 'all' | EquipmentStatus

export default function EquipmentList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  // '' = ทุกหมวดหมู่ / 'none' = เฉพาะที่ไม่ระบุหมวด
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [categories, setCategories] = useState<Category[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  // แผนกอยู่ใน URL (?department=) เพราะหน้าแรกลิงก์มาที่แผนกตรง ๆ
  // '' = ทุกแผนก / 'none' = เฉพาะที่ไม่สังกัดแผนก
  const departmentFilter = searchParams.get('department') ?? ''

  // อุปกรณ์ที่ติ๊กเลือกไว้ — เก็บทั้ง object เพื่อโชว์ชื่อใน dialog ได้โดยไม่ต้องหาใหม่
  const [picked, setPicked] = useState<Equipment[]>([])
  // true = เปิด dialog ขอยืม (ยืมของที่ติ๊กไว้ทั้งหมด)
  const [borrowing, setBorrowing] = useState(false)

  // โหลดใหม่หลังขอยืม เพื่อให้จำนวนคงเหลือตรงกับของจริง
  async function reload() {
    try {
      setItems(await api.listEquipment())
    } catch {
      // เงียบไว้ — ข้อมูลเดิมยังใช้ได้ ไม่ต้องทำให้ทั้งหน้าพัง
    }
  }

  useEffect(() => {
    Promise.all([api.listEquipment(), api.listCategories(), api.listDepartments()])
      .then(([eq, cats, deps]) => {
        setItems(eq)
        setCategories(cats)
        setDepartments(deps)
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
    const matchDepartment =
      departmentFilter === ''
        ? true
        : departmentFilter === 'none'
          ? item.departmentId === null
          : item.departmentId === Number(departmentFilter)
    return matchKeyword && matchStatus && matchCategory && matchDepartment
  })

  function toggleSelect(item: Equipment) {
    setPicked((list) =>
      list.some((p) => p.id === item.id)
        ? list.filter((p) => p.id !== item.id)
        : [...list, item],
    )
  }

  if (loading) return <p aria-busy="true">กำลังโหลดรายการอุปกรณ์…</p>
  if (error) return <p className="error">{error}</p>

  const departmentName =
    departmentFilter === 'none'
      ? 'ไม่สังกัดแผนก'
      : departments.find((d) => d.id === Number(departmentFilter))?.name

  return (
    <>
      <hgroup>
        <h1>{departmentName ?? 'รายการอุปกรณ์'}</h1>
        <p>ติ๊กเลือกอุปกรณ์ที่ต้องการ จะเลือกหลายชิ้นพร้อมกันก็ได้ แล้วกดขอยืม</p>
      </hgroup>

      <div className="toolbar">
        <input
          type="search"
          placeholder="ค้นหาชื่ออุปกรณ์…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        {departments.length > 0 && (
          <select
            value={departmentFilter}
            aria-label="กรองตามแผนก"
            onChange={(e) =>
              setSearchParams(e.target.value ? { department: e.target.value } : {}, { replace: true })
            }
          >
            <option value="">ทุกแผนก</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
            <option value="none">ไม่สังกัดแผนก</option>
          </select>
        )}
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

      {borrowing && (
        <BorrowDialog
          items={picked}
          onRemove={toggleSelect}
          onClose={() => setBorrowing(false)}
          onDone={(failed) => {
            // เหลือเฉพาะชิ้นที่ยังไม่สำเร็จไว้ให้ลองใหม่ ปิด dialog เมื่อผ่านครบ
            setPicked(failed)
            if (failed.length === 0) setBorrowing(false)
            void reload()
          }}
        />
      )}
    </>
  )
}
