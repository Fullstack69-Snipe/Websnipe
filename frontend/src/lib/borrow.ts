import dayjs from 'dayjs'
import type { Borrow, BorrowStatus } from '../types'

// สถานะที่ถือว่า "ยังไม่จบ"
export const ACTIVE: BorrowStatus[] = ['pending', 'approved', 'returning']

export const isHolding = (b: Borrow) => b.status === 'approved' || b.status === 'returning'

// อนุมัติแล้วแต่ผู้ยืมยังไม่มารับของ
// รายการเก่าที่ไม่มี details ถือว่ารับไปแล้ว เพราะย้อนไปเช็คไม่ได้
export const needsPickup = (b: Borrow) =>
  b.status === 'approved' && b.details !== null && b.details.pickedUpAt === null

export const isPickedUp = (b: Borrow) => b.details === null || b.details.pickedUpAt !== null

// แสดงช่วงเวลายืมแบบสั้น — ถ้าปีเดียวกันไม่ต้องซ้ำปี
export function formatPeriod(b: Borrow) {
  if (!b.details) return null
  const start = dayjs(b.details.startAt)
  const end = dayjs(b.details.endAt)
  const sameYear = start.year() === end.year()
  return `${start.format(sameYear ? 'D MMM' : 'D MMM YYYY')} – ${end.format('D MMM YYYY')}`
}
