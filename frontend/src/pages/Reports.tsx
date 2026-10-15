import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import dayjs from 'dayjs'
import { ChartColumn, Download } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/useAuth'
import { borrowsCsv, buildReport, downloadCsv, periodStart } from '../lib/report'
import type { Borrow } from '../types'

const PERIODS = [
  { value: '3', label: '3 เดือนล่าสุด' },
  { value: '6', label: '6 เดือนล่าสุด' },
  { value: '12', label: '12 เดือนล่าสุด' },
  { value: 'all', label: 'ทั้งหมด' },
]

// แกน y ปัดเป็นเลขกลม ๆ (1, 2, 5 × 10^n) ให้เส้นกริดอ่านง่าย
function niceMax(n: number) {
  if (n <= 4) return 4
  const p = 10 ** Math.floor(Math.log10(n))
  return ([1, 2, 5, 10].find((m) => m * p >= n) ?? 10) * p
}

// รายงานการยืม — staff เห็นเฉพาะแผนกที่ดูแล เพราะ listBorrows() กรองตามสิทธิ์มาแล้ว
export default function Reports() {
  const { role } = useAuth()
  const [borrows, setBorrows] = useState<Borrow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('12')

  useEffect(() => {
    api
      .listBorrows()
      .then(setBorrows)
      .catch(() => setError('โหลดข้อมูลรายงานไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [])

  const from = useMemo(
    () => periodStart(borrows, period === 'all' ? null : Number(period)),
    [borrows, period],
  )
  const r = useMemo(() => buildReport(borrows, from), [borrows, from])

  if (loading) return <p aria-busy="true">กำลังโหลด…</p>
  if (error) return <p className="error">{error}</p>

  const max = niceMax(Math.max(0, ...r.months.map((m) => m.count)))
  const peak = r.months.reduce((a, b) => (b.count > a.count ? b : a), r.months[0])
  const topMax = r.topEquipment[0]?.count ?? 1
  const latePct = r.returnedCount ? Math.round((r.lateCount / r.returnedCount) * 100) : 0
  const monthLabel = (m: dayjs.Dayjs, i: number) =>
    i === 0 || m.month() === 0 ? m.format('MMM BB') : m.format('MMM')

  return (
    <>
      <hgroup>
        <h1>รายงาน</h1>
        <p>
          สรุปการยืม-คืนตั้งแต่ {from.format('D MMM BBBB')}
          {role === 'staff' && ' — เฉพาะแผนกที่คุณดูแล'}
        </p>
      </hgroup>

      <div className="toolbar">
        <select aria-label="ช่วงเวลา" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="muted">{r.requests} รายการในช่วงนี้</p>
        <button
          type="button"
          className="outline"
          disabled={r.requests === 0}
          onClick={() => downloadCsv(`borrows-${dayjs().format('YYYY-MM-DD')}.csv`, borrowsCsv(r.inPeriod))}
        >
          <Download aria-hidden="true" />
          ส่งออก CSV (Excel)
        </button>
      </div>

      <div className="stats">
        <article className="stat">
          <strong>{r.requests}</strong>
          <span>คำขอยืมในช่วงนี้</span>
        </article>
        <article className="stat">
          <strong>{r.holdingNow}</strong>
          <span>กำลังยืมอยู่ตอนนี้</span>
        </article>
        <article className="stat stat--danger">
          <strong>{r.overdueNow}</strong>
          <span>เกินกำหนดตอนนี้</span>
        </article>
        <article className="stat stat--warn">
          <strong>{latePct}%</strong>
          <span>
            คืนช้า {r.lateCount} จาก {r.returnedCount} ครั้ง
          </span>
        </article>
      </div>

      {r.requests === 0 ? (
        <article className="empty">
          <ChartColumn aria-hidden="true" />
          <p>ยังไม่มีการยืมในช่วงนี้</p>
        </article>
      ) : (
        <div className="report-grid">
          <figure className="chart report-grid__wide">
            <figcaption>คำขอยืมรายเดือน</figcaption>
            <div className="cols" style={{ '--cols': r.months.length } as CSSProperties}>
              {[max, max / 2, 0].map((t) => (
                <span key={t} className="cols__grid" style={{ bottom: `${(t / max) * 100}%` }}>
                  {t}
                </span>
              ))}
              {r.months.map((m, i) => (
                <div key={m.month.format('YYYY-MM')} className="cols__slot" tabIndex={0}>
                  <div className="cols__bar" style={{ height: `${(m.count / max) * 100}%` }}>
                    {m === peak && m.count > 0 && <span className="cols__cap">{m.count}</span>}
                  </div>
                  <span className="cols__tip" role="tooltip">
                    {m.month.format('MMMM BBBB')}: <strong>{m.count}</strong> คำขอ
                  </span>
                  <span className="cols__x">{monthLabel(m.month, i)}</span>
                </div>
              ))}
            </div>
            <details>
              <summary>ดูเป็นตาราง</summary>
              <table>
                <tbody>
                  {r.months.map((m) => (
                    <tr key={m.month.format('YYYY-MM')}>
                      <td>{m.month.format('MMMM BBBB')}</td>
                      <td className="col-num">{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </figure>

          <figure className="chart">
            <figcaption>อุปกรณ์ที่ถูกยืมบ่อยที่สุด</figcaption>
            {r.topEquipment.length === 0 ? (
              <p className="muted">ยังไม่มีรายการที่อนุมัติในช่วงนี้</p>
            ) : (
              <ol className="hbars">
                {r.topEquipment.map((e) => (
                  <li key={e.id} title={`${e.name}: ยืม ${e.count} ครั้ง`}>
                    <span className="hbars__name">{e.name}</span>
                    <span className="hbars__track">
                      <span className="hbars__bar" // เว้นที่ปลายไว้ให้ตัวเลข
                        style={{ width: `calc((100% - 2.5rem) * ${e.count / topMax})` }} />
                      <span className="hbars__val">{e.count}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </figure>

          <figure className="chart">
            <figcaption>ผู้ยืมที่คืนช้า / ยังค้างคืน</figcaption>
            {r.lateBorrowers.length === 0 ? (
              <p className="muted">ไม่มีใครคืนช้าในช่วงนี้</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ผู้ยืม</th>
                      <th className="col-num">ค้างคืนตอนนี้</th>
                      <th className="col-num">เคยคืนช้า</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.lateBorrowers.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td className={`col-num ${u.overdue ? 'overdue' : ''}`}>{u.overdue}</td>
                        <td className="col-num">{u.late}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </figure>
        </div>
      )}
    </>
  )
}
