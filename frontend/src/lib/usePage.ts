import { useState } from 'react'

// แบ่งรายการยาวเป็นหน้า ๆ — resetKey เปลี่ยน (เช่น เปลี่ยนแท็บ/คำค้น) จะกลับไปหน้า 1
// shortcut: แบ่งหน้าในเบราว์เซอร์จากรายการที่โหลดมาทั้งหมด — ถ้าข้อมูลเป็นหมื่นแถวค่อยทำ limit/offset ที่ backend
export function usePage<T>(items: T[], resetKey: unknown = '', size = 15) {
  const [state, setState] = useState({ key: resetKey, page: 1 })
  // ต้องล้างหน้าเดิมทิ้งจริง ๆ ไม่งั้นสลับแท็บไปแล้วกลับมาจะเด้งกลับหน้าเดิม (แบบที่ React แนะนำ: ตั้ง state ระหว่าง render)
  if (!Object.is(state.key, resetKey)) setState({ key: resetKey, page: 1 })
  const pages = Math.max(1, Math.ceil(items.length / size))
  // รายการหดลง (เช่น เพิ่งลบแถวสุดท้ายของหน้า) ก็ไม่ค้างอยู่หน้าว่าง
  const page = Object.is(state.key, resetKey) ? Math.min(state.page, pages) : 1
  return {
    rows: items.slice((page - 1) * size, page * size),
    page,
    pages,
    setPage: (p: number) => setState({ key: resetKey, page: p }),
  }
}
