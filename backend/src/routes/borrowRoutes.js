
const express = require('express');

const ctrl = require(
  '../controllers/borrowController'
);

const {
  requireRole
} = require('../middleware/identity');

const wrap = require('../utils/wrap');

const router = express.Router();

// =========================================
// ฝั่งผู้ยืม
// =========================================

// ดูรายการยืมของตัวเอง
router.get(
  '/mine',
  wrap(ctrl.listMine)
);

// สร้างคำขอยืม
router.post(
  '/',
  wrap(ctrl.create)
);

// ยกเลิกคำขอยืม (เพิ่มใหม่)
router.put(
  '/:id/cancel',
  wrap(ctrl.cancel)
);

// แจ้งคืนอุปกรณ์
router.put(
  '/:id/request-return',
  wrap(ctrl.requestReturn)
);

// =========================================
// ฝั่งเจ้าหน้าที่ / Admin
// =========================================

// ดูรายการยืมทั้งหมด
router.get(
  '/',
  requireRole('staff', 'admin'),
  wrap(ctrl.list)
);

// อนุมัติคำขอ
router.put(
  '/:id/approve',
  requireRole('staff', 'admin'),
  wrap(ctrl.approve)
);

// ปฏิเสธคำขอ
router.put(
  '/:id/reject',
  requireRole('staff', 'admin'),
  wrap(ctrl.reject)
);

// ยืนยันการคืนอุปกรณ์
router.put(
  '/:id/confirm-return',
  requireRole('staff', 'admin'),
  wrap(ctrl.confirmReturn)
);

module.exports = router;
