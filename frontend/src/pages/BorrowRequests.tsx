import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { api } from '../lib/api'
import { useFeedback } from '../lib/useFeedback'
import type { Borrow } from '../types'
import StatusBadge from '../components/StatusBadge'

type Tab = 'pending' | 'active' | 'done' | 'all'

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'รออนุมัติ' },
  { key: 'active', label: 'กำลังยืม' },
  { key: 'done', label: 'จบแล้ว' },
  { key: 'all', label: 'ทั้งหมด' },
]

const isHolding = (b: Borrow) => b.status === 'approved' || b.status === 'returning'
const isOverdue = (b: Borrow) => isHolding(b) && dayjs().isAfter(dayjs(b.dueDate), 'day')

export default function BorrowRequests() {
  const { toast, confirm, prompt } = useFeedback()
  const [borrows, setBorrows] = useState<Borrow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('pending')
  const [acting, setActing] = useState<string | null>(null) // id ของแถวที่กำลังทำงานอยู่

  async function load() {
    try {
      setBorrows(await api.listBorrows())
    } catch {
      setError('โหลดรายการไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // รวม logic ที่ซ้ำกันของทั้ง 3 ปุ่มไว้ที่เดียว
  async function act(
    id: string,
    fn: (id: string) => Promise<unknown>,
    options?: { confirmMsg: string; successMsg: string; danger?: boolean },
  ) {
    if (options && !(await confirm({ message: options.confirmMsg, danger: options.danger }))) return
    setActing(id)
    try {
      await fn(id)
      if (options) toast(options.successMsg)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setActing(null)
    }
  }

  // ---------- สรุปตัวเลข (ภาพรวมสำหรับ admin) ----------
  const stats = {
    pending: borrows.filter((b) => b.status === 'pending').length,
    active: borrows.filter(isHolding).length,
    returning: borrows.filter((b) => b.status === 'returning').length,
    overdue: borrows.filter(isOverdue).length,
  }

  const visible = borrows.filter((b) => {
    if (tab === 'pending') return b.status === 'pending'
    if (tab === 'active') return isHolding(b)
    if (tab === 'done')
      return b.status === 'returned' || b.status === 'rejected' || b.status === 'cancelled'
    return true
  })

  if (loading) return <p aria-busy="true">กำลังโหลด…</p>
  if (error) return <p className="error">{error}</p>

  return (
    <>
      <hgroup>
        <h1>คำขอยืม</h1>
        <p>อนุมัติ ปฏิเสธ และรับคืนอุปกรณ์</p>
      </hgroup>

      <div className="stats">
        <Stat label="รออนุมัติ" value={stats.pending} tone="pending" />
        <Stat label="กำลังยืม" value={stats.active} />
        <Stat label="แจ้งคืนแล้ว" value={stats.returning} tone="warn" />
        <Stat label="เกินกำหนด" value={stats.overdue} tone="danger" />
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? '' : 'outline'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <article className="empty">
          <p>ไม่มีรายการในหมวดนี้</p>
        </article>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ผู้ยืม</th>
                <th>อุปกรณ์</th>
                <th>วันที่ขอ</th>
                <th>กำหนดคืน</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((b) => {
                const overdue = isOverdue(b)
                const busy = acting === b.id
                return (
                  <tr key={b.id}>
                    <td>{b.borrowerName}</td>
                    <td>
                      {b.equipmentName}
                      {b.purpose && <small className="muted-line">เพื่อ: {b.purpose}</small>}
                      {b.approverName && b.status !== 'rejected' && (
                        <small className="muted-line">อนุมัติโดย: {b.approverName}</small>
                      )}
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
                        {b.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              aria-busy={busy}
                              onClick={() =>
                                act(b.id, api.approveBorrow, {
                                  confirmMsg: `อนุมัติให้ ${b.borrowerName} ยืม "${b.equipmentName}"?`,
                                  successMsg: 'อนุมัติคำขอแล้ว',
                                })
                              }
                            >
                              อนุมัติ
                            </button>
                            <button
                              type="button"
                              className="outline secondary"
                              disabled={busy}
                              onClick={async () => {
                                // เหตุผลไม่บังคับ กดยืนยันทั้งที่ว่างก็ปฏิเสธได้
                                const reason = await prompt({
                                  title: 'ปฏิเสธคำขอ',
                                  message: `ปฏิเสธคำขอของ ${b.borrowerName}`,
                                  label: 'เหตุผล (ไม่บังคับ)',
                                  placeholder: 'เช่น อุปกรณ์ต้องใช้งานในวันนั้น',
                                  multiline: true,
                                  confirmLabel: 'ปฏิเสธ',
                                  danger: true,
                                })
                                if (reason === null) return
                                await act(b.id, (id) =>
                                  api.rejectBorrow(id, reason.trim() || undefined),
                                )
                                toast('ปฏิเสธคำขอแล้ว')
                              }}
                            >
                              ปฏิเสธ
                            </button>
                          </>
                        )}
                        {isHolding(b) && (
                          <button
                            type="button"
                            className="outline"
                            aria-busy={busy}
                            onClick={async () => {
                              const note = await prompt({
                                title: 'รับคืนอุปกรณ์',
                                message: `ยืนยันรับคืน "${b.equipmentName}" จาก ${b.borrowerName}`,
                                label: 'สภาพของตอนคืน (ไม่บังคับ)',
                                placeholder: 'เช่น สภาพปกติ ครบถ้วน',
                                multiline: true,
                                confirmLabel: 'รับคืน',
                              })
                              if (note === null) return
                              await act(b.id, (id) =>
                                api.confirmReturn(id, note.trim() || undefined),
                              )
                              toast('รับคืนอุปกรณ์เรียบร้อย')
                            }}
                          >
                            รับคืน
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
      )}
    </>
  )
}

// ---------- การ์ดตัวเลขสรุป ----------
type StatProps = {
  label: string
  value: number
  tone?: 'pending' | 'warn' | 'danger'
}

function Stat({ label, value, tone }: StatProps) {
  return (
    <article className={`stat ${tone ? `stat--${tone}` : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  )
}
