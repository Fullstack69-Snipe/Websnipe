export type Role = 'user' | 'staff' | 'admin'
export type EquipmentStatus = 'available' | 'borrowed'
export type BorrowStatus = 'pending' | 'approved' | 'rejected' | 'returning' | 'returned'

export type User = {
  id: string
  email: string
  fullName: string
  role: Role
  avatarUrl?: string | null
}

export type Equipment = {
  id: string
  name: string
  description: string
  imageUrl: string | null
  quantity: number     // จำนวนทั้งหมดที่มี
  available: number    // จำนวนที่เหลือให้ยืม (ระบบคำนวณให้ ไม่ได้เก็บใน DB)
}

// ข้อมูลที่ staff กรอกตอนเพิ่ม/แก้ไข (ไม่มี id เพราะระบบสร้าง / ไม่มี available เพราะระบบคำนวณ)
export type EquipmentInput = Omit<Equipment, 'id' | 'available'>

export type Borrow = {
  id: string
  equipmentId: string
  equipmentName: string
  borrowerId: string
  borrowerName: string
  dueDate: string
  status: BorrowStatus
  purpose: string | null
  // ใครอนุมัติ/ปฏิเสธ และเหตุผลถ้าถูกปฏิเสธ
  approvedBy: string | null
  approverName: string | null
  approvedAt: string | null
  rejectReason: string | null
  // ใครรับคืน และสภาพของตอนคืน
  receivedBy: string | null
  returnNote: string | null
  createdAt: string
  returnedAt: string | null
}

export type LogAction =
  | 'equipment_created'
  | 'equipment_updated'
  | 'equipment_deleted'
  | 'borrow_requested'
  | 'borrow_approved'
  | 'borrow_rejected'
  | 'borrow_return_requested'
  | 'borrow_returned'

export type EquipmentLog = {
  id: number
  equipmentId: string | null
  equipmentName: string
  borrowId: string | null
  actorId: string | null
  actorName: string
  action: LogAction
  fromStatus: BorrowStatus | null
  toStatus: BorrowStatus | null
  note: string | null
  createdAt: string
}