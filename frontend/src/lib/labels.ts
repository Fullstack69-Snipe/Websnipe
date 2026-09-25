import type { BorrowStatus, EquipmentStatus, LogAction, Role } from '../types'

export const STATUS_LABEL: Record<BorrowStatus | EquipmentStatus, string> = {
  available: 'ว่าง',
  borrowed: 'หมด',
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ถูกปฏิเสธ',
  returning: 'แจ้งคืนแล้ว',
  returned: 'คืนแล้ว',
  cancelled: 'ยกเลิกแล้ว',
}

export const ROLE_LABEL: Record<Role, string> = {
  user: 'ผู้ยืม',
  staff: 'เจ้าหน้าที่',
  admin: 'ผู้ดูแลระบบ',
}

export const LOG_ACTION_LABEL: Record<LogAction, string> = {
  equipment_created: 'เพิ่มอุปกรณ์',
  equipment_updated: 'แก้ไขอุปกรณ์',
  equipment_deleted: 'ลบอุปกรณ์',
  borrow_requested: 'ขอยืม',
  borrow_approved: 'อนุมัติ',
  borrow_rejected: 'ปฏิเสธ',
  borrow_return_requested: 'แจ้งคืน',
  borrow_returned: 'รับคืนแล้ว',
  borrow_cancelled: 'ยกเลิกคำขอ',
}
