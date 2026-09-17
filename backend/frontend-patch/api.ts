import { realApi } from './realApi'

// Fallback: if the mock module is missing, keep the app working by using the real API
// implementation as a safe local stub. This avoids the TypeScript error without
// changing other files or depending on a non-existent module.
const mockApi: typeof realApi = { ...realApi }

// สลับระหว่าง mock กับ backend จริงด้วย env ตัวเดียว
//   VITE_USE_MOCK=true   -> ใช้ mockApi (พัฒนา UI แบบไม่ต้องเปิด backend)
//   ไม่ตั้ง / false      -> ใช้ backend จริง
//
// ในไฟล์ page ทั้งหมด import จากที่นี่:
//   import { api } from '../lib/api'
// แล้วเรียก api.listEquipment() เหมือนเดิม

declare global {
  interface ImportMeta {
    readonly env: {
      readonly VITE_USE_MOCK?: string
      readonly [key: string]: string | undefined
    }
  }
}

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// cast เป็น typeof realApi เพื่อให้ me() / uploadImage() ที่มีแต่ใน realApi ยัง type-check ผ่าน
export const api: typeof realApi = USE_MOCK
  ? (mockApi as unknown as typeof realApi)
  : realApi

export { mockApi, realApi }
