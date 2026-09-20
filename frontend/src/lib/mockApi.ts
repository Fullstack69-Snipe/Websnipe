import dayjs from 'dayjs'
import type { Equipment, EquipmentInput, Borrow, BorrowStatus, User, Role } from '../types'

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms))

// ผู้ใช้ปัจจุบันของโหมด mock (VITE_USE_MOCK=true) — ตัวจริงมาจาก session ที่ backend
export const CURRENT_USER_ID = 'u1'

// ---------- ข้อมูลตั้งต้น ----------
let users: User[] = [
  { id: 'u1', email: 'somchai@example.com', fullName: 'สมชาย ใจดี', role: 'user' },
  { id: 'u2', email: 'somying@example.com', fullName: 'สมหญิง รักงาน', role: 'staff' },
  { id: 'u3', email: 'admin@example.com', fullName: 'ผู้ดูแล ระบบ', role: 'admin' },
  { id: 'u4', email: 'wichai@example.com', fullName: 'วิชัย มั่นคง', role: 'user' },
]

// ในฐานข้อมูลจริงจะเก็บแบบนี้ — ไม่มี available (คำนวณจากรายการยืมทุกครั้ง)
type EquipmentRow = Omit<Equipment, 'available'>

let equipment: EquipmentRow[] = [
  { id: 'e1', name: 'กล้อง Canon EOS R50', description: 'พร้อมเลนส์คิท 18-45mm', imageUrl: 'https://picsum.photos/seed/camera/400/240', quantity: 2 },
  { id: 'e2', name: 'โน้ตบุ๊ก Dell Latitude 5450', description: 'i5 / RAM 16GB / SSD 512GB', imageUrl: 'https://picsum.photos/seed/laptop/400/240', quantity: 3 },
  { id: 'e3', name: 'ขาตั้งกล้อง Manfrotto', description: 'สูงสุด 160 cm พร้อมกระเป๋า', imageUrl: 'https://picsum.photos/seed/tripod/400/240', quantity: 4 },
  { id: 'e4', name: 'ไมค์ Rode Wireless GO II', description: 'ไมค์ไร้สาย 2 ตัว', imageUrl: null, quantity: 1 },
  { id: 'e5', name: 'โปรเจกเตอร์ Epson EB-X06', description: '3600 lumens พร้อมสาย HDMI', imageUrl: 'https://picsum.photos/seed/projector/400/240', quantity: 1 },
  { id: 'e6', name: 'ไฟ LED Godox SL60', description: 'พร้อมซอฟต์บ็อกซ์', imageUrl: 'https://picsum.photos/seed/light/400/240', quantity: 6 },
]

// seed ให้มีรายการยืมอยู่แล้ว จะได้เห็นหน้าต่าง ๆ ไม่ว่างเปล่า
let borrows: Borrow[] = [
  {
    id: 'b1', equipmentId: 'e2', equipmentName: 'โน้ตบุ๊ก Dell Latitude 5450',
    borrowerId: 'u4', borrowerName: 'วิชัย มั่นคง',
    dueDate: dayjs().add(5, 'day').format('YYYY-MM-DD'),
    status: 'approved', createdAt: dayjs().subtract(2, 'day').toISOString(), returnedAt: null,
  },
  {
    id: 'b2', equipmentId: 'e5', equipmentName: 'โปรเจกเตอร์ Epson EB-X06',
    borrowerId: 'u1', borrowerName: 'สมชาย ใจดี',
    dueDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),   // เกินกำหนดแล้ว!
    status: 'approved', createdAt: dayjs().subtract(9, 'day').toISOString(), returnedAt: null,
  },
  {
    id: 'b3', equipmentId: 'e1', equipmentName: 'กล้อง Canon EOS R50',
    borrowerId: 'u1', borrowerName: 'สมชาย ใจดี',
    dueDate: dayjs().subtract(20, 'day').format('YYYY-MM-DD'),
    status: 'returned', createdAt: dayjs().subtract(30, 'day').toISOString(),
    returnedAt: dayjs().subtract(21, 'day').toISOString(),
  },
]

// ---------- helper ----------
// สถานะที่ "ถือของอยู่" — pending ไม่นับ เพราะ staff อาจปฏิเสธ
const HOLDING: BorrowStatus[] = ['approved', 'returning']

function borrowedCount(equipmentId: string) {
  return borrows.filter((b) => b.equipmentId === equipmentId && HOLDING.includes(b.status)).length
}

// แปลงแถวจาก DB → ข้อมูลที่หน้าจอใช้ (เติม available ให้)
function withAvailable(row: EquipmentRow): Equipment {
  return { ...row, available: row.quantity - borrowedCount(row.id) }
}

function findEquipment(id: string): Equipment {
  const row = equipment.find((e) => e.id === id)
  if (!row) throw new Error('ไม่พบอุปกรณ์')
  return withAvailable(row)
}
function findBorrow(id: string) {
  const b = borrows.find((b) => b.id === id)
  if (!b) throw new Error('ไม่พบรายการยืม')
  return b
}
function findUser(id: string) {
  const u = users.find((u) => u.id === id)
  if (!u) throw new Error('ไม่พบผู้ใช้')
  return u
}
function patchEquipment(id: string, patch: Partial<EquipmentRow>) {
  equipment = equipment.map((e) => (e.id === id ? { ...e, ...patch } : e))
}
function patchBorrow(id: string, patch: Partial<Borrow>) {
  borrows = borrows.map((b) => (b.id === id ? { ...b, ...patch } : b))
  return findBorrow(id)
}

