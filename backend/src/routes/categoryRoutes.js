// src/routes/categoryRoutes.js
const express = require('express');
const ctrl = require('../controllers/categoryController');
const { requireRole } = require('../middleware/identity');
const wrap = require('../utils/wrap');

const router = express.Router();

// อ่านได้ทุก role (หน้ารายการอุปกรณ์ใช้ทำตัวกรอง)
router.get('/', wrap(ctrl.list));

router.post('/', requireRole('staff', 'admin'), wrap(ctrl.create));
router.put('/:id', requireRole('staff', 'admin'), wrap(ctrl.update));
router.delete('/:id', requireRole('staff', 'admin'), wrap(ctrl.remove));

module.exports = router;
