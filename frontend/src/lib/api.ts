// สลับระหว่าง mock กับ backend จริงด้วย env ตัวเดียว
//   VITE_USE_MOCK=true  -> ใช้ mockApi (พัฒนา UI โดยไม่ต้องเปิด backend/db)
//   ไม่ตั้ง / false     -> ใช้ backend จริง (ค่าเริ่มต้น)
//
// ทุกหน้า import จากที่นี่:  import { api } from '../lib/api'

import { realApi } from './realApi'
import { mockApi } from './mockApi'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// mockApi บางฟังก์ชันเป็นตัวจำลองแบบง่าย (type ไม่ตรงกับ realApi เป๊ะ) จึง cast ให้ตรงกัน
// ฟังก์ชันที่ mock ไม่มีจะพังตอน runtime — โหมด mock มีไว้พัฒนาหน้าจอ ไม่ได้จำลองทุกอย่าง
export const api: typeof realApi = USE_MOCK
  ? (mockApi as unknown as typeof realApi)
  : realApi

export { mockApi, realApi }
