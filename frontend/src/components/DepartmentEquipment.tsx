import { useState } from 'react'
import { Package, X } from 'lucide-react'
import type { Department, Equipment } from '../types'

type Props = {
  department: Department
  equipment: Equipment[] // อุปกรณ์ทั้งหมดในระบบ
  onAssign: (ids: string[]) => Promise<void>
  onUnassign: (item: Equipment) => void
}

const matches = (e: Equipment, query: string) =>
  e.name.toLowerCase().includes(query.trim().toLowerCase())

function Thumb({ item }: { item: Equipment }) {
  return item.imageUrl ? (
    <img className="dept-list__thumb" src={item.imageUrl} alt="" loading="lazy" />
  ) : (
    <span className="dept-list__thumb dept-list__thumb--empty" aria-hidden="true">
      <Package />
    </span>
  )
}

// จัดการอุปกรณ์ของแผนก — ซ้าย: ของที่อยู่ในแผนก / ขวา: ค้นหาแล้วติ๊กเพิ่มทีละหลายชิ้น
// (เดิมเป็น dropdown เลือกทีละชิ้น พอของเยอะหาไม่เจอและต้องกดซ้ำหลายรอบ)
export default function DepartmentEquipment({ department, equipment, onAssign, onUnassign }: Props) {
  const [inQuery, setInQuery] = useState('')
  const [outQuery, setOutQuery] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const inDepartment = equipment.filter((e) => e.departmentId === department.id)
  const shownIn = inDepartment.filter((e) => matches(e, inQuery))
  const shownOut = equipment.filter((e) => e.departmentId !== department.id && matches(e, outQuery))
  const allShownPicked = shownOut.length > 0 && shownOut.every((e) => picked.has(e.id))

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // เลือก/ยกเลิกเฉพาะชิ้นที่ค้นเจออยู่ตอนนี้ — ค้นคำว่า "กล้อง" แล้วกดทีเดียวได้ทั้งกลุ่ม
  function toggleAllShown() {
    setPicked((prev) => {
      const next = new Set(prev)
      for (const e of shownOut) {
        if (allShownPicked) next.delete(e.id)
        else next.add(e.id)
      }
      return next
    })
  }

  async function addPicked() {
    setBusy(true)
    try {
      await onAssign([...picked])
      setPicked(new Set())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dept-equipment">
      <section>
        <header>
          <strong>ในแผนกนี้ ({inDepartment.length})</strong>
        </header>
        {/* type="search" — Pico ใส่ไอคอนแว่นขยายให้เอง */}
        <input
          type="search"
          className="dept-search"
          value={inQuery}
          placeholder="ค้นหาในแผนก…"
          aria-label="ค้นหาอุปกรณ์ในแผนก"
          onChange={(e) => setInQuery(e.target.value)}
        />
        <ul className="dept-list">
          {shownIn.length === 0 && (
            <li className="dept-list__empty">
              {inDepartment.length === 0 ? 'ยังไม่มีอุปกรณ์ในแผนกนี้' : 'ไม่พบอุปกรณ์ที่ค้นหา'}
            </li>
          )}
          {shownIn.map((e) => (
            <li key={e.id}>
              <Thumb item={e} />
              <span className="dept-list__name">{e.name}</span>
              <button
                type="button"
                className="outline secondary dept-list__remove"
                aria-label={`เอา ${e.name} ออกจากแผนก`}
                title="เอาออกจากแผนก"
                onClick={() => onUnassign(e)}
              >
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <header>
          <strong>เพิ่มเข้าแผนก</strong>
          {shownOut.length > 0 && (
            <button type="button" className="dept-link" onClick={toggleAllShown}>
              {allShownPicked ? 'ยกเลิกที่เลือก' : `เลือกทั้งหมดที่แสดง (${shownOut.length})`}
            </button>
          )}
        </header>
        <input
          type="search"
          className="dept-search"
          value={outQuery}
          placeholder="ค้นหาอุปกรณ์ที่จะเพิ่ม…"
          aria-label="ค้นหาอุปกรณ์ที่จะเพิ่ม"
          onChange={(e) => setOutQuery(e.target.value)}
        />
        <ul className="dept-list">
          {shownOut.length === 0 && <li className="dept-list__empty">ไม่มีอุปกรณ์ให้เพิ่ม</li>}
          {shownOut.map((e) => (
            <li key={e.id}>
              <label className="dept-list__pick">
                <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} />
                <Thumb item={e} />
                <span className="dept-list__name">
                  {e.name}
                  <small>{e.departmentName ? `อยู่ที่ ${e.departmentName}` : 'ไม่สังกัดแผนก'}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="dept-add"
          disabled={picked.size === 0}
          aria-busy={busy}
          onClick={() => void addPicked()}
        >
          {picked.size > 0 ? `เพิ่ม ${picked.size} ชิ้นเข้าแผนก` : 'ติ๊กเลือกอุปกรณ์ที่จะเพิ่ม'}
        </button>
      </section>
    </div>
  )
}
