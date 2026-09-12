import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { mockApi } from '../lib/mockApi'
import type { Borrow, BorrowStatus } from '../types'
import StatusBadge from '../components/StatusBadge'

// สถานะที่ถือว่า "ยังไม่จบ"
const ACTIVE: BorrowStatus[] = ['pending', 'approved', 'returning']

export default function MyBorrows() {
  const [borrows, setBorrows] = useState<Borrow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setBorrows(await mockApi.listMyBorrows())
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
    if (!confirm('แจ้งคืนอุปกรณ์ชิ้นนี้? เจ้าหน้าที่จะตรวจรับและปิดรายการให้')) return
    try {
      await mockApi.requestReturn(id)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
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
        <BorrowTable rows={active} onReturn={handleReturn} />
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
}

function BorrowTable({ rows, onReturn }: TableProps) {
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
                <td>{b.equipmentName}</td>
                <td>{dayjs(b.createdAt).format('D MMM YYYY')}</td>
                <td className={overdue ? 'overdue' : undefined}>
                  {dayjs(b.dueDate).format('D MMM YYYY')}
                  {overdue && ' — เกินกำหนด'}
                </td>
                <td><StatusBadge status={b.status} /></td>
                <td>
                  {b.status === 'approved' && onReturn && (
                    <button type="button" className="outline" onClick={() => onReturn(b.id)}>
                      แจ้งคืน
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}