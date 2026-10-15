import { Link } from 'react-router-dom'
import type { Equipment } from '../types'
import StatusBadge from './StatusBadge'

type Props = {
  item: Equipment
  onBorrow: (item: Equipment) => void
  // เลือกหลายชิ้นพร้อมกัน — ไม่ส่ง 2 ตัวนี้มาก็ยังใช้การ์ดแบบเดิมได้
  selected?: boolean
  onToggleSelect?: (item: Equipment) => void
}

export default function EquipmentCard({ item, onBorrow, selected, onToggleSelect }: Props) {
  const isAvailable = item.available > 0
  // ของหมดตอนนี้ก็ยังจองช่วงอื่นได้ ระบบตรวจตามช่วงเวลาที่ขอ
  const selectable = item.quantity > 0 && onToggleSelect !== undefined

  return (
    <article className={`equipment-card ${selected ? 'equipment-card--selected' : ''}`}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} loading="lazy" />
      ) : (
        <div className="equipment-card__placeholder">ไม่มีรูป</div>
      )}

      <header>
        <strong>
          <Link to={`/equipment/${encodeURIComponent(item.id)}`}>{item.name}</Link>
        </strong>
        <StatusBadge status={isAvailable ? 'available' : 'borrowed'} />
      </header>

      {item.categoryName && <p className="chip">{item.categoryName}</p>}

      <p>{item.description}</p>

      <footer>
        <span className={`stock ${isAvailable ? '' : 'stock--empty'}`}>
          เหลือ <strong>{item.available}</strong> / {item.quantity} ชิ้น
        </span>

        {selectable ? (
          <label className="pick">
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={() => onToggleSelect(item)}
            />
            เลือก
          </label>
        ) : isAvailable ? (
          <button type="button" onClick={() => onBorrow(item)}>
            ขอยืม
          </button>
        ) : (
          // ป้ายด้านบนบอก "หมด" อยู่แล้ว ตรงนี้ใช้ข้อความสั้น ๆ ให้ความสูงเท่า checkbox
          // ถ้าใส่ปุ่มใหญ่ ๆ การ์ดจะสูงไม่เท่ากันทั้งแถว
          <span className="pick pick--disabled">ยืมไม่ได้</span>
        )}
      </footer>
    </article>
  )
}
