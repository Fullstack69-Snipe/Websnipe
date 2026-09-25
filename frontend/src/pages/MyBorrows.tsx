import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { api } from '../lib/api'
import { useFeedback } from '../lib/useFeedback'
import type { Borrow, BorrowStatus } from '../types'
import StatusBadge from '../components/StatusBadge'

// สถานะที่ถือว่า "ยังไม่จบ"
const ACTIVE: BorrowStatus[] = ['pending', 'approved', 'returning']

export default function MyBorrows() {
  const { toast, confirm } = useFeedback()
  const [borrows, setBorrows] = useState<Borrow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setBorrows(await api.listMyBorrows())
    } catch {
      setError('โหลดรายการไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleReturn(id: string) {
    const ok = await confirm({
      title: 'แจ้งคืนอุปกรณ์',
      message: 'แจ้งคืนอุปกรณ์ชิ้นนี้? เจ้าหน้าที่จะตรวจรับและปิดรายการให้',
      confirmLabel: 'แจ้งคืน',
    })
    if (!ok) return
    try {
      await api.requestReturn(id)
      toast('แจ้งคืนเรียบร้อย รอเจ้าหน้าที่ตรวจรับ')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error')
    }
  }

  async function handleCancel(id: string) {
    const ok = await confirm({
      title: 'ยกเลิกคำขอยืม',
      message: 'ยกเลิกคำขอนี้? อุปกรณ์จะถูกปล่อยให้คนอื่นยืมได้ทันที',
      confirmLabel: 'ยกเลิกคำขอ',
      cancelLabel: 'ไม่ใช่ตอนนี้',
      danger: true,
    })
    if (!ok) return
    try {
      await api.cancelBorrow(id)
      toast('ยกเลิกคำขอแล้ว')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error')
    }
  }

  const active = borrows.filter((b) => ACTIVE.includes(b.status))
  const history = borrows.filter((b) => !ACTIVE.includes(b.status))

  if (loading) return <p aria-busy="true">กำลังโหลด…</p>
  if (error) return <p className="error">{error}</p>

  return (
    <>
      <hgroup>
        <h1>การยืมของฉัน</h1>
        <p>รายการที่กำลังยืมอยู่และประวัติทั้งหมด</p>
      </hgroup>

      <h2>กำลังดำเนินการ ({active.length})</h2>
      {active.length === 0 ? (
        <article className="empty"><p>ยังไม่มีรายการยืม</p></article>
      ) : (
        <BorrowTable rows={active} onReturn={handleReturn} onCancel={handleCancel} />
      )}

      <h2>ประวัติ ({history.length})</h2>
      {history.length === 0 ? (
        <article className="empty"><p>ยังไม่มีประวัติ</p></article>
      ) : (
        <BorrowTable rows={history} />
      )}
    </>
  )
}

// ---------- ตารางย่อย ใช้ซ้ำ 2 ที่ ----------
type TableProps = {
  rows: Borrow[]
  onReturn?: (id: string) => void
  onCancel?: (id: string) => void
}

function BorrowTable({ rows, onReturn, onCancel }: TableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>อุปกรณ์</th>
            <th>วันที่ขอ</th>
            <th>กำหนดคืน</th>
            <th>สถานะ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const overdue = b.status === 'approved' && dayjs().isAfter(dayjs(b.dueDate), 'day')
            return (
              <tr key={b.id}>
                <td>
                  {b.equipmentName}
                  {b.rejectReason && (
                    <small className="muted-line">เหตุผลที่ปฏิเสธ: {b.rejectReason}</small>
                  )}
                  {b.returnNote && (
                    <small className="muted-line">สภาพตอนคืน: {b.returnNote}</small>
                  )}
                </td>
                <td>{dayjs(b.createdAt).format('D MMM YYYY')}</td>
                <td className={overdue ? 'overdue' : undefined}>
                  {dayjs(b.dueDate).format('D MMM YYYY')}
                  {overdue && ' — เกินกำหนด'}
                </td>
                <td><StatusBadge status={b.status} /></td>
                <td>
                  <div className="actions">
                    {b.status === 'pending' && onCancel && (
                      <button
                        type="button"
                        className="outline secondary"
                        onClick={() => onCancel(b.id)}
                      >
                        ยกเลิกคำขอ
                      </button>
                    )}
                    {b.status === 'approved' && onReturn && (
                      <button type="button" className="outline" onClick={() => onReturn(b.id)}>
                        แจ้งคืน
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}