// src/models/equipmentModel.js
// ชั้น model ย้ายไปอยู่ในแพ็กเกจ db (PostgreSQL + Drizzle) แล้ว
//
// available ยังคงคำนวณสดจากตาราง borrows เหมือนเดิม (ไม่ได้เก็บในคอลัมน์)
// ต่างจากเวอร์ชัน SQLite เดิม: ทุกฟังก์ชันเป็น async ต้อง await ตอนเรียก

const { equipmentModel } = require('db');

module.exports = equipmentModel;
