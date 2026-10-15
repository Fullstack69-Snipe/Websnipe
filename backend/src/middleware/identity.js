// src/middleware/identity.js
//
// ตัวตนมาจาก session cookie เท่านั้น (ตั้งโดย authController ตอน login สำเร็จ)
// role อ่านจากฐานข้อมูลเสมอ — ไม่มี header ให้ override อีกแล้ว
//
// เดิมระบบอ่าน x-user-id / x-role จาก header ซึ่งแปลว่าใครก็ตาม
// ส่ง `x-role: admin` มาก็ได้สิทธิ์เต็ม ตอนนี้เอาออกหมดแล้ว

const { authModel, departmentModel } = require('db');
const { forbidden, unauthorized } = require('../utils/HttpError');

const SESSION_COOKIE = 'pf_session';

async function attachIdentity(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];

  if (!token) {
    return next(unauthorized('กรุณาเข้าสู่ระบบ'));
  }

  const user = await authModel.findUserBySession(token);

  if (!user) {
    // session หมดอายุหรือถูกเพิกถอน — ล้างคุกกี้ทิ้งให้ด้วย
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return next(unauthorized('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'));
  }

  req.user = user;
  req.role = user.role;   // มาจาก DB เท่านั้น
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

// staff จัดการได้เฉพาะอุปกรณ์ในแผนกที่ตัวเองดูแล (หรือที่ไม่สังกัดแผนก) admin ได้ทุกชิ้น
async function assertCanManage(user, equipmentId) {
  if (user.role === 'admin') return;
  if (!await departmentModel.staffCanManage(user.id, equipmentId)) {
    throw forbidden('เจ้าหน้าที่ไม่มีสิทธิ์จัดการอุปกรณ์ของแผนกนี้');
  }
}

module.exports = { attachIdentity, requireRole, assertCanManage, SESSION_COOKIE };
