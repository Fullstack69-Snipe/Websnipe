// src/routes/uploadRoutes.js
// POST /api/uploads  (multipart, field name = "file")  ->  { url }
// นำ url ที่ได้ไปใส่เป็น imageUrl ตอน create/update equipment

const express = require('express');
const upload = require('../middleware/upload');
const { requireRole } = require('../middleware/identity');
const { badRequest } = require('../utils/HttpError');
const wrap = require('../utils/wrap');

const router = express.Router();

router.post(
  '/',
  requireRole('staff', 'admin'),
  upload.single('file'),
  wrap((req, res) => {
    if (!req.file) throw badRequest('ไม่พบไฟล์ที่อัปโหลด (field name ต้องเป็น "file")');
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  })
);

module.exports = router;
