import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useFeedback } from '../lib/useFeedback'
import type { Category } from '../types'

// หมวดหมู่อุปกรณ์ — staff/admin จัดการได้
// ลบหมวดหมู่ไม่ทำให้อุปกรณ์หาย แค่กลายเป็น "ไม่ระบุหมวดหมู่"
export default function ManageCategories() {
  const { toast, confirm } = useFeedback()
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // null = ยังไม่ได้แก้อะไร / Category = กำลังแก้ชิ้นนั้น
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const load = () =>
    api
      .listCategories()
      .then(setItems)
      .catch(() => setError('โหลดหมวดหมู่ไม่สำเร็จ'))
      .finally(() => setLoading(false))

  useEffect(() => {
    void load()
  }, [])

  function reset() {
    setEditing(null)
    setName('')
    setDescription('')
  }

  function startEdit(c: Category) {
    setEditing(c)
    setName(c.name)
    setDescription(c.description ?? '')
    setError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setError('')
    try {
      const input = { name: name.trim(), description: description.trim() || null }
      if (editing) await api.updateCategory(editing.id, input)
      else await api.createCategory(input)
      reset()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: Category) {
    const warn =
      c.equipmentCount > 0
        ? `ลบ "${c.name}"? อุปกรณ์ ${c.equipmentCount} ชิ้นจะกลายเป็นไม่ระบุหมวดหมู่ (ไม่ถูกลบ)`
        : `ลบ "${c.name}"?`
    const ok = await confirm({
      title: 'ลบหมวดหมู่',
      message: warn,
      confirmLabel: 'ลบ',
      danger: true,
    })
    if (!ok) return

    setError('')
    try {
      await api.deleteCategory(c.id)
      toast(`ลบหมวดหมู่ "${c.name}" แล้ว`)
      if (editing?.id === c.id) reset()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
    }
  }

  if (loading) return <p aria-busy="true">กำลังโหลด...</p>

  return (
    <section>
      <hgroup>
        <h1>หมวดหมู่อุปกรณ์</h1>
        <p>ใช้จัดกลุ่มอุปกรณ์ให้ผู้ยืมหาของเจอง่ายขึ้น</p>
      </hgroup>

      {error && <p className="error" role="alert">{error}</p>}

      <form onSubmit={handleSubmit} className="category-form">
        <label>
          ชื่อหมวดหมู่
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น กล้องและถ่ายภาพ"
            required
          />
        </label>
        <label>
          คำอธิบาย (ไม่บังคับ)
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="actions">
          <button type="submit" aria-busy={saving}>
            {editing ? 'บันทึกการแก้ไข' : 'เพิ่มหมวดหมู่'}
          </button>
          {editing && (
            <button type="button" className="secondary outline" onClick={reset}>
              ยกเลิก
            </button>
          )}
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>คำอธิบาย</th>
              <th>อุปกรณ์</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4}>ยังไม่มีหมวดหมู่</td>
              </tr>
            )}
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="muted">{c.description}</td>
                <td>{c.equipmentCount}</td>
                <td>
                  <div className="actions">
                    <button type="button" className="outline" onClick={() => startEdit(c)}>
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      className="outline secondary"
                      onClick={() => void handleDelete(c)}
                    >
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
