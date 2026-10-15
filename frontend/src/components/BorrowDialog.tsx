import { useEffect, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { api } from '../lib/api'
import { useFeedback } from '../lib/useFeedback'
import type { Booking, Equipment } from '../types'

// ต้องคิดเหมือน overlapsSql ฝั่ง backend: รายการเก่าไม่มีช่วงเวลา และของที่เลยกำหนดแล้วยังไม่คืน
// ถือว่าจองไว้เรื่อย ๆ จนกว่าจะคืน (ไม่รู้ว่าจะได้ของคืนเมื่อไหร่)
const FOREVER = dayjs('9999-12-31')
const bookingEnd = (b: Booking) =>
  b.endAt && dayjs(b.endAt).isAfter(dayjs()) ? dayjs(b.endAt) : FOREVER
const overlaps = (b: Booking, start: Dayjs, end: Dayjs) =>
  b.startAt === null || (dayjs(b.startAt).isBefore(end) && bookingEnd(b).isAfter(start))

function formatBooking(b: Booking) {
  if (b.startAt === null || bookingEnd(b) === FOREVER) return 'ยืมอยู่ ยังไม่ได้คืน'
  const start = dayjs(b.startAt)
  const end = dayjs(b.endAt)
  return start.isSame(end, 'month')
    ? `${start.format('D')}–${end.format('D MMM')}`
    : `${start.format('D MMM')} – ${end.format('D MMM')}`
}

type Props = {
  items: Equipment[]
  onClose: () => void
  // ส่งชิ้นที่ยืมไม่สำเร็จกลับไป — ว่าง = สำเร็จครบทุกชิ้น
  onDone: (failed: Equipment[]) => void
  // ไม่ส่งมา = เอาชิ้นออกจากรายการไม่ได้ (เช่น ยืมจากหน้าอุปกรณ์ชิ้นเดียว)
  onRemove?: (item: Equipment) => void
}

// dialog ขอยืม ใช้ร่วมกันระหว่างหน้ารายการ (เลือกหลายชิ้น) กับหน้าอุปกรณ์ชิ้นเดียว
export default function BorrowDialog({ items, onClose, onDone, onRemove }: Props) {
  const { toast } = useFeedback()
  // ช่วงเวลายืม — เก็บเป็น 'YYYY-MM-DD' ให้ <input type="date"> ใช้ได้ตรง ๆ
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [dueDate, setDueDate] = useState(dayjs().add(7, 'day').format('YYYY-MM-DD'))
  const [submitting, setSubmitting] = useState(false)
  // เหตุผลที่ขอยืม — ไม่บังคับ แต่ช่วยให้เจ้าหน้าที่ตัดสินใจง่ายขึ้น
  const [purpose, setPurpose] = useState('')
  // ช่วงที่ถูกจองแล้วของแต่ละชิ้น — โหลดไม่ได้ก็ยังยืมได้ backend ตรวจให้อีกชั้น
  const [bookings, setBookings] = useState<Record<string, Booking[]>>({})

  // ใช้ id เป็น dependency เพราะ array items ถูกสร้างใหม่ทุก render
  const ids = items.map((i) => i.id).join(',')
  useEffect(() => {
    if (!ids) return
    Promise.all(
      ids.split(',').map((id) => api.equipmentBookings(id).then((b) => [id, b] as const)),
    )
      .then((pairs) => setBookings(Object.fromEntries(pairs)))
      .catch(() => {})
  }, [ids])

  const rangeStart = dayjs(startDate).startOf('day')
  const rangeEnd = dayjs(dueDate).endOf('day')
  // จำนวนที่ยังว่างในช่วงที่เลือก (undefined = ยังโหลดการจองไม่เสร็จ)
  const freeIn = (item: Equipment) => {
    const list = bookings[item.id]
    if (!list) return undefined
    return item.quantity - list.filter((b) => overlaps(b, rangeStart, rangeEnd)).length
  }
  const fullItems = items.filter((i) => (freeIn(i) ?? 1) <= 0)

  async function handleBorrow() {
    if (items.length === 0 || fullItems.length > 0) return
    if (!dayjs(dueDate).isAfter(dayjs(startDate), 'day')) {
      return toast('วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น', 'error')
    }

    // backend ต้องการ ISO พร้อม timezone — ยืมทั้งวันตั้งแต่ 00:00 ถึง 23:59
    const startAt = dayjs(startDate).startOf('day').format()
    const endAt = dayjs(dueDate).endOf('day').format()
    const note = purpose.trim() || undefined

    setSubmitting(true)
    try {
      // backend ยังไม่มี endpoint ยืมหลายชิ้นในครั้งเดียว จึงยิงทีละชิ้น
      // ใช้ allSettled เพราะถ้าชิ้นใดชิ้นหนึ่งพลาด (เช่น มีคนตัดหน้า) ชิ้นที่เหลือควรผ่านไปได้
      const results = await Promise.allSettled(
        items.map((item) => api.requestBorrow(item.id, startAt, endAt, note)),
      )

      const failed = items.filter((_, i) => results[i].status === 'rejected')
      const okCount = items.length - failed.length

      if (okCount > 0) toast(`ส่งคำขอยืม ${okCount} ชิ้นเรียบร้อย รอเจ้าหน้าที่อนุมัติ`)
      if (failed.length > 0) {
        // ยืมชิ้นเดียวแล้วพลาด บอกเหตุผลจาก backend ตรง ๆ (เช่น ช่วงนี้ถูกจองเต็มแล้ว)
        const reason = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
        toast(
          items.length === 1 && reason.reason instanceof Error
            ? reason.reason.message
            : `ขอยืมไม่สำเร็จ ${failed.length} ชิ้น: ${failed.map((f) => f.name).join(', ')}`,
          'error',
        )
      }

      onDone(failed)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <dialog open>
      <article>
        <header>
          <strong>
            ขอยืม {items.length > 1 ? `${items.length} ชิ้น` : items[0]?.name}
          </strong>
        </header>

        {items.length > 1 && (
          <ul className="pick-list">
            {items.map((p) => (
              <li key={p.id}>
                <span>
                  {p.name}
                  {fullItems.includes(p) && <small className="availability availability--full"> เต็มช่วงนี้</small>}
                </span>
                {onRemove && (
                  <button
                    type="button"
                    className="outline secondary"
                    aria-label={`เอา ${p.name} ออก`}
                    onClick={() => onRemove(p)}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="date-range">
          <label>
            วันที่เริ่มยืม
            <input
              type="date"
              value={startDate}
              min={dayjs().format('YYYY-MM-DD')}
              onChange={(e) => {
                setStartDate(e.target.value)
                // ถ้าวันเริ่มเลยวันคืนไปแล้ว ดันวันคืนตามให้อัตโนมัติ
                if (!dayjs(dueDate).isAfter(dayjs(e.target.value), 'day')) {
                  setDueDate(dayjs(e.target.value).add(7, 'day').format('YYYY-MM-DD'))
                }
              }}
            />
          </label>
          <label>
            วันที่ครบกำหนดคืน
            <input
              type="date"
              value={dueDate}
              min={dayjs(startDate).add(1, 'day').format('YYYY-MM-DD')}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>

        <p className="range-summary">
          ยืมทั้งหมด <strong>{dayjs(dueDate).diff(dayjs(startDate), 'day')}</strong> วัน
        </p>

        {/* ชิ้นเดียว: บอกช่วงที่ถูกจองแล้ว + ช่วงที่เลือกว่างไหม ก่อนกดส่ง */}
        {items.length === 1 && bookings[items[0].id] && (
          <div className="booking-info">
            {freeIn(items[0])! > 0 ? (
              <p className="availability availability--ok">
                ✓ ช่วงที่เลือกว่าง เหลือ {freeIn(items[0])} / {items[0].quantity} ชิ้น
              </p>
            ) : (
              <p className="availability availability--full">
                ✕ ช่วงที่เลือกถูกจองเต็มแล้ว ลองเลือกวันอื่น
              </p>
            )}
            {bookings[items[0].id].length > 0 && (
              <p className="muted">
                ถูกจองแล้ว: {bookings[items[0].id].map(formatBooking).join(', ')}
              </p>
            )}
          </div>
        )}
        {items.length > 1 && fullItems.length > 0 && (
          <p className="availability availability--full">
            มี {fullItems.length} ชิ้นถูกจองเต็มในช่วงนี้ — เอาออกหรือเลือกวันอื่น
          </p>
        )}

        <label>
          เหตุผลที่ขอยืม (ไม่บังคับ)
          <textarea
            rows={2}
            value={purpose}
            placeholder="เช่น ใช้ถ่ายงานสัมมนา"
            onChange={(e) => setPurpose(e.target.value)}
          />
        </label>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleBorrow}
            aria-busy={submitting}
            disabled={items.length === 0 || fullItems.length > 0}
          >
            ยืนยันขอยืม{items.length > 1 ? ` ${items.length} ชิ้น` : ''}
          </button>
        </footer>
      </article>
    </dialog>
  )
}
