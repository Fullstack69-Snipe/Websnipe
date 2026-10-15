import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, QrCode, SearchX } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/useAuth'
import { useFeedback } from '../lib/useFeedback'
import { usePage } from '../lib/usePage'
import type { Category, Department, Equipment, EquipmentInput } from '../types'
import EquipmentForm from '../components/EquipmentForm'
import EquipmentHistory from '../components/EquipmentHistory'
import Pagination from '../components/Pagination'

// null = ปิดฟอร์ม / 'new' = เพิ่มใหม่ / Equipment = แก้ไขชิ้นนั้น
type Editing = null | 'new' | Equipment

export default function ManageEquipment() {
  const { toast, confirm } = useFeedback()
  const { user, role } = useAuth()
  const [items, setItems] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  // อุปกรณ์ที่กำลังเปิดดูประวัติอยู่
  const [historyOf, setHistoryOf] = useState<Equipment | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [q, setQ] = useState('')

  async function load() {
    try {
      const [eq, cats, deps] = await Promise.all([
        api.listEquipment(),
        api.listCategories(),
        api.listDepartments(),
      ])
      setItems(eq)
      setCategories(cats)
      setDepartments(deps)
    } catch {
      setError('โหลดรายการอุปกรณ์ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(input: EquipmentInput) {
    try {
      if (editing === 'new') {
        await api.createEquipment(input)
      } else if (editing) {
        await api.updateEquipment(editing.id, input)
      }
      setEditing(null)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ', 'error')
    }
  }

  async function handleDelete(item: Equipment) {
    const ok = await confirm({
      title: 'ลบอุปกรณ์',
      message: `ลบ "${item.name}" ออกจากระบบ? การลบนี้ย้อนกลับไม่ได้`,
      confirmLabel: 'ลบ',
      danger: true,
    })
    if (!ok) return
    try {
      await api.deleteEquipment(item.id)
      toast(`ลบ "${item.name}" แล้ว`)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'ลบไม่สำเร็จ', 'error')
    }
  }

  // เหมือนที่ backend ตรวจ — ซ่อนปุ่มไว้ก่อนจะได้ไม่ต้องกดแล้วเจอ 403
  const canManage = (item: Equipment) =>
    role === 'admin' ||
    item.departmentId === null ||
    (user?.departmentIds ?? []).includes(item.departmentId)

  const needle = q.trim().toLowerCase()
  const filtered = items.filter((e) =>
    [e.name, e.categoryName, e.departmentName].some((v) => v?.toLowerCase().includes(needle)),
  )
  const pg = usePage(filtered, needle)

  if (loading) return <p aria-busy="true">กำลังโหลด…</p>
  if (error) return <p className="error">{error}</p>

  return (
    <>
      <hgroup>
        <h1>จัดการอุปกรณ์</h1>
        <p>เพิ่ม แก้ไข หรือลบอุปกรณ์ที่ให้ยืม</p>
      </hgroup>

      <div className="toolbar">
        <input
          type="search"
          placeholder="ค้นหาชื่อ หมวดหมู่ หรือแผนก"
          aria-label="ค้นหาอุปกรณ์"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <p className="muted">{needle ? `พบ ${filtered.length} จาก ${items.length}` : `ทั้งหมด ${items.length}`} รายการ</p>
        <Link to="/manage/qr" role="button" className="outline">
          <QrCode aria-hidden="true" />
          พิมพ์ QR
        </Link>
        <button type="button" onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          เพิ่มอุปกรณ์
        </button>
      </div>

      {items.length === 0 ? (
        <article className="empty">
          <p>ยังไม่มีอุปกรณ์ในระบบ กดปุ่ม "เพิ่มอุปกรณ์" เพื่อเริ่ม</p>
        </article>
      ) : filtered.length === 0 ? (
        <article className="empty">
          <SearchX aria-hidden="true" />
          <p>ไม่พบอุปกรณ์ที่ตรงกับ "{q}"</p>
        </article>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="col-thumb">รูป</th>
                <th className="col-name">ชื่อ</th>
                <th className="col-nowrap">หมวดหมู่</th>
                <th className="col-detail">รายละเอียด</th>
                <th className="col-num">จำนวน</th>
                <th className="col-num">เหลือ</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {pg.rows.map((item) => {
                const borrowed = item.quantity - item.available
                return (
                  <tr key={item.id}>
                    <td className="col-thumb">
                      {item.imageUrl ? (
                        <img className="thumb" src={item.imageUrl} alt="" />
                      ) : (
                        <div className="thumb thumb--empty">ไม่มีรูป</div>
                      )}
                    </td>
                    {/* ชื่อพาไปหน้าอุปกรณ์ ซึ่งมี QR ให้พิมพ์ */}
                    <td className="col-name">
                      <strong>
                        <Link to={`/equipment/${encodeURIComponent(item.id)}`} title="ดูหน้าอุปกรณ์ / พิมพ์ QR">
                          {item.name}
                        </Link>
                      </strong>
                      {item.departmentName && (
                        <small className="muted-line">แผนก {item.departmentName}</small>
                      )}
                    </td>
                    <td className="muted col-nowrap">
                      {item.categoryName ?? '—'}
                    </td>
                    <td className="muted col-detail">{item.description}</td>
                    <td className="col-num">{item.quantity}</td>
                    <td className={`col-num ${item.available === 0 ? 'overdue' : ''}`}>
                      {item.available}
                    </td>
                    <td className="col-actions">
                      <div className="actions">
                        {canManage(item) ? (
                          <>
                        <button type="button" className="outline" onClick={() => setEditing(item)}>
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          className="outline"
                          onClick={() => setHistoryOf(item)}
                        >
                          ประวัติ
                        </button>
                        <button
                          type="button"
                          className="outline secondary"
                          onClick={() => handleDelete(item)}
                          disabled={borrowed > 0}
                          title={borrowed > 0 ? `ถูกยืมอยู่ ${borrowed} ชิ้น ลบไม่ได้` : undefined}
                        >
                          ลบ
                        </button>
                          </>
                        ) : (
                          <small className="muted">แผนกอื่นดูแล</small>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination {...pg} />

      {historyOf && (
        <EquipmentHistory item={historyOf} onClose={() => setHistoryOf(null)} />
      )}

      {editing && (
        <EquipmentForm
          categories={categories}
          departments={role === 'admin' ? departments : undefined}
          // key ทำให้ฟอร์ม reset ทุกครั้งที่เปลี่ยนชิ้นที่แก้
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          onSubmit={handleSubmit}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
