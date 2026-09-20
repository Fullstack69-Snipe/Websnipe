// src/controllers/userController.js
// ตรงกับ mockApi: listUsers / updateUserRole  (+ /me สำหรับหาตัวตนปัจจุบัน)

const userModel = require('../models/userModel');
const { badRequest, notFound } = require('../utils/HttpError');

const VALID_ROLES = ['user', 'staff', 'admin'];

const userController = {
  // GET /api/users
  async list(req, res) {
    res.json(await userModel.listAll());
  },

  // GET /api/me — แทน CURRENT_USER_ID ฝั่ง frontend
  // ส่ง role ที่ใช้ตรวจสิทธิ์จริงกลับไปด้วย (เผื่อถูก override ด้วย header x-role)
  async me(req, res) {
    res.json({ ...req.user, activeRole: req.role });
  },

  // PUT /api/users/:id/role   body: { role }
  async updateRole(req, res) {
    const { role } = req.body;

    if (!VALID_ROLES.includes(role)) {
      throw badRequest(`role ต้องเป็น ${VALID_ROLES.join(' / ')}`);
    }
    if (!await userModel.findById(req.params.id)) throw notFound('ไม่พบผู้ใช้');

    res.json(await userModel.setRole(req.params.id, role));
  }
};

module.exports = userController;
