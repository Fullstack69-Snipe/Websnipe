import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import ProviderIcon from '../components/ProviderIcon'

// ปุ่มเข้าสู่ระบบจะขึ้นเฉพาะช่องทางที่ backend ตั้ง client id/secret ไว้แล้ว
// (ดู backend/src/config/oauth.js) ถ้ายังไม่ได้ตั้งจะเห็นข้อความบอกวิธี

export default function SignIn() {
  const [providers, setProviders] = useState<{ name: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)

  // ?error=... มาจาก callback ตอนผู้ใช้กดยกเลิกหรือ state ไม่ตรง
  const error = new URLSearchParams(window.location.search).get('error')

  useEffect(() => {
    api
      .authProviders()
      .then((r) => setProviders(r.providers))
      .catch(() => setProviders([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="signin">
      <article className="signin__card">
        <header className="signin__head">
          <span className="signin__logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 8 12 3 3 8l9 5 9-5Z" />
              <path d="M3 8v8l9 5 9-5V8" />
              <path d="M12 13v8" />
            </svg>
          </span>
          <h1>ระบบยืม-คืนอุปกรณ์</h1>
          <p>จัดการการยืม-คืนอุปกรณ์ภายในองค์กร</p>
        </header>

        {error && (
          <p className="signin__error" role="alert">
            เข้าสู่ระบบไม่สำเร็จ: {error}
          </p>
        )}

        {loading && <p aria-busy="true">กำลังโหลด...</p>}

        {!loading && providers.length === 0 && (
          <p className="signin__error">
            ยังไม่ได้ตั้งค่าช่องทางเข้าสู่ระบบ — ตั้ง <code>GOOGLE_CLIENT_ID</code>,{' '}
            <code>GITHUB_CLIENT_ID</code> หรือ <code>DISCORD_CLIENT_ID</code> ใน{' '}
            <code>.env</code> แล้วรีสตาร์ต backend
          </p>
        )}

        {!loading && providers.length > 0 && (
          <p className="signin__hint">เลือกช่องทางเข้าสู่ระบบ</p>
        )}

        {/* ใช้ <a> ไม่ใช่ fetch เพราะต้องให้เบราว์เซอร์ redirect ไปหน้า provider จริงๆ */}
        {providers.map((p) => (
          <a
            key={p.name}
            role="button"
            className={`signin__btn signin__btn--${p.name}`}
            href={`/api/auth/${p.name}`}
          >
            <ProviderIcon provider={p.name} />
            เข้าสู่ระบบด้วย {p.label}
          </a>
        ))}

        <footer className="signin__foot">
          <small>ผู้ใช้ใหม่จะได้สิทธิ์ "ผู้ยืม" โดยอัตโนมัติ</small>
        </footer>
      </article>
    </main>
  )
}
