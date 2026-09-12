import type { BorrowStatus, EquipmentStatus } from '../types'
import { STATUS_LABEL } from '../lib/labels'

export default function StatusBadge({ status }: { status: BorrowStatus | EquipmentStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
}