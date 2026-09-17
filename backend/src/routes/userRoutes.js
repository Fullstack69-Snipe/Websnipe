// src/routes/userRoutes.js
const express = require('express');
const ctrl = require('../controllers/userController');
const { requireRole } = require('../middleware/identity');
const wrap = require('../utils/wrap');

const router = express.Router();

// จัดการผู้ใช้ = เฉพาะ admin
router.get('/', requireRole('admin'), wrap(ctrl.list));
router.put('/:id/role', requireRole('admin'), wrap(ctrl.updateRole));

module.exports = router;
