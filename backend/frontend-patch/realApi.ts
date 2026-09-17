import type { Equipment, EquipmentInput, Borrow, User, Role } from '../types'

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

// ยังไม่มี login — ส่งตัวตนผ่าน header ชั่วคราว (ตรงกับ middleware/identity.js)
// พอทำ login จริงแล้ว ลบสองฟังก์ชันนี้ทิ้ง เปลี่ยนไปใส่ Authorization: Bearer <token>
let currentUserId = localStorage.getItem('userId') ?? 'u1'
let currentRole: Role | null = null

export function setCurrentUserId(id: string) {
  currentUserId = id
  localStorage.setItem('userId', id)
}

// ให้ RoleProvider เรียกตอน setRole เพื่อให้ backend ตรวจสิทธิ์ตาม role ที่เลือกบนจอ
export function setCurrentRole(role: Role | null) {
  currentRole = role
}

function headers(json = true): HeadersInit {
  const h: Record<string, string> = { 'x-user-id': currentUserId }
  if (json) h['Content-Type'] = 'application/json'
  if (currentRole) h['x-role'] = currentRole
  return h
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
  fetch(`${BASE}${path}`, { headers: headers(false) }).then(handle<T>)

const send = <T>(method: string, path: string, body?: unknown) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(handle<T>)

export const realApi = {
  // ===== อุปกรณ์ =====
  listEquipment: () => get<Equipment[]>('/equipment'),

  createEquipment: (input: EquipmentInput) => send<Equipment>('POST', '/equipment', input),

  updateEquipment: (id: string, input: EquipmentInput) =>
    send<Equipment>('PUT', `/equipment/${id}`, input),

  deleteEquipment: (id: string) => send<void>('DELETE', `/equipment/${id}`),

  // ===== การยืม — ฝั่งผู้ยืม =====
  requestBorrow: (equipmentId: string, dueDate: string) =>
    send<Borrow>('POST', '/borrows', { equipmentId, dueDate }),

  listMyBorrows: () => get<Borrow[]>('/borrows/mine'),

  requestReturn: (borrowId: string) =>
    send<Borrow>('PUT', `/borrows/${borrowId}/request-return`),

  // ===== การยืม — ฝั่ง staff =====
  listBorrows: () => get<Borrow[]>('/borrows'),

  approveBorrow: (borrowId: string) => send<Borrow>('PUT', `/borrows/${borrowId}/approve`),

  rejectBorrow: (borrowId: string) => send<Borrow>('PUT', `/borrows/${borrowId}/reject`),

  confirmReturn: (borrowId: string) =>
    send<Borrow>('PUT', `/borrows/${borrowId}/confirm-return`),

  // ===== ผู้ใช้ — ฝั่ง admin =====
  listUsers: () => get<User[]>('/users'),

  updateUserRole: (userId: string, role: Role) =>
    send<User>('PUT', `/users/${userId}/role`, { role }),

  // ===== เพิ่มเติมจาก mockApi =====

  // ผู้ใช้ปัจจุบัน — ใช้แทนค่าคงที่ CURRENT_USER_ID
  me: () => get<User & { activeRole: Role }>('/me'),

  // อัปโหลดรูปจากเครื่อง แล้วเอา url ที่ได้ไปใส่เป็น imageUrl ตอน create/update
  async uploadImage(file: File): Promise<string> {
    const form = new FormData()
    form.append('file', file)

    const res = await fetch(`${BASE}/uploads`, {
      method: 'POST',
      headers: headers(false),   // ห้ามใส่ Content-Type เอง ให้ browser ใส่ boundary
      body: form,
    })

    const { url } = await handle<{ url: string }>(res)
    return url
  },
}
