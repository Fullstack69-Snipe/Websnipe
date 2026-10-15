import { isPickedUp } from '../lib/borrow'
import type { Borrow } from '../types'

const STEPS = ['ขอยืม', 'อนุมัติ', 'รับของ', 'คืนของ']

// แถบบอกว่ารายการอยู่ขั้นไหนของ ขอยืม -> อนุมัติ -> รับของ -> คืนของ
// แสดงเฉพาะรายการที่ยังไม่จบ — คืนแล้ว / ถูกปฏิเสธ / ยกเลิก ดูจากป้ายสถานะพอ
export default function BorrowSteps({ borrow }: { borrow: Borrow }) {
  // จำนวนขั้นที่ผ่านไปแล้ว ขั้นถัดไปคือขั้นที่กำลังรอ
  const done =
    borrow.status === 'pending'
      ? 1
      : borrow.status === 'approved'
        ? isPickedUp(borrow) ? 3 : 2
        : borrow.status === 'returning'
          ? 3
          : null
  if (done === null) return null

  return (
    <ol className="borrow-steps" aria-label={`ขั้นตอนตอนนี้: รอ${STEPS[done]}`}>
      {STEPS.map((label, i) => (
        <li key={label} className={i < done ? 'is-done' : i === done ? 'is-current' : undefined}>
          {label}
        </li>
      ))}
    </ol>
  )
}
