import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = { page: number; pages: number; setPage: (p: number) => void }

// ปุ่มก่อนหน้า/ถัดไป ใต้ตาราง — หน้าเดียวไม่ต้องแสดง
export default function Pagination({ page, pages, setPage }: Props) {
  if (pages <= 1) return null
  return (
    <nav className="pagination" aria-label="เปลี่ยนหน้า">
      <button
        type="button"
        className="outline secondary"
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
      >
        <ChevronLeft aria-hidden="true" />
        ก่อนหน้า
      </button>
      <span aria-live="polite">
        หน้า {page} / {pages}
      </span>
      <button
        type="button"
        className="outline secondary"
        disabled={page === pages}
        onClick={() => setPage(page + 1)}
      >
        ถัดไป
        <ChevronRight aria-hidden="true" />
      </button>
    </nav>
  )
}
