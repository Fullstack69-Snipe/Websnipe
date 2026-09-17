// src/models/userModel.js
// จัดการตาราง users (ส่งออกเป็น camelCase ให้ตรงกับ type User ใน types.ts)

const db = require('../config/db');

const SELECT_USER = `
  SELECT id, email, full_name AS fullName, role FROM users
`;

const userModel = {
  listAll() {
    return db.prepare(`${SELECT_USER} ORDER BY created_at ASC`).all();
  },

  findById(id) {
    return db.prepare(`${SELECT_USER} WHERE id = ?`).get(id);
  },

  setRole(id, role) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    return userModel.findById(id);
  }
};

module.exports = userModel;
