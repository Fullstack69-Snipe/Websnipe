export type Role = 'user' | 'staff' | 'admin'
export type EquipmentStatus = 'available' | 'borrowed'
export type BorrowStatus = 'pending' | 'approved' | 'rejected' | 'returning' | 'returned'

export type User = {
  id: string
  email: string
  fullName: string
  role: Role
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
  createdAt: string
  returnedAt: string | null
}