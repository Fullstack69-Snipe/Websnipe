// src/routes/notificationRoutes.js
const express = require('express');
const ctrl = require('../controllers/notificationController');
const { requireRole } = require('../middleware/identity');
const wrap = require('../utils/wrap');

const router = express.Router();

router.get('/', wrap(ctrl.list));
router.put('/read-all', wrap(ctrl.readAll));
router.put('/:id/read', wrap(ctrl.read));
router.post('/reminders', requireRole('admin'), wrap(ctrl.runReminders));

module.exports = router;
