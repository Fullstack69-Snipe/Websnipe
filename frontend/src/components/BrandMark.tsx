import { Package } from 'lucide-react'

// โลโก้ + ชื่อระบบ ใช้ทั้งหัวเว็บและหน้าเข้าสู่ระบบ
export default function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`brand brand--${size}`}>
      <span className="brand__mark" aria-hidden="true">
        <Package />
      </span>
      <span className="brand__text">
        <strong>BORROW APP</strong>
        <small>ระบบยืม-คืนอุปกรณ์</small>
      </span>
    </span>
  )
}
