-- db/schema.sql
-- โครงสร้างฐานข้อมูลระบบยืม-คืนอุปกรณ์
--
-- หมายเหตุสำคัญ: ตาราง equipment ไม่มีคอลัมน์ available
-- เพราะจำนวนคงเหลือคำนวณจากตาราง borrows ทุกครั้ง (quantity - จำนวนที่ถือของอยู่)
-- ทำให้ไม่มีปัญหาข้อมูลไม่ตรงกัน (drift) เหมือนการเก็บตัวเลขซ้ำสองที่

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  full_name  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'user'
             CHECK (role IN ('user', 'staff', 'admin')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS equipment (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url   TEXT,
  quantity    INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS borrows (
  id           TEXT PRIMARY KEY,
  equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  borrower_id  TEXT NOT NULL REFERENCES users(id)     ON DELETE RESTRICT,
  due_date     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected', 'returning', 'returned')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  returned_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_borrows_equipment ON borrows(equipment_id);
CREATE INDEX IF NOT EXISTS idx_borrows_borrower  ON borrows(borrower_id);
CREATE INDEX IF NOT EXISTS idx_borrows_status    ON borrows(status);
