import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { api } from '../lib/api'
import { LOG_ACTION_LABEL, STATUS_LABEL } from '../lib/labels'
import type { Equipment, EquipmentLog } from '../types'

// ประวัติของอุปกรณ์ชิ้นหนึ่ง — ตอบคำถามว่า "ของชิ้นนี้ผ่านมือใครมาบ้าง"
export default function EquipmentHistory({
  item,
  onClose,
}: {
  item: Equipment
  onClose: () => void
}) {
  const [logs, setLogs] = useState<EquipmentLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .equipmentLogs(item.id)
      .then(setLogs)
      .catch(() => setError('โหลดประวัติไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [item.id])

  return (
    <dialog open>
      <article className="history">
        <header>
          <button type="button" aria-label="ปิด" rel="prev" onClick={onClose} />
          <strong>ประวัติ — {item.name}</strong>
        </header>

        {loading && <p aria-busy="true">กำลังโหลด...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && logs.length === 0 && <p>ยังไม่มีประวัติ</p>}

        {logs.length > 0 && (
          <ol className="history__list">
            {logs.map((l) => (
              <li key={l.id}>
                <div className="history__head">
                  <strong>{LOG_ACTION_LABEL[l.action]}</strong>
                  <small>{dayjs(l.createdAt).format('D MMM YYYY HH:mm')}</small>
                </div>
                <small className="muted-line">โดย {l.actorName}</small>
                {l.fromStatus && l.toStatus && (
                  <small className="muted-line">
                    {STATUS_LABEL[l.fromStatus]} → {STATUS_LABEL[l.toStatus]}
                  </small>
                )}
                {l.note && <small className="muted-line">{l.note}</small>}
              </li>
            ))}
          </ol>
        )}

        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            ปิด
          </button>
        </footer>
      </article>
    </dialog>
  )
}
