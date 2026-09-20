import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Category, Equipment, EquipmentInput } from '../types'
import EquipmentForm from '../components/EquipmentForm'
import EquipmentHistory from '../components/EquipmentHistory'

// null = ปิดฟอร์ม / 'new' = เพิ่มใหม่ / Equipment = แก้ไขชิ้นนั้น
type Editing = null | 'new' | Equipment

export default function ManageEquipment() {
  const [items, setItems] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  // อุปกรณ์ที่กำลังเปิดดูประวัติอยู่
  const [historyOf, setHistoryOf] = useState<Equipment | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  async function load() {
    try {
      const [eq, cats] = await Promise.all([api.listEquipment(), api.listCategories()])
      setItems(eq)
      setCategories(cats)
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
      alert(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    }
  }

  async function handleDelete(item: Equipment) {
    if (!confirm(`ลบ "${item.name}" ออกจากระบบ?`)) return
    try {
      await api.deleteEquipment(item.id)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
    }
  }

  if (loading) return <p aria-busy="true">กำลังโหลด…</p>
  if (error) return <p className="error">{error}</p>

  return (
    <>
      <hgroup>
        <h1>จัดการอุปกรณ์</h1>
        <p>เพิ่ม แก้ไข หรือลบอุปกรณ์ที่ให้ยืม</p>
      </hgroup>

      <div className="toolbar">
        <p className="muted">ทั้งหมด {items.length} รายการ</p>
        <button type="button" onClick={() => setEditing('new')}>
          + เพิ่มอุปกรณ์
        </button>
      </div>

      {items.length === 0 ? (
        <article className="empty">
          <p>ยังไม่มีอุปกรณ์ในระบบ กดปุ่ม "เพิ่มอุปกรณ์" เพื่อเริ่ม</p>
        </article>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รูป</th>
                <th>ชื่อ</th>
                <th>หมวดหมู่</th>
                <th>รายละเอียด</th>
                <th>จำนวน</th>
                <th>เหลือ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const borrowed = item.quantity - item.available
                return (
                  <tr key={item.id}>
                    <td>
                      {item.imageUrl ? (
                        <img className="thumb" src={item.imageUrl} alt="" />
                      ) : (
                        <div className="thumb thumb--empty">ไม่มีรูป</div>
                      )}
                    </td>
                    <td><strong>{item.name}</strong></td>
                    <td className="muted">
                      {item.categoryName ?? '—'}
                    </td>
                    <td className="muted">{item.description}</td>
                    <td>{item.quantity}</td>
                    <td className={item.available === 0 ? 'overdue' : undefined}>
                      {item.available}
                    </td>
                    <td>
                      <div className="actions">
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
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {historyOf && (
        <EquipmentHistory item={historyOf} onClose={() => setHistoryOf(null)} />
      )}

      {editing && (
        <EquipmentForm
          categories={categories}
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
