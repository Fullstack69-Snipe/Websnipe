// db/seed.js
// ใส่ข้อมูลตั้งต้นชุดเดียวกับใน mockApi.ts
// สลับจาก mock มาใช้ backend จริงแล้วหน้าจอจะเหมือนเดิมเป๊ะ

const db = require('../src/config/db');

const RESET = process.argv.includes('--reset');

// ---------- วันที่แบบสัมพันธ์กับวันนี้ (แทน dayjs().add(...)) ----------
const DAY_MS = 86400000;
const dateOnly = (offsetDays) =>
  new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
const timestamp = (offsetDays) =>
  new Date(Date.now() + offsetDays * DAY_MS).toISOString();

const users = [
  { id: 'u1', email: 'somchai@example.com', full_name: 'สมชาย ใจดี', role: 'user' },
  { id: 'u2', email: 'somying@example.com', full_name: 'สมหญิง รักงาน', role: 'staff' },
  { id: 'u3', email: 'admin@example.com', full_name: 'ผู้ดูแล ระบบ', role: 'admin' },
  { id: 'u4', email: 'wichai@example.com', full_name: 'วิชัย มั่นคง', role: 'user' }
];

const equipment = [
  { id: 'e1', name: 'กล้อง Canon EOS R50', description: 'พร้อมเลนส์คิท 18-45mm', image_url: 'https://picsum.photos/seed/camera/400/240', quantity: 2 },
  { id: 'e2', name: 'โน้ตบุ๊ก Dell Latitude 5450', description: 'i5 / RAM 16GB / SSD 512GB', image_url: 'https://picsum.photos/seed/laptop/400/240', quantity: 3 },
  { id: 'e3', name: 'ขาตั้งกล้อง Manfrotto', description: 'สูงสุด 160 cm พร้อมกระเป๋า', image_url: 'https://picsum.photos/seed/tripod/400/240', quantity: 4 },
  { id: 'e4', name: 'ไมค์ Rode Wireless GO II', description: 'ไมค์ไร้สาย 2 ตัว', image_url: null, quantity: 1 },
  { id: 'e5', name: 'โปรเจกเตอร์ Epson EB-X06', description: '3600 lumens พร้อมสาย HDMI', image_url: 'https://picsum.photos/seed/projector/400/240', quantity: 1 },
  { id: 'e6', name: 'ไฟ LED Godox SL60', description: 'พร้อมซอฟต์บ็อกซ์', image_url: 'https://picsum.photos/seed/light/400/240', quantity: 6 }
];

const borrows = [
  // กำลังยืม ปกติ
  { id: 'b1', equipment_id: 'e2', borrower_id: 'u4', due_date: dateOnly(5), status: 'approved', created_at: timestamp(-2), returned_at: null },
  // เกินกำหนดแล้ว — ใช้ทดสอบการไฮไลต์สีแดง
  { id: 'b2', equipment_id: 'e5', borrower_id: 'u1', due_date: dateOnly(-1), status: 'approved', created_at: timestamp(-9), returned_at: null },
  // ประวัติที่คืนแล้ว
  { id: 'b3', equipment_id: 'e1', borrower_id: 'u1', due_date: dateOnly(-20), status: 'returned', created_at: timestamp(-30), returned_at: timestamp(-21) }
];

const seed = db.transaction(() => {
  if (RESET) {
    db.prepare('DELETE FROM borrows').run();
    db.prepare('DELETE FROM equipment').run();
    db.prepare('DELETE FROM users').run();
    console.log('ล้างข้อมูลเดิมแล้ว');
  }

  const existing = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
  if (existing > 0) {
    console.log('มีข้อมูลอยู่แล้ว ข้ามการ seed (ใช้ --reset ถ้าต้องการล้างแล้วใส่ใหม่)');
    return false;
  }

  const insertUser = db.prepare('INSERT INTO users (id, email, full_name, role) VALUES (@id, @email, @full_name, @role)');
  const insertEquip = db.prepare('INSERT INTO equipment (id, name, description, image_url, quantity) VALUES (@id, @name, @description, @image_url, @quantity)');
  const insertBorrow = db.prepare(`
    INSERT INTO borrows (id, equipment_id, borrower_id, due_date, status, created_at, returned_at)
    VALUES (@id, @equipment_id, @borrower_id, @due_date, @status, @created_at, @returned_at)
  `);

  users.forEach((u) => insertUser.run(u));
  equipment.forEach((e) => insertEquip.run(e));
  borrows.forEach((b) => insertBorrow.run(b));

  return true;
});

if (seed()) {
  console.log(`seed สำเร็จ: users ${users.length} / equipment ${equipment.length} / borrows ${borrows.length}`);
}
