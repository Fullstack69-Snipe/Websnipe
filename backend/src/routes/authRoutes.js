// src/routes/authRoutes.js
// เส้นทางกลุ่มนี้ต้องอยู่ "ก่อน" attachIdentity เพราะยังไม่มีตัวตนตอนเรียก

const express = require('express');
const ctrl = require('../controllers/authController');
const wrap = require('../utils/wrap');

const router = express.Router();

// หน้า sign-in เรียกดูว่ามีช่องทางไหนเปิดใช้บ้าง
router.get('/providers', wrap(ctrl.providers));

router.post('/logout', wrap(ctrl.logout));

// :provider = google | github
router.get('/:provider', wrap(ctrl.start));
router.get('/:provider/callback', wrap(ctrl.callback));

module.exports = router;
