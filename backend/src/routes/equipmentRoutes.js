// src/routes/equipmentRoutes.js
const express = require('express');
const ctrl = require('../controllers/equipmentController');
const { requireRole } = require('../middleware/identity');
const wrap = require('../utils/wrap');

const router = express.Router();

// อ่านได้ทุก role
router.get('/', wrap(ctrl.list));
router.get('/:id', wrap(ctrl.getOne));

// ประวัติ — staff + admin เท่านั้น
router.get('/:id/logs', requireRole('staff', 'admin'), wrap(ctrl.logs));

// เขียนได้เฉพาะ staff + admin
router.post('/', requireRole('staff', 'admin'), wrap(ctrl.create));
router.put('/:id', requireRole('staff', 'admin'), wrap(ctrl.update));
router.delete('/:id', requireRole('staff', 'admin'), wrap(ctrl.remove));

module.exports = router;
