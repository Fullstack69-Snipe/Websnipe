// src/routes/qrRoutes.js
const express = require('express');
const ctrl = require('../controllers/qrController');
const wrap = require('../utils/wrap');

const router = express.Router();

router.get('/equipment/:id.svg', wrap(ctrl.svg));

module.exports = router;
