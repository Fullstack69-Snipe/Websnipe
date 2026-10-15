import dayjs, { type Dayjs } from 'dayjs'
import type { Booking } from '../types'

// ต้องคิดเหมือน overlapsSql ฝั่ง backend: รายการเก่าไม่มีช่วงเวลา และของที่เลยกำหนดแล้วยังไม่คืน
// ถือว่าจองไว้เรื่อย ๆ จนกว่าจะคืน (ไม่รู้ว่าจะได้ของคืนเมื่อไหร่)
const FOREVER = dayjs('9999-12-31')

const bookingEnd = (b: Booking) =>
  b.endAt && dayjs(b.endAt).isAfter(dayjs()) ? dayjs(b.endAt) : FOREVER

export const overlaps = (b: Booking, start: Dayjs, end: Dayjs) =>
  b.startAt === null || (dayjs(b.startAt).isBefore(end) && bookingEnd(b).isAfter(start))

/** จำนวนชิ้นที่ถูกจองทับช่วงนี้ */
export const bookedIn = (bookings: Booking[], start: Dayjs, end: Dayjs) =>
  bookings.filter((b) => overlaps(b, start, end)).length

export function formatBooking(b: Booking) {
  if (b.startAt === null || bookingEnd(b) === FOREVER) return 'ยืมอยู่ ยังไม่ได้คืน'
  const start = dayjs(b.startAt)
  const end = dayjs(b.endAt)
  return start.isSame(end, 'month')
    ? `${start.format('D')}–${end.format('D MMM')}`
    : `${start.format('D MMM')} – ${end.format('D MMM')}`
}
