import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  Building2,
  CalendarPlus,
  ClipboardList,
  Inbox,
  Package,
  Printer,
  QrCode,
  Tag,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/useAuth'
import { useFeedback } from '../lib/useFeedback'
import { ACTIVE, formatPeriod, isHolding, isPickedUp, needsPickup } from '../lib/borrow'
import type { Booking, Borrow, Equipment } from '../types'
import StatusBadge from '../components/StatusBadge'
import BorrowDialog from '../components/BorrowDialog'
import BorrowSteps from '../components/BorrowSteps'
import BookingCalendar from '../components/BookingCalendar'

// หน้าของอุปกรณ์ชิ้นเดียว — ปลายทางของ QR ที่ติดบนตัวของ
// สแกนแล้วทำต่อได้จากหน้านี้เลย ตามว่าใครสแกน:
//   ผู้ยืม   -> ขอยืม / ยกเลิก / ยืนยันรับของ / แจ้งคืน ของรายการตัวเอง
//   เจ้าหน้าที่ -> อนุมัติ / ปฏิเสธ / ส่งมอบ / รับคืน ของรายการที่ค้างอยู่กับชิ้นนี้
export default function EquipmentDetail() {
  const { id = '' } = useParams()
  const { user, role } = useAuth()
  const { toast, confirm, prompt } = useFeedback()
  const [item, setItem] = useState<Equipment | null>(null)
  const [mine, setMine] = useState<Borrow[]>([])
  const [requests, setRequests] = useState<Borrow[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [error, setError] = useState<string | null>(null)
  // false = ปิดหน้าต่างขอยืม, string = เปิดโดยเริ่มวันนั้น ('' = วันนี้)
  const [borrowing, setBorrowing] = useState<string | false>(false)
  const [acting, setActing] = useState<string | null>(null) // id ของรายการที่กำลังทำงานอยู่

  const isStaff = role === 'staff' || role === 'admin'

  const load = useCallback(async () => {
    try {
      const [eq, booked, my, all] = await Promise.all([
        api.getEquipment(id),
        api.equipmentBookings(id),
        api.listMyBorrows(),
        // staff เห็นเฉพาะคำขอของแผนกที่ดูแลอยู่แล้ว (backend กรองให้)
        isStaff ? api.listBorrows() : Promise.resolve([]),
      ])
      const open = (b: Borrow) => b.equipmentId === id && ACTIVE.includes(b.status)
      setItem(eq)
      setBookings(booked)
      setMine(my.filter(open))
      setRequests(all.filter(open))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลอุปกรณ์ไม่สำเร็จ')
    }
  }, [id, isStaff])

  useEffect(() => {
    void load()
  }, [load])

  // ทุกปุ่มทำเหมือนกัน: เรียก api -> แจ้งผล -> โหลดใหม่
  async function run(borrowId: string, fn: () => Promise<unknown>, successMsg: string) {
    setActing(borrowId)
    try {
      await fn()
      toast(successMsg)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setActing(null)
    }
  }

  async function confirmThen(
    b: Borrow,
    opts: { title: string; message: string; confirmLabel: string; danger?: boolean },
    fn: () => Promise<unknown>,
    successMsg: string,
  ) {
    if (await confirm(opts)) await run(b.id, fn, successMsg)
  }

  if (error) return <p className="error">{error}</p>
  if (!item) return <p aria-busy="true">กำลังโหลด…</p>

  const isAvailable = item.available > 0
  // เหมือนที่ backend ตรวจ — staff จัดการได้เฉพาะของในแผนกตัวเองหรือของที่ไม่สังกัดแผนก
  const canManage =
    role === 'admin' ||
    (role === 'staff' &&
      (item.departmentId === null || (user?.departmentIds ?? []).includes(item.departmentId)))

  const period = (b: Borrow) => formatPeriod(b) ?? `ถึง ${dayjs(b.dueDate).format('D MMM BBBB')}`

  return (
    <>
      <nav aria-label="breadcrumb" className="breadcrumb">
        <ul>
          <li>
            <Link to="/">หน้าแรก</Link>
          </li>
          <li>
            <Link to={item.departmentId ? `/equipment?department=${item.departmentId}` : '/equipment'}>
              {item.departmentName ?? 'รายการอุปกรณ์'}
            </Link>
          </li>
          <li>{item.name}</li>
        </ul>
      </nav>

      <article className="equipment-detail">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} />
        ) : (
          <div className="equipment-card__placeholder">ไม่มีรูป</div>
        )}

        <div className="equipment-detail__body">
          <header>
            <h1>{item.name}</h1>
            <StatusBadge status={isAvailable ? 'available' : 'borrowed'} />
          </header>

          {item.description && <p className="equipment-detail__desc">{item.description}</p>}

          <dl className="detail-facts">
            <div>
              <dt>
                <Tag aria-hidden="true" />
                หมวดหมู่
              </dt>
              <dd>{item.categoryName ?? 'ไม่ระบุ'}</dd>
            </div>
            <div>
              <dt>
                <Building2 aria-hidden="true" />
                แผนกที่ดูแล (รับ-คืนของ)
              </dt>
              <dd>{item.departmentName ?? 'ไม่สังกัดแผนก'}</dd>
            </div>
            <div>
              <dt>
                <Package aria-hidden="true" />
                คงเหลือตอนนี้
              </dt>
              <dd className={`stock ${isAvailable ? '' : 'stock--empty'}`}>
                <strong>{item.available}</strong> / {item.quantity} ชิ้น
              </dd>
            </div>
          </dl>

          {/* ของหมดตอนนี้ก็ยังจองช่วงอื่นได้ ระบบตรวจตามช่วงเวลาให้ */}
          {item.quantity > 0 && (
            <button type="button" className="detail-borrow" onClick={() => setBorrowing('')}>
              <CalendarPlus aria-hidden="true" />
              ขอยืม
            </button>
          )}
        </div>
      </article>

      {mine.length > 0 && (
        <article className="detail-panel">
          <header>
            <strong>
              <ClipboardList aria-hidden="true" />
              การยืมของคุณ
            </strong>
          </header>
          <div className="table-wrap">
            <table>
              <tbody>
                {mine.map((b) => (
                  <tr key={b.id}>
                    <td className="col-grow">
                      {period(b)}
                      <BorrowSteps borrow={b} />
                    </td>
                    <td className="col-nowrap">
                      <StatusBadge status={b.status} />
                      {needsPickup(b) && <small className="muted-line">รับของแล้วกดยืนยันได้เลย</small>}
                      {b.status === 'returning' && (
                        <small className="muted-line">รอเจ้าหน้าที่ตรวจรับ</small>
                      )}
                    </td>
                    <td className="col-actions">
                      <div className="actions">
                        {b.status === 'pending' && (
                          <button
                            type="button"
                            className="outline secondary"
                            aria-busy={acting === b.id}
                            onClick={() =>
                              confirmThen(
                                b,
                                {
                                  title: 'ยกเลิกคำขอยืม',
                                  message: 'ยกเลิกคำขอนี้?',
                                  confirmLabel: 'ยกเลิกคำขอ',
                                  danger: true,
                                },
                                () => api.cancelBorrow(b.id),
                                'ยกเลิกคำขอแล้ว',
                              )
                            }
                          >
                            ยกเลิกคำขอ
                          </button>
                        )}
                        {needsPickup(b) && (
                          <button
                            type="button"
                            aria-busy={acting === b.id}
                            onClick={() =>
                              confirmThen(
                                b,
                                {
                                  title: 'ยืนยันรับของ',
                                  message: `ได้รับ "${item.name}" จากเจ้าหน้าที่แล้วใช่ไหม?`,
                                  confirmLabel: 'รับของแล้ว',
                                },
                                () => api.pickupBorrow(b.id),
                                'บันทึกการรับของแล้ว',
                              )
                            }
                          >
                            รับของแล้ว
                          </button>
                        )}
                        {b.status === 'approved' && isPickedUp(b) && (
                          <button
                            type="button"
                            className="outline"
                            aria-busy={acting === b.id}
                            onClick={() =>
                              confirmThen(
                                b,
                                {
                                  title: 'แจ้งคืนอุปกรณ์',
                                  message: 'แจ้งคืนอุปกรณ์ชิ้นนี้? เจ้าหน้าที่จะตรวจรับและปิดรายการให้',
                                  confirmLabel: 'แจ้งคืน',
                                },
                                () => api.requestReturn(b.id),
                                'แจ้งคืนเรียบร้อย รอเจ้าหน้าที่ตรวจรับ',
                              )
                            }
                          >
                            แจ้งคืน
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {canManage && (
        <article className="detail-panel">
          <header>
            <strong>
              <Inbox aria-hidden="true" />
              รายการที่ต้องจัดการ ({requests.length})
            </strong>
          </header>
          {requests.length === 0 ? (
            <p className="muted">ไม่มีคำขอค้างอยู่กับอุปกรณ์ชิ้นนี้</p>
          ) : (
            <div className="table-wrap">
              <table>
                <tbody>
                  {requests.map((b) => (
                    <tr key={b.id}>
                      <td className="col-nowrap"><strong>{b.borrowerName}</strong></td>
                      <td className="col-grow">
                        {period(b)}
                        {b.purpose && <small className="muted-line">{b.purpose}</small>}
                      </td>
                      <td className="col-nowrap">
                        <StatusBadge status={b.status} />
                        {needsPickup(b) && <small className="muted-line">ยังไม่มารับของ</small>}
                      </td>
                      <td className="col-actions">
                        <div className="actions">
                          {b.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                aria-busy={acting === b.id}
                                onClick={() =>
                                  confirmThen(
                                    b,
                                    {
                                      title: 'อนุมัติคำขอ',
                                      message: `อนุมัติให้ ${b.borrowerName} ยืม "${item.name}"?`,
                                      confirmLabel: 'อนุมัติ',
                                    },
                                    () => api.approveBorrow(b.id),
                                    'อนุมัติคำขอแล้ว',
                                  )
                                }
                              >
                                อนุมัติ
                              </button>
                              <button
                                type="button"
                                className="outline secondary"
                                disabled={acting === b.id}
                                onClick={async () => {
                                  const reason = await prompt({
                                    title: 'ปฏิเสธคำขอ',
                                    message: `ปฏิเสธคำขอของ ${b.borrowerName}`,
                                    label: 'เหตุผล (ไม่บังคับ)',
                                    multiline: true,
                                    confirmLabel: 'ปฏิเสธ',
                                    danger: true,
                                  })
                                  if (reason === null) return
                                  await run(
                                    b.id,
                                    () => api.rejectBorrow(b.id, reason.trim() || undefined),
                                    'ปฏิเสธคำขอแล้ว',
                                  )
                                }}
                              >
                                ปฏิเสธ
                              </button>
                            </>
                          )}
                          {needsPickup(b) && (
                            <button
                              type="button"
                              aria-busy={acting === b.id}
                              onClick={() =>
                                confirmThen(
                                  b,
                                  {
                                    title: 'ส่งมอบอุปกรณ์',
                                    message: `ส่งมอบ "${item.name}" ให้ ${b.borrowerName}?`,
                                    confirmLabel: 'ส่งมอบ',
                                  },
                                  () => api.pickupBorrow(b.id),
                                  'บันทึกการส่งมอบแล้ว',
                                )
                              }
                            >
                              ส่งมอบ
                            </button>
                          )}
                          {isHolding(b) && isPickedUp(b) && (
                            <button
                              type="button"
                              className="outline"
                              disabled={acting === b.id}
                              onClick={async () => {
                                const note = await prompt({
                                  title: 'รับคืนอุปกรณ์',
                                  message: `ยืนยันรับคืน "${item.name}" จาก ${b.borrowerName}`,
                                  label: 'สภาพของตอนคืน (ไม่บังคับ)',
                                  placeholder: 'เช่น สภาพปกติ ครบถ้วน',
                                  multiline: true,
                                  confirmLabel: 'รับคืน',
                                })
                                if (note === null) return
                                await run(
                                  b.id,
                                  () => api.confirmReturn(b.id, note.trim() || undefined),
                                  'รับคืนอุปกรณ์เรียบร้อย',
                                )
                              }}
                            >
                              รับคืน
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}

      {/* อยู่ใต้กล่องรายการ — คนสแกน QR มาเพื่อกดรับ/คืนของเป็นหลัก */}
      {item.quantity > 0 && (
        <BookingCalendar bookings={bookings} quantity={item.quantity} onPickDay={setBorrowing} />
      )}

      {isStaff && (
        <article className="qr-card">
          <img src={api.qrImageUrl(item.id)} alt={`QR ของ ${item.name}`} width={160} height={160} />
          <div>
            <strong>
              <QrCode aria-hidden="true" />
              {item.name}
            </strong>
            <p className="muted">พิมพ์ติดตัวอุปกรณ์ — สแกนด้วยกล้องมือถือแล้วเปิดหน้านี้ได้ทันที</p>
            <button type="button" className="outline" onClick={() => window.print()}>
              <Printer aria-hidden="true" />
              พิมพ์ QR
            </button>
          </div>
        </article>
      )}

      {borrowing !== false && (
        <BorrowDialog
          items={[item]}
          initialStart={borrowing || undefined}
          onClose={() => setBorrowing(false)}
          onDone={(failed) => {
            if (failed.length === 0) setBorrowing(false)
            void load()
          }}
        />
      )}
    </>
  )
}
