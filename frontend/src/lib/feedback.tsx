import { createContext, useCallback, useRef, useState, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'

type Toast = {
  id: number
  type: ToastType
  message: string
}

type DialogOptions = {
  message: string
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

// ถ้ามี input = โหมดกรอกข้อความ (แทน window.prompt) / ไม่มี = โหมดยืนยันเฉย ๆ
type PromptOptions = DialogOptions & {
  label: string
  placeholder?: string
  multiline?: boolean
}

type Pending =
  | (DialogOptions & { input?: undefined; resolve: (ok: boolean) => void })
  | (PromptOptions & { input: true; resolve: (value: string | null) => void })

export type FeedbackValue = {
  toast: (message: string, type?: ToastType) => void
  confirm: (options: DialogOptions | string) => Promise<boolean>
  /** คืน string ที่กรอก หรือ null ถ้ากดยกเลิก (ข้อความว่างถือว่ากรอกแล้ว) */
  prompt: (options: PromptOptions) => Promise<string | null>
}

export const FeedbackContext = createContext<FeedbackValue | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pending, setPending] = useState<Pending | null>(null)
  const [draft, setDraft] = useState('')
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = nextId.current++
      setToasts((list) => [...list, { id, type, message }])
      // ข้อความผิดพลาดค้างไว้นานกว่า เพราะผู้ใช้ต้องอ่านแล้วแก้
      setTimeout(() => dismiss(id), type === 'error' ? 6000 : 3500)
    },
    [dismiss],
  )

  // คืนค่าเป็น Promise เพื่อให้เขียนได้แบบ:  if (!(await confirm('...'))) return
  const confirm = useCallback((options: DialogOptions | string) => {
    const opts = typeof options === 'string' ? { message: options } : options
    return new Promise<boolean>((resolve) => setPending({ ...opts, resolve }))
  }, [])

  const prompt = useCallback((options: PromptOptions) => {
    setDraft('')
    return new Promise<string | null>((resolve) =>
      setPending({ ...options, input: true, resolve }),
    )
  }, [])

  function close(confirmed: boolean) {
    if (!pending) return
    if (pending.input) pending.resolve(confirmed ? draft : null)
    else pending.resolve(confirmed)
    setPending(null)
    setDraft('')
  }

  return (
    <FeedbackContext value={{ toast, confirm, prompt }}>
      {children}

      {/* ---------- กล่องยืนยัน / กรอกข้อความ ---------- */}
      {pending && (
        <dialog open className="confirm">
          <article>
            <header>
              <strong>{pending.title ?? (pending.input ? 'กรอกข้อมูล' : 'ยืนยันการทำรายการ')}</strong>
            </header>

            <p>{pending.message}</p>

            {pending.input && (
              <label>
                {pending.label}
                {pending.multiline ? (
                  <textarea
                    rows={2}
                    autoFocus
                    value={draft}
                    placeholder={pending.placeholder}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                ) : (
                  <input
                    autoFocus
                    value={draft}
                    placeholder={pending.placeholder}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && close(true)}
                  />
                )}
              </label>
            )}

            <footer>
              <button type="button" className="secondary" onClick={() => close(false)}>
                {pending.cancelLabel ?? 'ยกเลิก'}
              </button>
              <button
                type="button"
                className={pending.danger ? 'danger' : undefined}
                autoFocus={!pending.input}
                onClick={() => close(true)}
              >
                {pending.confirmLabel ?? 'ยืนยัน'}
              </button>
            </footer>
          </article>
        </dialog>
      )}

      {/* ---------- แถบแจ้งเตือนมุมจอ ---------- */}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`toast toast--${t.type}`}
            onClick={() => dismiss(t.id)}
            title="คลิกเพื่อปิด"
          >
            <span className="toast__icon" aria-hidden="true">
              {t.type === 'success' ? '✓' : t.type === 'error' ? '!' : 'i'}
            </span>
            <span>{t.message}</span>
          </button>
        ))}
      </div>
    </FeedbackContext>
  )
}
