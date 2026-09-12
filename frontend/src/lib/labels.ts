import type { BorrowStatus, EquipmentStatus, Role } from '../types'

export const STATUS_LABEL: Record<BorrowStatus | EquipmentStatus, string> = {
  available: 'ว่าง',
  borrowed: 'หมด',
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ถูกปฏิเสธ',
  returning: 'แจ้งคืนแล้ว',
  returned: 'คืนแล้ว',
}

export const ROLE_LABEL: Record<Role, string> = {
  user: 'ผู้ยืม',
  staff: 'เจ้าหน้าที่',
  admin: 'ผู้ดูแลระบบ',
}