// src/models/borrowModel.js
// ชั้น model ย้ายไปอยู่ในแพ็กเกจ db (PostgreSQL + Drizzle) แล้ว
//
// ต่างจากเวอร์ชัน SQLite เดิม: ทุกฟังก์ชันเป็น async ต้อง await ตอนเรียก

const { borrowModel } = require('db');

module.exports = borrowModel;
