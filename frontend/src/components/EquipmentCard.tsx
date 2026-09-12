import type { Equipment } from '../types'
import StatusBadge from './StatusBadge'

type Props = {
  item: Equipment
  onBorrow: (item: Equipment) => void
}

export default function EquipmentCard({ item, onBorrow }: Props) {
  const isAvailable = item.available > 0

  return (
    <article className="equipment-card">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} loading="lazy" />
      ) : (
        <div className="equipment-card__placeholder">ไม่มีรูป</div>
      )}

      <header>
        <strong>{item.name}</strong>
        <StatusBadge status={isAvailable ? 'available' : 'borrowed'} />
      </header>

      <p>{item.description}</p>

      <footer>
        <span className={`stock ${isAvailable ? '' : 'stock--empty'}`}>
          เหลือ <strong>{item.available}</strong> / {item.quantity} ชิ้น
        </span>
        <button type="button" disabled={!isAvailable} onClick={() => onBorrow(item)}>
          {isAvailable ? 'ขอยืม' : 'หมด'}
        </button>
      </footer>
    </article>
  )
}
