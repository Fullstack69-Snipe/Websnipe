import { useState, type ChangeEvent, type FormEvent } from 'react'
import { api } from '../lib/api'
import { shrinkImage } from '../lib/image'
import { useFeedback } from '../lib/useFeedback'
import type { Category, Department, Equipment, EquipmentInput } from '../types'

type Props = {
  initial: Equipment | null // null = เพิ่มใหม่
  categories: Category[]
  // ส่งมา = admin เลือกแผนกได้ / ไม่ส่ง = staff (ย้ายแผนกไม่ได้ ไม่โชว์ช่องนี้)
  departments?: Department[]
  onSubmit: (input: EquipmentInput) => Promise<void>
  onClose: () => void
}

export default function EquipmentForm({ initial, categories, departments, onSubmit, onClose }: Props) {
  const { toast } = useFeedback()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1)
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null)
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null)
  const [departmentId, setDepartmentId] = useState<number | null>(initial?.departmentId ?? null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // ย่อรูปแล้วอัปโหลดขึ้น backend ได้ url กลับมาใส่ imageUrl
  // (เดิมเก็บเป็น data URL ในฐานข้อมูลตรง ๆ — รูปจากมือถือเกินลิมิต 2MB ของ JSON จนบันทึกไม่ได้)
  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // เลือกไฟล์เดิมซ้ำได้ (เช่น หลังลบรูป)
    if (!file) return
    setUploading(true)
    try {
      setImageUrl(await api.uploadImage(await shrinkImage(file)))
    } catch (err) {
      toast(err instanceof Error && err.message ? `อัปโหลดรูปไม่สำเร็จ: ${err.message}` : 'อัปโหลดรูปไม่สำเร็จ', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast('กรุณากรอกชื่ออุปกรณ์', 'error')
    if (quantity < 1) return toast('จำนวนต้องอย่างน้อย 1 ชิ้น', 'error')

    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        quantity,
        imageUrl,
        categoryId,
        ...(departments ? { departmentId } : {}),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog open>
      <article>
        <header>
          <strong>{initial ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์ใหม่'}</strong>
        </header>

        <form id="equipment-form" onSubmit={handleSubmit}>
          <label>
            ชื่ออุปกรณ์
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>

          <label>
            รายละเอียด
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <label>

            หมวดหมู่ (ไม่บังคับ)

            <select

              value={categoryId ?? ''}

              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}

            >

              <option value="">— ไม่ระบุ —</option>

              {categories.map((c) => (

                <option key={c.id} value={c.id}>

                  {c.name}

                </option>

              ))}

            </select>

          </label>


          {departments && (
            <label>
              แผนกที่ดูแล
              <select
                value={departmentId ?? ''}
                onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— ไม่สังกัดแผนก (เจ้าหน้าที่ทุกคนจัดการได้) —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            จำนวนทั้งหมด
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </label>

          <label>
            รูปภาพ
            <input type="file" accept="image/*" onChange={(e) => void handleFile(e)} disabled={uploading} />
            {uploading && <small aria-busy="true">กำลังย่อและอัปโหลดรูป…</small>}
          </label>

          {imageUrl && (
            <div className="form-preview">
              <img src={imageUrl} alt="" />
              <button type="button" className="outline secondary" onClick={() => setImageUrl(null)}>
                ลบรูป
              </button>
            </div>
          )}
        </form>

        <footer>
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>
            ยกเลิก
          </button>
          <button type="submit" form="equipment-form" aria-busy={saving} disabled={uploading}>
            บันทึก
          </button>
        </footer>
      </article>
    </dialog>
  )
}
