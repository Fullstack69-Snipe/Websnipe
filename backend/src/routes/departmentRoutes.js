// src/routes/departmentRoutes.js
const express = require('express');
const ctrl = require('../controllers/departmentController');
const { requireRole } = require('../middleware/identity');
const wrap = require('../utils/wrap');

const router = express.Router();

// อ่านได้ทุก role
router.get('/', wrap(ctrl.list));
router.get('/:id/equipment', wrap(ctrl.equipment));

// สร้าง/มอบหมาย — admin เท่านั้น
router.post('/', requireRole('admin'), wrap(ctrl.create));
router.put('/:id', requireRole('admin'), wrap(ctrl.rename));
router.delete('/:id', requireRole('admin'), wrap(ctrl.remove));
router.put('/:id/equipment/:equipmentId', requireRole('admin'), wrap(ctrl.assignEquipment));
router.put('/:id/staff/:userId', requireRole('admin'), wrap(ctrl.assignStaff));
router.delete('/:id/equipment/:equipmentId', requireRole('admin'), wrap(ctrl.unassignEquipment));
router.delete('/:id/staff/:userId', requireRole('admin'), wrap(ctrl.removeStaff));

module.exports = router;
