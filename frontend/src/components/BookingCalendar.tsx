import { useState } from 'react'
import dayjs from 'dayjs'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { bookedIn } from '../lib/booking'
import type { Booking } from '../types'

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const MONTHS_AHEAD = 6

type Props = {
  bookings: Booking[]
  quantity: number
  onPickDay: (date: string) => void
}

// ปฏิทินว่าง/ไม่ว่างรายวันของอุปกรณ์ชิ้นเดียว — คลิกวันที่ยังว่างเพื่อเริ่มขอยืมจากวันนั้น
export default function BookingCalendar({ bookings, quantity, onPickDay }: Props) {
  const today = dayjs().startOf('day')
  const [month, setMonth] = useState(() => today.startOf('month'))

  const first = month.startOf('month')
  const days = Array.from({ length: month.daysInMonth() }, (_, i) => first.add(i, 'day'))

  function stateOf(day: dayjs.Dayjs) {
    if (day.isBefore(today)) return { cls: 'past', left: 0 }
    const left = quantity - bookedIn(bookings, day, day.add(1, 'day'))
    return { cls: left <= 0 ? 'full' : left < quantity ? 'partial' : 'free', left }
  }

  return (
    <article className="detail-panel booking-cal">
      <header>
        <strong>
          <CalendarDays aria-hidden="true" />
          ปฏิทินการจอง
        </strong>
        <div className="booking-cal__nav">
          <button
            type="button"
            className="outline secondary"
            aria-label="เดือนก่อน"
            disabled={!month.isAfter(today, 'month')}
            onClick={() => setMonth(month.subtract(1, 'month'))}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <span aria-live="polite">{month.format('MMMM BBBB')}</span>
          <button
            type="button"
            className="outline secondary"
            aria-label="เดือนถัดไป"
            disabled={month.diff(today.startOf('month'), 'month') >= MONTHS_AHEAD}
            onClick={() => setMonth(month.add(1, 'month'))}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="booking-cal__grid" role="grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="booking-cal__wd" role="columnheader">
            {w}
          </span>
        ))}
        {days.map((d) => {
          const { cls, left } = stateOf(d)
          const pickable = cls === 'free' || cls === 'partial'
          return (
            <button
              key={d.date()}
              type="button"
              // ไม่ใช้ aria-current เพราะ Pico ทาสีปุ่มแบบนั้นทับสีสถานะ
              className={`booking-cal__day booking-cal__day--${cls} ${d.isSame(today, 'day') ? 'is-today' : ''}`}
              // วันแรกของเดือนวางให้ตรงคอลัมน์วันในสัปดาห์
              style={d.date() === 1 ? { gridColumnStart: d.day() + 1 } : undefined}
              disabled={!pickable}
              title={cls === 'past' ? undefined : left > 0 ? `ว่าง ${left}/${quantity} ชิ้น` : 'ถูกจองเต็ม'}
              onClick={() => onPickDay(d.format('YYYY-MM-DD'))}
            >
              {d.date()}
            </button>
          )
        })}
      </div>

      <ul className="booking-cal__legend">
        <li>
          <i className="booking-cal__day--free" /> ว่าง
        </li>
        <li>
          <i className="booking-cal__day--partial" /> เหลือบางชิ้น
        </li>
        <li>
          <i className="booking-cal__day--full" /> ถูกจองเต็ม
        </li>
        <li className="muted">คลิกวันที่ว่างเพื่อขอยืมเริ่มวันนั้น</li>
      </ul>
    </article>
  )
}
