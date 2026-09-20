// src/models/userModel.js
// ชั้น model ย้ายไปอยู่ในแพ็กเกจ db (PostgreSQL + Drizzle) แล้ว
// ไฟล์นี้เหลือไว้เป็นทางผ่าน เพื่อให้ controller เดิม require path เดิมได้ต่อ
//
// ต่างจากเวอร์ชัน SQLite เดิม: ทุกฟังก์ชันเป็น async ต้อง await ตอนเรียก

const { userModel } = require('db');

module.exports = userModel;
