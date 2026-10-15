import { useEffect, useState } from 'react'
import { CalendarRange, History, QrCode } from 'lucide-react'
import { api } from '../lib/api'
import ProviderIcon from '../components/ProviderIcon'
import BrandMark from '../components/BrandMark'

// ปุ่มเข้าสู่ระบบจะขึ้นเฉพาะช่องทางที่ backend ตั้ง client id/secret ไว้แล้ว
// (ดู backend/src/config/oauth.js) ถ้ายังไม่ได้ตั้งจะเห็นข้อความบอกวิธี

const FEATURES = [
  { icon: CalendarRange, text: 'จองอุปกรณ์ล่วงหน้าตามช่วงวันที่ต้องใช้ เห็นทันทีว่าว่างหรือไม่' },
  { icon: QrCode, text: 'สแกน QR บนตัวอุปกรณ์ เพื่อดูรายละเอียด ขอยืม และยืนยันรับของ' },
  { icon: History, text: 'ติดตามสถานะได้ทุกขั้นตอน ตั้งแต่ขอยืมจนถึงคืนของ' },
]

// รูปสำรองจากข้อมูลตั้งต้น (frontend/public/seed) — ใช้ตอนดึงรูปจาก backend ไม่ได้
const FALLBACK_PHOTOS = [
  '/seed/canon-eos-r50.jpg',
  '/seed/dell-latitude-7490.jpg',
  '/seed/epson-eb-u04.jpg',
  '/seed/rode-wireless-go-ii.jpg',
  '/seed/manfrotto-190xb.jpg',
  '/seed/godox-tt685ii.jpg',
]
const SLOTS = 3
const ROTATE_MS = 3000

export default function SignIn() {
  const [providers, setProviders] = useState<{ name: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [photos, setPhotos] = useState(FALLBACK_PHOTOS)
  // index ของรูปที่แสดงอยู่ในแต่ละช่อง
  const [frames, setFrames] = useState([0, 1, 2])

  // ?error=... มาจาก callback ตอนผู้ใช้กดยกเลิกหรือ state ไม่ตรง
  // ?next=... หน้าที่จะกลับไปหลัง login (backend ตรวจอีกรอบว่าเป็น path ในแอปนี้)
  const search = new URLSearchParams(window.location.search)
  const error = search.get('error')
  const next = search.get('next')

  useEffect(() => {
    api
      .authProviders()
      .then((r) => setProviders(r.providers))
      .catch(() => setProviders([]))
      .finally(() => setLoading(false))

    // รูปอุปกรณ์จริงในระบบ — น้อยกว่าจำนวนช่องก็ใช้รูปสำรองต่อไป
    api
      .showcasePhotos()
      .then((r) => {
        if (r.photos.length >= SLOTS) setPhotos(r.photos)
      })
      .catch(() => {})
  }, [])

  // เปลี่ยนรูปทีละช่องวนไปเรื่อย ๆ — มีรูปไม่เกินจำนวนช่อง หรือผู้ใช้ตั้งลดการเคลื่อนไหวไว้ ก็ไม่วน
  useEffect(() => {
    setFrames([0, 1, 2])
    if (photos.length <= SLOTS || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let cursor = SLOTS
    let slot = 0
    const timer = setInterval(() => {
      const next = cursor % photos.length
      const target = slot
      setFrames((f) => f.map((v, i) => (i === target ? next : v)))
      cursor += 1
      slot = (slot + 1) % SLOTS
    }, ROTATE_MS)
    return () => clearInterval(timer)
  }, [photos])

  return (
    <main className="signin">
      {/* แผงซ้าย: บอกว่าระบบนี้คืออะไร — จอแคบซ่อนไว้ เหลือแต่การ์ดเข้าสู่ระบบ */}
      <section className="signin__brand" aria-hidden="true">
        <span className="signin__brand-mark">
          <BrandMark size="lg" />
        </span>
        <h2>ยืม-คืนอุปกรณ์ได้ในที่เดียว</h2>
        <p>ค้นหา จอง และติดตามการยืมอุปกรณ์ของคณะได้จากทุกที่</p>
        <ul className="signin__features">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text}>
              <span>
                <Icon />
              </span>
              {text}
            </li>
          ))}
        </ul>
        <div className="signin__photos">
          {/* key เปลี่ยนเมื่อรูปในช่องเปลี่ยน -> img ถูกสร้างใหม่ แอนิเมชันจางเข้าจึงเล่นทุกครั้ง */}
          {frames.map((index, slot) => (
            <img key={`${slot}-${index}`} src={photos[index]} alt="" />
          ))}
        </div>
      </section>

      <article className="signin__card">
        <header className="signin__head">
          <span className="signin__logo-mobile">
            <BrandMark />
          </span>
          <h1>เข้าสู่ระบบ</h1>
          <p>ใช้บัญชีของคุณเพื่อเข้าใช้งาน BORROW APP</p>
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
            href={`/api/auth/${p.name}${next ? `?next=${encodeURIComponent(next)}` : ''}`}
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
