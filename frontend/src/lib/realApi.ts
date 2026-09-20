import type {
  Equipment, EquipmentInput, Borrow, EquipmentLog,
  Category, CategoryInput, User, Role,
} from '../types'

// ===================================================================
// เรียก backend จริง — ชื่อฟังก์ชันและ signature เหมือน mockApi.ts ทุกตัว
//
// วิธีสลับมาใช้: ในไฟล์ที่ import mockApi อยู่ เปลี่ยนแค่บรรทัด import
//   ก่อน:  import { mockApi } from '../lib/mockApi'
//   หลัง:  import { realApi as mockApi } from '../lib/realApi'
// โค้ดส่วนที่เหลือไม่ต้องแก้เลย
//
// หรือใช้ไฟล์ api.ts ที่สลับด้วย env ให้อัตโนมัติ (ดู api.ts)
// ===================================================================

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

// ตัวตนมาจากคุกกี้ session (httpOnly) ที่ backend ตั้งให้ตอน login สำเร็จ
// ฝั่ง JS อ่านคุกกี้ไม่ได้และไม่จำเป็นต้องอ่าน — แค่ส่งไปกับทุก request
// credentials: 'include' เผื่อกรณีรัน vite dev server คนละ origin กับ backend
const CREDENTIALS: RequestCredentials = 'include'

function headers(json = true): HeadersInit {
  return json ? { 'Content-Type': 'application/json' } : {}
}

// backend ตอบ error เป็น { error: "ข้อความภาษาไทย" } — โยนเป็น Error ให้ UI จับได้เหมือนเดิม
async function handle<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T

  const text = await res.text()
  const body = text ? JSON.parse(text) : null

  if (!res.ok) throw new Error(body?.error ?? `เกิดข้อผิดพลาด (HTTP ${res.status})`)
  return body as T
}

const get = <T>(path: string) =>
  fetch(`${BASE}${path}`, { headers: headers(false), credentials: CREDENTIALS }).then(handle<T>)

const send = <T>(method: string, path: string, body?: unknown) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    credentials: CREDENTIALS,
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(handle<T>)

export const realApi = {
  // ===== อุปกรณ์ =====
  listEquipment: () => get<Equipment[]>('/equipment'),

  createEquipment: (input: EquipmentInput) => send<Equipment>('POST', '/equipment', input),

  updateEquipment: (id: string, input: EquipmentInput) =>
    send<Equipment>('PUT', `/equipment/${id}`, input),

  deleteEquipment: (id: string) => send<void>('DELETE', `/equipment/${id}`),

  // ===== หมวดหมู่ =====
  listCategories: () => get<Category[]>('/categories'),

  createCategory: (input: CategoryInput) => send<Category>('POST', '/categories', input),

  updateCategory: (id: number, input: CategoryInput) =>
    send<Category>('PUT', `/categories/${id}`, input),

  // ลบได้เสมอ — อุปกรณ์ในหมวดนี้จะกลายเป็น "ไม่ระบุหมวดหมู่"
  deleteCategory: (id: number) =>
    send<{ ok: true; unassigned: number }>('DELETE', `/categories/${id}`),

  // ===== การยืม — ฝั่งผู้ยืม =====
  requestBorrow: (equipmentId: string, dueDate: string, purpose?: string) =>
    send<Borrow>('POST', '/borrows', { equipmentId, dueDate, purpose }),

  listMyBorrows: () => get<Borrow[]>('/borrows/mine'),

  requestReturn: (borrowId: string) =>
    send<Borrow>('PUT', `/borrows/${borrowId}/request-return`),

  // ===== การยืม — ฝั่ง staff =====
  listBorrows: () => get<Borrow[]>('/borrows'),

  approveBorrow: (borrowId: string) => send<Borrow>('PUT', `/borrows/${borrowId}/approve`),

  rejectBorrow: (borrowId: string, reason?: string) =>
    send<Borrow>('PUT', `/borrows/${borrowId}/reject`, { reason }),

  confirmReturn: (borrowId: string, note?: string) =>
    send<Borrow>('PUT', `/borrows/${borrowId}/confirm-return`, { note }),

  // ประวัติของอุปกรณ์ชิ้นหนึ่ง (staff, admin)
  equipmentLogs: (equipmentId: string) =>
    get<EquipmentLog[]>(`/equipment/${equipmentId}/logs`),

  // ===== ผู้ใช้ — ฝั่ง admin =====
  listUsers: () => get<User[]>('/users'),

  updateUserRole: (userId: string, role: Role) =>
    send<User>('PUT', `/users/${userId}/role`, { role }),

  // ===== เพิ่มเติมจาก mockApi =====

  // ผู้ใช้ปัจจุบันจาก session — 401 ถ้ายังไม่ได้เข้าสู่ระบบ
  me: () => get<User & { activeRole: Role }>('/me'),

  // ช่องทาง login ที่เปิดใช้อยู่ (ตามที่ตั้ง env ไว้ฝั่ง backend)
  authProviders: () => get<{ providers: { name: string; label: string }[] }>('/auth/providers'),

  logout: () => send<void>('POST', '/auth/logout'),

  // อัปโหลดรูปจากเครื่อง แล้วเอา url ที่ได้ไปใส่เป็น imageUrl ตอน create/update
  async uploadImage(file: File): Promise<string> {
    const form = new FormData()
    form.append('file', file)

    const res = await fetch(`${BASE}/uploads`, {
      method: 'POST',
      headers: headers(false),   // ห้ามใส่ Content-Type เอง ให้ browser ใส่ boundary
      credentials: CREDENTIALS,
      body: form,
    })

    const { url } = await handle<{ url: string }>(res)
    return url
  },
}
