// src/models/borrowModel.js
// จัดการตาราง borrows
//
// ทุก SELECT join equipment + users เพื่อส่ง equipmentName / borrowerName กลับไปด้วย
// ให้ตรงกับ type Borrow ใน types.ts (frontend อ่าน field เหล่านี้ตรงๆ)

const crypto = require('crypto');
const db = require('../config/db');

const SELECT_BORROW = `
  SELECT
    b.id,
    b.equipment_id AS equipmentId,
    e.name         AS equipmentName,
    b.borrower_id  AS borrowerId,
    u.full_name    AS borrowerName,
    b.due_date     AS dueDate,
    b.status,
    b.created_at   AS createdAt,
    b.returned_at  AS returnedAt
  FROM borrows b
  JOIN equipment e ON e.id = b.equipment_id
  JOIN users     u ON u.id = b.borrower_id
`;

const borrowModel = {
  // เรียงใหม่สุดขึ้นก่อน เหมือน .sort((a,b) => b.createdAt.localeCompare(a.createdAt))
  listAll() {
    return db.prepare(`${SELECT_BORROW} ORDER BY b.created_at DESC`).all();
  },

  listByBorrower(borrowerId) {
    return db.prepare(`${SELECT_BORROW} WHERE b.borrower_id = ? ORDER BY b.created_at DESC`).all(borrowerId);
  },

  findById(id) {
    return db.prepare(`${SELECT_BORROW} WHERE b.id = ?`).get(id);
  },

  create({ equipmentId, borrowerId, dueDate }) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO borrows (id, equipment_id, borrower_id, due_date, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(id, equipmentId, borrowerId, dueDate);
    return borrowModel.findById(id);
  },

  setStatus(id, status) {
    db.prepare('UPDATE borrows SET status = ? WHERE id = ?').run(status, id);
    return borrowModel.findById(id);
  },

  markReturned(id) {
    db.prepare(`
      UPDATE borrows
      SET status = 'returned', returned_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(id);
    return borrowModel.findById(id);
  }
};

module.exports = borrowModel;
