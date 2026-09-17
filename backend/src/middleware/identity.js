// src/middleware/identity.js
//
// ยังไม่มี login จริง — middleware นี้ทำหน้าที่แทน CURRENT_USER_ID ใน mockApi.ts
// และแทน RoleContext ฝั่ง frontend
//
// ระบบอ่านตัวตนจาก header:
//   x-user-id : id ผู้ใช้ (ถ้าไม่ส่งมา ใช้ DEFAULT_USER_ID = 'u1' เหมือน mockApi)
//   x-role    : role ที่ต้องการใช้ตรวจสิทธิ์ (ไม่ส่งก็ใช้ role จริงจาก DB)
//
// x-role มีไว้รองรับปุ่มสลับ role ใน RoleProvider ที่สลับได้อิสระจากตัวผู้ใช้
// ตอนทำ login จริง: ลบ header พวกนี้ทิ้ง แล้วอ่าน req.user จาก JWT แทน
// โดยที่ controller ทุกตัวไม่ต้องแก้เลย เพราะมันอ่านจาก req.user / req.role อยู่แล้ว

const userModel = require('../models/userModel');
const { forbidden, notFound } = require('../utils/HttpError');

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || 'u1';
const VALID_ROLES = ['user', 'staff', 'admin'];

function attachIdentity(req, res, next) {
  const userId = req.header('x-user-id') || DEFAULT_USER_ID;
  const user = userModel.findById(userId);

  if (!user) {
    return next(notFound(`ไม่พบผู้ใช้ (x-user-id: ${userId})`));
  }

  const headerRole = req.header('x-role');
  req.user = user;
  req.role = VALID_ROLES.includes(headerRole) ? headerRole : user.role;
  next();
}

// ต้องมี role อยู่ในรายการที่อนุญาต
function requireRole(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.role)) {
      return next(forbidden('คุณไม่มีสิทธิ์ใช้งานส่วนนี้'));
    }
    next();
  };
}

module.exports = { attachIdentity, requireRole, DEFAULT_USER_ID };
