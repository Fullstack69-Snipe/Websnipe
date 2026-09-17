// src/models/equipmentModel.js
// จัดการตาราง equipment
//
// สำคัญ: available ไม่ได้เก็บใน DB — คำนวณสดจากตาราง borrows
// เทียบเท่าฟังก์ชัน borrowedCount() + withAvailable() ใน mockApi.ts

const crypto = require('crypto');
const db = require('../config/db');

// สถานะที่ถือว่า "ถือของอยู่" — pending ไม่นับ เพราะ staff อาจปฏิเสธ
// ต้องตรงกับ HOLDING ใน mockApi.ts
const HOLDING = ['approved', 'returning'];
const HOLDING_SQL = HOLDING.map(() => '?').join(',');

// SELECT ที่เติม available มาให้เลยในชั้น SQL
const SELECT_WITH_AVAILABLE = `
  SELECT
    e.id,
    e.name,
    e.description,
    e.image_url AS imageUrl,
    e.quantity,
    e.quantity - (
      SELECT COUNT(*) FROM borrows b
      WHERE b.equipment_id = e.id AND b.status IN (${HOLDING_SQL})
    ) AS available
  FROM equipment e
`;

const equipmentModel = {
  listAll() {
    return db.prepare(`${SELECT_WITH_AVAILABLE} ORDER BY e.created_at ASC`).all(...HOLDING);
  },

  findById(id) {
    return db.prepare(`${SELECT_WITH_AVAILABLE} WHERE e.id = ?`).get(...HOLDING, id);
  },

  // จำนวนที่กำลังถูกยืมอยู่ของอุปกรณ์ชิ้นนี้
  borrowedCount(equipmentId) {
    const row = db.prepare(`
      SELECT COUNT(*) AS cnt FROM borrows
      WHERE equipment_id = ? AND status IN (${HOLDING_SQL})
    `).get(equipmentId, ...HOLDING);
    return row.cnt;
  },

  create({ name, description, imageUrl, quantity }) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO equipment (id, name, description, image_url, quantity)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, description ?? '', imageUrl ?? null, quantity);
    return equipmentModel.findById(id);
  },

  update(id, { name, description, imageUrl, quantity }) {
    db.prepare(`
      UPDATE equipment
      SET name = ?, description = ?, image_url = ?, quantity = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(name, description ?? '', imageUrl ?? null, quantity, id);
    return equipmentModel.findById(id);
  },

  // ลบอุปกรณ์ + ประวัติการยืมที่ไม่ได้ถือของอยู่ (pending / rejected / returned)
  //
  // ต้องลบ borrows ทิ้งด้วย เพราะ FK เป็น ON DELETE RESTRICT
  // ถ้าปล่อยไว้ SQLite จะ error ทันทีที่มีประวัติการยืมค้างอยู่
  // controller เช็คแล้วว่าไม่มีรายการสถานะ approved/returning ก่อนเรียกฟังก์ชันนี้
  //
  // คืนค่าจำนวนประวัติที่ถูกลบไปด้วย เพื่อให้ controller แจ้งผู้ใช้ได้
  remove(id) {
    const removeAll = db.transaction((equipmentId) => {
      const { changes } = db.prepare('DELETE FROM borrows WHERE equipment_id = ?').run(equipmentId);
      db.prepare('DELETE FROM equipment WHERE id = ?').run(equipmentId);
      return changes;
    });
    return removeAll(id);
  },

  HOLDING
};

module.exports = equipmentModel;
