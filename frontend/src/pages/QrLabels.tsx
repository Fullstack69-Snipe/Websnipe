import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Printer, QrCode } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/useAuth'
import type { Department, Equipment } from '../types'

// แผ่นสติกเกอร์ QR ทั้งแผนก — พิมพ์ทีเดียวแล้วตัดไปแปะตัวของ
// ?department=<id> | none (ไม่สังกัดแผนก) | ว่าง = ทั้งหมด
export default function QrLabels() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState<Equipment[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // staff เข้ามาเฉย ๆ -> เปิดแผนกแรกที่ตัวเองดูแลให้เลย
  const dept = params.get('department') ?? String(user?.departmentIds?.[0] ?? '')

  useEffect(() => {
    Promise.all([api.listEquipment(), api.listDepartments()])
      .then(([eq, deps]) => {
        setItems(eq)
        setDepartments(deps)
      })
      .catch(() => setError('โหลดรายการอุปกรณ์ไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p aria-busy="true">กำลังโหลด…</p>
  if (error) return <p className="error">{error}</p>

  const shown = items.filter((e) =>
    dept === '' ? true : dept === 'none' ? e.departmentId === null : String(e.departmentId) === dept,
  )
  const title =
    dept === ''
      ? 'ทุกแผนก'
      : dept === 'none'
        ? 'ไม่สังกัดแผนก'
        : (departments.find((d) => String(d.id) === dept)?.name ?? 'แผนก')

  return (
    <>
      <hgroup className="no-print">
        <h1>พิมพ์ QR ติดอุปกรณ์</h1>
        <p>เลือกแผนกแล้วกดพิมพ์ — ได้สติกเกอร์ QR ของทุกชิ้นในแผ่นเดียว สแกนแล้วเปิดหน้าอุปกรณ์ชิ้นนั้นทันที</p>
      </hgroup>

      <div className="toolbar no-print">
        <select
          aria-label="เลือกแผนก"
          value={dept}
          onChange={(e) => setParams({ department: e.target.value }, { replace: true })}
        >
          <option value="">ทุกแผนก</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
          <option value="none">ไม่สังกัดแผนก</option>
        </select>
        <p className="muted">{shown.length} ชิ้น</p>
        <button type="button" disabled={shown.length === 0} onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          พิมพ์
        </button>
      </div>

      {shown.length === 0 ? (
        <article className="empty">
          <QrCode aria-hidden="true" />
          <p>ไม่มีอุปกรณ์ใน "{title}"</p>
        </article>
      ) : (
        <ul className="qr-sheet" aria-label={`QR ของ ${title}`}>
          {shown.map((e) => (
            <li key={e.id} className="qr-label">
              <img src={api.qrImageUrl(e.id)} alt="" width={120} height={120} loading="lazy" />
              <strong>{e.name}</strong>
              <small>
                {e.id}
                {e.departmentName && ` · ${e.departmentName}`}
              </small>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
