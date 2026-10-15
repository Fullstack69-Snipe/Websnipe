import dayjs, { type Dayjs } from 'dayjs'
import { isHolding } from './borrow'
import { STATUS_LABEL } from './labels'
import type { Borrow } from '../types'

// ตัวเลขในหน้ารายงาน — คิดจากรายการยืมที่โหลดมาทั้งหมด
// shortcut: รวมตัวเลขในเบราว์เซอร์จาก listBorrows() — ถ้ารายการยืมเป็นหมื่นค่อยย้ายไปทำ endpoint สรุปฝั่ง backend

// กำหนดคืน: รายการเก่าที่ไม่มีช่วงเวลา ใช้สิ้นวัน dueDate
export const deadline = (b: Borrow) =>
  b.details ? dayjs(b.details.endAt) : dayjs(b.dueDate).endOf('day')

export const isOverdueNow = (b: Borrow, now = dayjs()) => isHolding(b) && now.isAfter(deadline(b))

export const isLateReturn = (b: Borrow) =>
  b.status === 'returned' && b.returnedAt !== null && dayjs(b.returnedAt).isAfter(deadline(b))

// ได้ยืมจริง (ไม่นับที่รออนุมัติ / ถูกปฏิเสธ / ยกเลิก)
const wasLent = (b: Borrow) => isHolding(b) || b.status === 'returned'

/** เดือนแรกของช่วงรายงาน — months = null คือทั้งหมด (นับจากรายการแรกสุด) */
export function periodStart(borrows: Borrow[], months: number | null): Dayjs {
  const thisMonth = dayjs().startOf('month')
  if (months !== null) return thisMonth.subtract(months - 1, 'month')
  const first = borrows.reduce((min, b) => (b.createdAt < min ? b.createdAt : min), thisMonth.toISOString())
  return dayjs(first).startOf('month')
}

export function buildReport(all: Borrow[], from: Dayjs) {
  const now = dayjs()
  const inPeriod = all.filter((b) => !dayjs(b.createdAt).isBefore(from))
  const returned = all.filter((b) => b.status === 'returned' && !dayjs(b.returnedAt).isBefore(from))

  const months: { month: Dayjs; count: number }[] = []
  for (let m = from; !m.isAfter(now, 'month'); m = m.add(1, 'month')) months.push({ month: m, count: 0 })
  for (const b of inPeriod) {
    const slot = months.find((x) => x.month.isSame(b.createdAt, 'month'))
    if (slot) slot.count++
  }

  const byEquipment = new Map<string, { id: string; name: string; count: number }>()
  for (const b of inPeriod.filter(wasLent)) {
    const row = byEquipment.get(b.equipmentId) ?? { id: b.equipmentId, name: b.equipmentName, count: 0 }
    row.count++
    byEquipment.set(b.equipmentId, row)
  }

  const byBorrower = new Map<string, { id: string; name: string; late: number; overdue: number }>()
  for (const b of all) {
    const late = isLateReturn(b) && !dayjs(b.returnedAt).isBefore(from)
    const overdue = isOverdueNow(b, now)
    if (!late && !overdue) continue
    const row = byBorrower.get(b.borrowerId) ?? { id: b.borrowerId, name: b.borrowerName, late: 0, overdue: 0 }
    if (late) row.late++
    if (overdue) row.overdue++
    byBorrower.set(b.borrowerId, row)
  }

  return {
    inPeriod,
    requests: inPeriod.length,
    holdingNow: all.filter(isHolding).length,
    overdueNow: all.filter((b) => isOverdueNow(b, now)).length,
    returnedCount: returned.length,
    lateCount: returned.filter(isLateReturn).length,
    months,
    topEquipment: [...byEquipment.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    lateBorrowers: [...byBorrower.values()].sort((a, b) => b.overdue - a.overdue || b.late - a.late),
  }
}

// ---------- CSV (เปิดใน Excel ได้) ----------

const cell = (v: string | number | null) => {
  const s = v === null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const toCsv = (rows: (string | number | null)[][]) =>
  rows.map((r) => r.map(cell).join(',')).join('\r\n')

const when = (iso: string | null) => (iso ? dayjs(iso).format('YYYY-MM-DD HH:mm') : null)

export function borrowsCsv(borrows: Borrow[]) {
  return toCsv([
    ['รหัส', 'อุปกรณ์', 'ผู้ยืม', 'สถานะ', 'วันที่ขอ', 'เริ่ม', 'กำหนดคืน', 'คืนเมื่อ', 'คืนช้า', 'ผู้อนุมัติ', 'เหตุผลที่ยืม', 'หมายเหตุตอนคืน'],
    ...borrows.map((b) => [
      b.id,
      b.equipmentName,
      b.borrowerName,
      STATUS_LABEL[b.status],
      when(b.createdAt),
      when(b.details?.startAt ?? null),
      deadline(b).format('YYYY-MM-DD HH:mm'),
      when(b.returnedAt),
      isLateReturn(b) || isOverdueNow(b) ? 'ใช่' : '',
      b.approverName,
      b.purpose,
      b.returnNote,
    ]),
  ])
}

/** ดาวน์โหลดเป็นไฟล์ — ใส่ BOM ไม่งั้น Excel อ่านภาษาไทยเพี้ยน */
export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
