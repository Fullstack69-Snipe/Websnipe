// src/controllers/qrController.js
// QR เก็บแค่ลิงก์ไปหน้าอุปกรณ์ เป็นตัวระบุของ ไม่ใช่สิทธิ์ใช้งาน (ยังต้อง login ตามปกติ)
// สแกนด้วยกล้องมือถือแล้วเปิดลิงก์ได้เลย ไม่ต้องมีตัวสแกนในแอป

const QRCode = require('qrcode');
const equipmentModel = require('../models/equipmentModel');
const { APP_URL } = require('../config/oauth');
const { notFound } = require('../utils/HttpError');

module.exports = {
  // GET /api/qr/equipment/:id.svg — รูป QR สำหรับพิมพ์ติดของ
  async svg(req, res) {
    const item = await equipmentModel.findById(req.params.id);
    if (!item) throw notFound('ไม่พบอุปกรณ์');

    const url = `${APP_URL.replace(/\/$/, '')}/equipment/${encodeURIComponent(item.id)}`;
    res.type('image/svg+xml').send(await QRCode.toString(url, { type: 'svg', margin: 1 }));
  },
};
