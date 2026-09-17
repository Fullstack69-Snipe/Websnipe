// src/middleware/upload.js
// รับไฟล์รูปอุปกรณ์ที่อัปโหลดจากเครื่อง แล้วคืน URL กลับไปใส่ใน imageUrl
//
// types.ts กำหนด imageUrl เป็น string ดังนั้น flow ฝั่ง frontend คือ
//   1) POST /api/uploads (multipart) -> ได้ { url }
//   2) ส่ง url นั้นเป็น imageUrl ใน createEquipment / updateEquipment (JSON)
// แยกสองขั้นแบบนี้ทำให้ endpoint อุปกรณ์ยังเป็น JSON ล้วน ไม่ต้องแก้ type

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { badRequest } = require('../utils/HttpError');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      // ต้องใส่ status เอง ไม่งั้น errorHandler จะมองเป็น error ทั่วไปแล้วตอบ 500
      return cb(badRequest('รองรับเฉพาะไฟล์รูปภาพ (jpg, png, gif, webp)'));
    }
    cb(null, true);
  }
});

module.exports = upload;
module.exports.UPLOAD_DIR = UPLOAD_DIR;
