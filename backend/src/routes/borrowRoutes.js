// src/routes/borrowRoutes.js
const express = require('express');
const ctrl = require('../controllers/borrowController');
const { requireRole } = require('../middleware/identity');
const wrap = require('../utils/wrap');

const router = express.Router();

// --- ฝั่งผู้ยืม (ทุก role ยืมได้) ---
// /mine ต้องมาก่อน /:id เสมอ ไม่งั้นจะถูกจับเป็น id
router.get('/mine', wrap(ctrl.listMine));
router.post('/', wrap(ctrl.create));
router.put('/:id/request-return', wrap(ctrl.requestReturn));

// --- ฝั่ง staff ---
router.get('/', requireRole('staff', 'admin'), wrap(ctrl.list));
router.put('/:id/approve', requireRole('staff', 'admin'), wrap(ctrl.approve));
router.put('/:id/reject', requireRole('staff', 'admin'), wrap(ctrl.reject));
router.put('/:id/confirm-return', requireRole('staff', 'admin'), wrap(ctrl.confirmReturn));

module.exports = router;
