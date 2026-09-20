// สลับระหว่าง mock กับ backend จริงด้วย env ตัวเดียว
//   VITE_USE_MOCK=true  -> ใช้ mockApi (พัฒนา UI โดยไม่ต้องเปิด backend/db)
//   ไม่ตั้ง / false     -> ใช้ backend จริง (ค่าเริ่มต้น)
//
// ทุกหน้า import จากที่นี่:  import { api } from '../lib/api'

import { realApi } from './realApi'
import { mockApi } from './mockApi'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// mockApi ไม่มี me() / uploadImage() จึง cast ให้ type ตรงกับ realApi
// (ถ้าเปิดโหมด mock แล้วเรียกสองตัวนี้จะพังตอน runtime — ตั้งใจให้ใช้เฉพาะตอนต่อ backend จริง)
export const api: typeof realApi = USE_MOCK
  ? (mockApi as unknown as typeof realApi)
  : realApi

export { mockApi, realApi }
