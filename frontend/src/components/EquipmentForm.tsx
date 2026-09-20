import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { Category, Equipment, EquipmentInput } from '../types'

type Props = {
  initial: Equipment | null // null = เพิ่มใหม่
  categories: Category[]
  onSubmit: (input: EquipmentInput) => Promise<void>
  onClose: () => void
}

export default function EquipmentForm({ initial, categories, onSubmit, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1)
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null)
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null)
  const [saving, setSaving] = useState(false)

  // อ่านไฟล์รูปเป็น data URL — ตอนต่อ backend จริงค่อยเปลี่ยนเป็นอัปโหลดขึ้น Storage
  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return alert('กรุณากรอกชื่ออุปกรณ์')
    if (quantity < 1) return alert('จำนวนต้องอย่างน้อย 1 ชิ้น')

    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        quantity,
        imageUrl,
        categoryId,
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
            <input type="file" accept="image/*" onChange={handleFile} />
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
          <button type="submit" form="equipment-form" aria-busy={saving}>
            บันทึก
          </button>
        </footer>
      </article>
    </dialog>
  )
}
