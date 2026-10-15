// src/controllers/notificationController.js
// แจ้งเตือนของผู้ใช้ที่ login อยู่ — เห็นและแก้ได้เฉพาะของตัวเอง

const { notificationModel } = require('db');
const { notify } = require('../services/notify');
const { badRequest } = require('../utils/HttpError');

module.exports = {
  // GET /api/notifications — 30 รายการล่าสุด + จำนวนที่ยังไม่อ่าน
  async list(req, res) {
    const [items, unread] = await Promise.all([
      notificationModel.listForUser(req.user.id),
      notificationModel.unreadCount(req.user.id),
    ]);
    res.json({ items, unread });
  },

  // PUT /api/notifications/:id/read
  async read(req, res) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw badRequest('รหัสแจ้งเตือนไม่ถูกต้อง');
    await notificationModel.markRead(req.user.id, id);
    res.status(204).end();
  },

  // PUT /api/notifications/read-all
  async readAll(req, res) {
    await notificationModel.markAllRead(req.user.id);
    res.status(204).end();
  },

  // POST /api/notifications/reminders (admin) — ตรวจเตือนครบกำหนดทันที ปกติระบบตรวจเองทุก 15 นาที
  async runReminders(req, res) {
    res.json({ sent: await notify.reminders() });
  },
};
