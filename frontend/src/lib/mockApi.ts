import dayjs from 'dayjs'
import type {
  Equipment, EquipmentInput, Borrow, BorrowDetails, BorrowStatus, EquipmentLog,
  Category, CategoryInput, Department, User, Role,
} from '../types'

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms))

// ผู้ใช้ปัจจุบันของโหมด mock (VITE_USE_MOCK=true) — ตัวจริงมาจาก session ที่ backend
//
// สลับ role ตอนพัฒนาได้ด้วย VITE_MOCK_ROLE ใน .env.local เช่น
//   VITE_MOCK_ROLE=staff   -> เห็นเมนูจัดการอุปกรณ์ / คำขอยืม
//   VITE_MOCK_ROLE=admin   -> เห็นเมนูจัดการผู้ใช้ด้วย
//   ไม่ตั้ง                -> เป็นผู้ยืมธรรมดา
const MOCK_USER_BY_ROLE: Record<Role, string> = { user: 'u1', staff: 'u2', admin: 'u3' }
const MOCK_ROLE = (import.meta.env.VITE_MOCK_ROLE as Role) || 'user'

export const CURRENT_USER_ID = MOCK_USER_BY_ROLE[MOCK_ROLE] ?? 'u1'

// ---------- ข้อมูลตั้งต้น ----------
let users: User[] = [
  { id: 'u1', email: 'somchai@example.com', fullName: 'สมชาย ใจดี', role: 'user' },
  { id: 'u2', email: 'somying@example.com', fullName: 'สมหญิง รักงาน', role: 'staff' },
  { id: 'u3', email: 'admin@example.com', fullName: 'ผู้ดูแล ระบบ', role: 'admin' },
  { id: 'u4', email: 'wichai@example.com', fullName: 'วิชัย มั่นคง', role: 'user' },
]

// ในฐานข้อมูลจริงจะเก็บแบบนี้ — ไม่มี available (คำนวณจากรายการยืมทุกครั้ง)
type EquipmentRow = Omit<Equipment, 'available'>

let categories: Category[] = [
  { id: 1, name: 'กล้องและถ่ายภาพ', description: 'กล้อง เลนส์ ขาตั้ง', equipmentCount: 2 },
  { id: 2, name: 'คอมพิวเตอร์', description: 'โน้ตบุ๊ก แท็บเล็ต', equipmentCount: 1 },
  { id: 3, name: 'เสียงและแสง', description: 'ไมค์ ไฟ ลำโพง', equipmentCount: 2 },
  { id: 4, name: 'จอและการนำเสนอ', description: 'โปรเจกเตอร์ จอ', equipmentCount: 1 },
]

let equipment: EquipmentRow[] = [
  { id: 'e1', categoryId: 1, categoryName: null, departmentId: null, departmentName: null, name: 'กล้อง Canon EOS R50', description: 'กล้องมิเรอร์เลส 24MP พร้อมเลนส์ RF-S 18-45mm และแบตสำรอง 1 ก้อน', imageUrl: '/seed/canon-eos-r50.jpg', quantity: 2 },
  { id: 'e2', categoryId: 2, categoryName: null, departmentId: null, departmentName: null, name: 'โน้ตบุ๊ก Dell Latitude 7490', description: 'Core i5 / RAM 16GB / SSD 512GB พร้อมสายชาร์จและเมาส์', imageUrl: '/seed/dell-latitude-7490.jpg', quantity: 3 },
  { id: 'e3', categoryId: 1, categoryName: null, departmentId: null, departmentName: null, name: 'ขาตั้งกล้อง Manfrotto 190XB', description: 'สูงสุด 146 cm พร้อมหัวบอลและกระเป๋า', imageUrl: '/seed/manfrotto-190xb.jpg', quantity: 4 },
  { id: 'e4', categoryId: 3, categoryName: null, departmentId: null, departmentName: null, name: 'ไมค์ไร้สาย Rode Wireless GO II', description: 'ตัวส่ง 2 ตัว + ตัวรับ 1 ตัว พร้อมขนกันลม', imageUrl: '/seed/rode-wireless-go-ii.jpg', quantity: 2 },
  { id: 'e5', categoryId: 4, categoryName: null, departmentId: null, departmentName: null, name: 'โปรเจกเตอร์ Epson EB-U04', description: '3,000 lumens ความละเอียด WUXGA พร้อมสาย HDMI 5 เมตร', imageUrl: '/seed/epson-eb-u04.jpg', quantity: 1 },
  { id: 'e6', categoryId: 1, categoryName: null, departmentId: null, departmentName: null, name: 'แฟลช Godox TT685 II', description: 'แฟลชหัวกล้อง TTL สำหรับกล้อง Sony พร้อมถ่านชาร์จ 4 ก้อน', imageUrl: '/seed/godox-tt685ii.jpg', quantity: 6 },
]

