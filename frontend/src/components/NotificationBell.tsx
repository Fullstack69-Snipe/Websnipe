import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Bell } from 'lucide-react'
import { api } from '../lib/api'
import type { AppNotification } from '../types'

const POLL_MS = 60_000

// กระดิ่งแจ้งเตือนบนหัวเว็บ — โหลดใหม่ทุกนาที และทุกครั้งที่เปลี่ยนหน้า (refreshKey)
export default function NotificationBell({ refreshKey }: { refreshKey: string }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    api
      .listNotifications()
      .then((r) => {
        setItems(r.items)
        setUnread(r.unread)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  useEffect(() => {
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  // ปิดเมื่อคลิกนอกกล่องหรือกด Esc
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function openItem(n: AppNotification) {
    setOpen(false)
    if (!n.readAt) {
      await api.markNotificationRead(n.id).catch(() => {})
      load()
    }
    if (n.link) navigate(n.link)
  }

  async function readAll() {
    await api.markAllNotificationsRead().catch(() => {})
    load()
  }

  return (
    <div className="notif" ref={boxRef}>
      <button
        type="button"
        className="outline secondary notif__button"
        aria-label={unread > 0 ? `แจ้งเตือน ${unread} รายการที่ยังไม่อ่าน` : 'แจ้งเตือน'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell aria-hidden="true" />
        {unread > 0 && <span className="nav-badge notif__badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="notif__panel" role="dialog" aria-label="แจ้งเตือน">
          <header>
            <strong>แจ้งเตือน</strong>
            {unread > 0 && (
              <button type="button" className="dept-link" onClick={() => void readAll()}>
                อ่านทั้งหมด
              </button>
            )}
          </header>
          {items.length === 0 ? (
            <p className="notif__empty">ยังไม่มีแจ้งเตือน</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notif__item ${n.readAt ? '' : 'notif__item--unread'}`}
                    onClick={() => void openItem(n)}
                  >
                    <strong>{n.title}</strong>
                    {n.body && <span>{n.body}</span>}
                    <small>{dayjs(n.createdAt).fromNow()}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
