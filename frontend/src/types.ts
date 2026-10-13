export type Role = 'user' | 'staff' | 'admin'
export type EquipmentStatus = 'available' | 'borrowed'
export type BorrowStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'returning'
  | 'returned'
  | 'cancelled'   // ผู้ยืมกดยกเลิกเอง ขณะที่ยังรออนุมัติ

export type User = {
  id: string
  email: string
  fullName: string
  role: Role
  avatarUrl?: string | null
}

export type Category = {
  id: number
  name: string
  description: string | null
  equipmentCount: number
}

export type CategoryInput = {
  name: string
  description?: string | null
}

export type Equipment = {
  id: string
  name: string
  description: string
  imageUrl: string | null
  quantity: number     // จำนวนทั้งหมดที่มี
  available: number    // จำนวนที่เหลือให้ยืม (ระบบคำนวณให้ ไม่ได้เก็บใน DB)
  categoryId: number | null
  categoryName: string | null   // ระบบ join มาให้ ไม่ต้องส่งตอนบันทึก
}

// ข้อมูลที่ staff กรอกตอนเพิ่ม/แก้ไข (ไม่มี id เพราะระบบสร้าง / ไม่มี available เพราะระบบคำนวณ)
export type EquipmentInput = Omit<Equipment, 'id' | 'available' | 'categoryName'>

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
   // ช่วงเวลายืม + การรับของ — null ถ้าเป็นรายการเก่าก่อนมีฟีเจอร์นี้
  details: BorrowDetails | null
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
  | 'borrow_cancelled'
  | 'borrow_picked_up'

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

export type BorrowDetails = {
  borrowId: string
  startAt: string           // ISO datetime พร้อม timezone เช่น 2026-10-16T09:00:00+07:00
  endAt: string
  pickedUpAt: string | null // null = อนุมัติแล้วแต่ยังไม่มารับของ
  pickedUpBy: string | null
}

export type Department = {
  id: number
  name: string
  createdAt: string
}