let departments: Department[] = [
  { id: 1, name: 'คณะวิศวกรรมศาสตร์', createdAt: dayjs().subtract(60, 'day').toISOString(), staff: [], equipmentCount: 0 },
  { id: 2, name: 'คณะบริหารธุรกิจ', createdAt: dayjs().subtract(60, 'day').toISOString(), staff: [], equipmentCount: 0 },
]

// สร้างข้อมูลช่วงเวลายืมให้ครบรูปแบบเดียวกับที่ backend ส่งมา (ตาราง ws_borrow_details)
function makeDetails(
  borrowId: string,
  startAt: string,
  endAt: string,
  pickedUp = false,
): BorrowDetails {
  return {
    borrowId,
    startAt,
    endAt,
    pickedUpAt: pickedUp ? startAt : null,
    pickedUpBy: pickedUp ? 'u2' : null,
  }
}

// seed ให้มีรายการยืมอยู่แล้ว จะได้เห็นหน้าต่าง ๆ ไม่ว่างเปล่า
let borrows: Borrow[] = [
  {
    id: 'b1', equipmentId: 'e2', equipmentName: 'โน้ตบุ๊ก Dell Latitude 5450',
    borrowerId: 'u4', borrowerName: 'วิชัย มั่นคง',
    dueDate: dayjs().add(5, 'day').format('YYYY-MM-DD'),
    purpose: null, approvedBy: null, approverName: null, approvedAt: null,
    rejectReason: null, receivedBy: null, returnNote: null,
    status: 'approved', createdAt: dayjs().subtract(2, 'day').toISOString(), returnedAt: null,
    // รับของไปแล้ว
    details: makeDetails(
      'b1',
      dayjs().subtract(2, 'day').toISOString(),
      dayjs().add(5, 'day').toISOString(),
      true,
    ),
  },
  {
    id: 'b2', equipmentId: 'e5', equipmentName: 'โปรเจกเตอร์ Epson EB-X06',
    borrowerId: 'u1', borrowerName: 'สมชาย ใจดี',
    dueDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),   // เกินกำหนดแล้ว!
    purpose: null, approvedBy: null, approverName: null, approvedAt: null,
    rejectReason: null, receivedBy: null, returnNote: null,
    status: 'approved', createdAt: dayjs().subtract(9, 'day').toISOString(), returnedAt: null,
    // อนุมัติแล้วแต่ "ยังไม่มารับของ" — ไว้ทดสอบปุ่มส่งมอบ
    details: makeDetails(
      'b2',
      dayjs().subtract(9, 'day').toISOString(),
      dayjs().subtract(1, 'day').toISOString(),
    ),
  },
  {
    id: 'b3', equipmentId: 'e1', equipmentName: 'กล้อง Canon EOS R50',
    borrowerId: 'u1', borrowerName: 'สมชาย ใจดี',
    dueDate: dayjs().subtract(20, 'day').format('YYYY-MM-DD'),
    purpose: null, approvedBy: null, approverName: null, approvedAt: null,
    rejectReason: null, receivedBy: null, returnNote: null,
    status: 'returned', createdAt: dayjs().subtract(30, 'day').toISOString(),
    returnedAt: dayjs().subtract(21, 'day').toISOString(),
    details: makeDetails(
      'b3',
      dayjs().subtract(30, 'day').toISOString(),
      dayjs().subtract(20, 'day').toISOString(),
      true,
    ),
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

  qrImageUrl: () => '',

  // โหมด mock ไม่มีแจ้งเตือน
  async listNotifications() {
    return { items: [], unread: 0 }
  },
  async markNotificationRead() {},
  async markAllNotificationsRead() {},

  // โหมด mock ไม่มี backend ให้อัปโหลด — ใช้ URL ชั่วคราวของไฟล์ในเบราว์เซอร์แทน
  async uploadImage(file: File): Promise<string> {
    await delay()
    return URL.createObjectURL(file)
  },

  // โหมด mock ไม่มีรูปจาก backend — หน้า login ใช้รูปตั้งต้นของตัวเองแทน
  async showcasePhotos() {
    return { photos: [] as string[] }
  },

  async equipmentBookings() {
    await delay(0)
    return []
  },

  async renameDepartment(id: number, name: string): Promise<Department> {
    await delay()
    departments = departments.map((d) => (d.id === id ? { ...d, name } : d))
    return departments.find((d) => d.id === id)!
  },

  async deleteDepartment(id: number) {
    await delay()
    departments = departments.filter((d) => d.id !== id)
    return { ok: true as const, unassigned: 0 }
  },

  async getEquipment(id: string): Promise<Equipment> {
    await delay()
    return findEquipment(id)
  },

  async createEquipment(input: EquipmentInput): Promise<Equipment> {
    await delay()
    const row: EquipmentRow = {
      ...input,
      id: crypto.randomUUID(),
      categoryName: null,
      departmentId: null,
      departmentName: null,
    }
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

  // ===== หมวดหมู่ =====
  async listCategories(): Promise<Category[]> {
    await delay(0)
    return categories
  },

  async createCategory(input: CategoryInput): Promise<Category> {
    await delay()
    const row: Category = {
      id: Math.max(0, ...categories.map((c) => c.id)) + 1,
      name: input.name,
      description: input.description ?? null,
      equipmentCount: 0,
    }
    categories = [...categories, row]
    return row
  },

  async updateCategory(id: number, input: CategoryInput): Promise<Category> {
    await delay()
    categories = categories.map((c) =>
      c.id === id ? { ...c, name: input.name, description: input.description ?? null } : c,
    )
    return categories.find((c) => c.id === id)!
  },

  async deleteCategory(id: number): Promise<{ ok: true; unassigned: number }> {
    await delay()
    const unassigned = equipment.filter((e) => e.categoryId === id).length
    equipment = equipment.map((e) => (e.categoryId === id ? { ...e, categoryId: null } : e))
    categories = categories.filter((c) => c.id !== id)
    return { ok: true, unassigned }
  },

  // ===== การยืม — ฝั่งผู้ยืม =====
  // startAt/endAt เป็น ISO พร้อม timezone — backend คำนวณ dueDate จาก endAt ให้เอง
  async requestBorrow(
    equipmentId: string,
    startAt: string,
    endAt: string,
    purpose?: string,
  ): Promise<Borrow> {
    await delay()
    const item = findEquipment(equipmentId)
    if (item.available <= 0) throw new Error('อุปกรณ์ชิ้นนี้ถูกยืมหมดแล้ว')
    if (!dayjs(endAt).isAfter(dayjs(startAt))) {
      throw new Error('วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น')
    }
    const me = findUser(CURRENT_USER_ID)
    const id = crypto.randomUUID()

    const borrow: Borrow = {
      id,
      equipmentId,
      equipmentName: item.name,
      borrowerId: me.id,
      borrowerName: me.fullName,
      dueDate: dayjs(endAt).format('YYYY-MM-DD'),
      purpose: purpose ?? null,
      approvedBy: null,
      approverName: null,
      approvedAt: null,
      rejectReason: null,
      receivedBy: null,
      returnNote: null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      returnedAt: null,
      details: makeDetails(id, startAt, endAt),
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

  // ยกเลิกคำขอของตัวเอง — ทำได้เฉพาะตอนที่ยังรออนุมัติ
  // ถ้าอนุมัติไปแล้วต้องใช้วิธี "แจ้งคืน" แทน เพราะของออกจากคลังไปแล้ว
  async cancelBorrow(borrowId: string): Promise<Borrow> {
    await delay()
    const b = findBorrow(borrowId)
    if (b.borrowerId !== CURRENT_USER_ID) throw new Error('ยกเลิกได้เฉพาะคำขอของตัวเอง')
    if (b.status !== 'pending') throw new Error('ยกเลิกได้เฉพาะคำขอที่ยังรออนุมัติ')
    return patchBorrow(borrowId, { status: 'cancelled' })
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

  // เจ้าหน้าที่ยืนยันว่าส่งมอบของให้ผู้ยืมแล้ว
  // ไม่ได้เปลี่ยน status — ดูจาก details.pickedUpAt แทน (ตรงกับที่ backend ทำ)
  async pickupBorrow(borrowId: string): Promise<Borrow> {
    await delay()
    const b = findBorrow(borrowId)
    if (b.status !== 'approved') throw new Error('ต้องอนุมัติรายการก่อนส่งมอบ')
    if (!b.details) throw new Error('ไม่มีข้อมูลช่วงเวลายืม')
    if (b.details.pickedUpAt) throw new Error('รายการนี้รับอุปกรณ์แล้ว')

    return patchBorrow(borrowId, {
      details: {
        ...b.details,
        pickedUpAt: new Date().toISOString(),
        pickedUpBy: CURRENT_USER_ID,
      },
    })
  },

  async rejectBorrow(borrowId: string, reason?: string): Promise<Borrow> {
    await delay()
    const b = findBorrow(borrowId)
    if (b.status !== 'pending') throw new Error('รายการนี้ไม่ได้รออนุมัติ')
    return patchBorrow(borrowId, { status: 'rejected', rejectReason: reason ?? null })
  },

  async confirmReturn(borrowId: string, note?: string): Promise<Borrow> {
    await delay()
    const b = findBorrow(borrowId)
    if (b.status !== 'approved' && b.status !== 'returning') {
      throw new Error('รายการนี้ไม่ได้อยู่ระหว่างการยืม')
    }
    // ไม่ต้องแก้ equipment — available จะเพิ่มขึ้นเองเพราะคำนวณจาก borrows
    return patchBorrow(borrowId, { status: 'returned', returnedAt: new Date().toISOString(), returnNote: note ?? null })
  },

  // ===== แผนก =====
  async listDepartments(): Promise<Department[]> {
    await delay()
    return departments
  },

  async createDepartment(name: string): Promise<Department> {
    await delay()
    if (!name.trim()) throw new Error('ชื่อแผนกต้องมี 1–120 ตัวอักษร')
    if (departments.some((d) => d.name === name.trim())) throw new Error('ชื่อแผนกซ้ำ')

    const dep: Department = {
      id: Math.max(0, ...departments.map((d) => d.id)) + 1,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      staff: [],
      equipmentCount: 0,
    }
    departments = [...departments, dep]
    return dep
  },

  // โหมด mock ไม่ได้ผูกอุปกรณ์กับแผนกจริง คืนทั้งหมดไปก่อน
  async departmentEquipment(): Promise<Equipment[]> {
    await delay()
    return equipment.map(withAvailable)
  },

  async assignEquipmentToDepartment(departmentId: number, equipmentId: string) {
    await delay()
    return { equipmentId, departmentId }
  },

  async assignStaffToDepartment(departmentId: number, userId: string) {
    await delay()
    return { userId, departmentId }
  },

  async removeStaffFromDepartment() {
    await delay()
  },

  async unassignEquipmentFromDepartment() {
    await delay()
  },

  // ===== ผู้ใช้ — ฝั่ง admin =====
  async listUsers(): Promise<User[]> {
    await delay()
    return users
  },

  // โหมด mock ไม่ได้เก็บประวัติ คืนว่างไว้ให้หน้าจอไม่พัง
  async equipmentLogs(): Promise<EquipmentLog[]> {
    await delay(0)
    return []
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