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
  if (status >= 500) console.error(err);

  res.status(status).json({ error: err.message || 'เกิดข้อผิดพลาดในระบบ' });
}

module.exports = { notFoundHandler, errorHandler };