// ---------- API ----------
export const mockApi = {
  // ===== อุปกรณ์ (ทุกคนอ่านได้ / staff+admin เขียนได้) =====
  async listEquipment(): Promise<Equipment[]> {
    await delay()
    return equipment.map(withAvailable)
  },

  async createEquipment(input: EquipmentInput): Promise<Equipment> {
    await delay()
    const row: EquipmentRow = { ...input, id: crypto.randomUUID() }
    equipment = [...equipment, row]
    return withAvailable(row)
  },

  async updateEquipment(id: string, input: EquipmentInput): Promise<Equipment> {
    await delay()
    findEquipment(id)
    const holding = borrowedCount(id)
    if (input.quantity < holding) {
      throw new Error(`ลดจำนวนไม่ได้ ตอนนี้ถูกยืมอยู่ ${holding} ชิ้น`)
    }
    patchEquipment(id, input)
    return findEquipment(id)
  },

  async deleteEquipment(id: string): Promise<void> {
    await delay()
    findEquipment(id)
    if (borrowedCount(id) > 0) throw new Error('อุปกรณ์กำลังถูกยืมอยู่ ลบไม่ได้')
    equipment = equipment.filter((e) => e.id !== id)
  },

  // ===== การยืม — ฝั่งผู้ยืม =====
  async requestBorrow(equipmentId: string, dueDate: string): Promise<Borrow> {
    await delay()
    const item = findEquipment(equipmentId)
    if (item.available <= 0) throw new Error('อุปกรณ์ชิ้นนี้ถูกยืมหมดแล้ว')
    const me = findUser(CURRENT_USER_ID)

    const borrow: Borrow = {
      id: crypto.randomUUID(),
      equipmentId,
      equipmentName: item.name,
      borrowerId: me.id,
      borrowerName: me.fullName,
      dueDate,
      status: 'pending',
      createdAt: new Date().toISOString(),
      returnedAt: null,
    }
    borrows = [...borrows, borrow]
    return borrow
  },

  async listMyBorrows(): Promise<Borrow[]> {
    await delay()
    return borrows
      .filter((b) => b.borrowerId === CURRENT_USER_ID)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))   // ใหม่สุดขึ้นก่อน
  },

  async requestReturn(borrowId: string): Promise<Borrow> {
    await delay()
    const b = findBorrow(borrowId)
    if (b.status !== 'approved') throw new Error('รายการนี้ยังไม่ได้อยู่ในสถานะยืม')
    return patchBorrow(borrowId, { status: 'returning' })
  },

  // ===== การยืม — ฝั่ง staff =====
  async listBorrows(): Promise<Borrow[]> {
    await delay()
    return [...borrows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async approveBorrow(borrowId: string): Promise<Borrow> {
    await delay()
    const b = findBorrow(borrowId)
    if (b.status !== 'pending') throw new Error('รายการนี้ไม่ได้รออนุมัติ')
    const item = findEquipment(b.equipmentId)
    if (item.available <= 0) throw new Error('อุปกรณ์หมดแล้ว ถูกอนุมัติให้คนอื่นไปก่อน')

    // ไม่ต้องแก้ equipment — available จะลดลงเองเพราะคำนวณจาก borrows
    return patchBorrow(borrowId, { status: 'approved' })
  },

  async rejectBorrow(borrowId: string): Promise<Borrow> {
    await delay()
    const b = findBorrow(borrowId)
    if (b.status !== 'pending') throw new Error('รายการนี้ไม่ได้รออนุมัติ')
    return patchBorrow(borrowId, { status: 'rejected' })
  },

  async confirmReturn(borrowId: string): Promise<Borrow> {
    await delay()
    const b = findBorrow(borrowId)
    if (b.status !== 'approved' && b.status !== 'returning') {
      throw new Error('รายการนี้ไม่ได้อยู่ระหว่างการยืม')
    }
    // ไม่ต้องแก้ equipment — available จะเพิ่มขึ้นเองเพราะคำนวณจาก borrows
    return patchBorrow(borrowId, { status: 'returned', returnedAt: new Date().toISOString() })
  },

  // ===== ผู้ใช้ — ฝั่ง admin =====
  async listUsers(): Promise<User[]> {
    await delay()
    return users
  },

  // ===== auth (โหมด mock: ถือว่า login เป็น CURRENT_USER_ID อยู่แล้วเสมอ) =====
  async me(): Promise<User & { activeRole: Role }> {
    await delay(0)
    const u = findUser(CURRENT_USER_ID)
    return { ...u, activeRole: u.role }
  },

  async authProviders(): Promise<{ providers: { name: string; label: string }[] }> {
    await delay(0)
    return { providers: [] }
  },

  async logout(): Promise<void> {
    await delay(0)
  },

  async updateUserRole(userId: string, role: Role): Promise<User> {
    await delay()
    findUser(userId)
    users = users.map((u) => (u.id === userId ? { ...u, role } : u))
    return findUser(userId)
  },
}