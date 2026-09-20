// src/middleware/errorHandler.js
// รวมการตอบ error ไว้ที่เดียว รูปแบบ { error: "ข้อความ" }
// frontend อ่าน field `error` ไปแสดงได้ตรงๆ (ดู throwIfError ใน api.ts)

const multer = require('multer');

function notFoundHandler(req, res) {
  res.status(404).json({ error: `ไม่พบเส้นทาง ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'ไฟล์ใหญ่เกิน 5MB'
      : `อัปโหลดไฟล์ไม่สำเร็จ: ${err.message}`;
    return res.status(400).json({ error: msg });
  }

  const status = err.status || 500;

  // error ที่เราตั้งใจโยนเอง (มี status) ข้อความปลอดภัยพอจะส่งให้ผู้ใช้อ่าน
  // ส่วน 500 มักเป็น error ดิบจากฐานข้อมูล/ไลบรารี ซึ่งอาจมีชื่อตาราง/คอลัมน์/SQL ติดมา
  // จึง log ไว้ฝั่ง server แล้วตอบผู้ใช้แบบกลางๆ แทน
  if (status >= 500) {
    console.error(err);
    return res.status(status).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
  }

  res.status(status).json({ error: err.message || 'เกิดข้อผิดพลาดในระบบ' });
}

module.exports = { notFoundHandler, errorHandler };
