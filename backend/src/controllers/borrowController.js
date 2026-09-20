// src/controllers/borrowController.js
// ตรงกับ mockApi: requestBorrow / listMyBorrows / requestReturn
//                 listBorrows / approveBorrow / rejectBorrow / confirmReturn

const borrowModel = require('../models/borrowModel');
const equipmentModel = require('../models/equipmentModel');
const { badRequest, notFound, conflict } = require('../utils/HttpError');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const borrowController = {
  // ===== ฝั่งผู้ยืม =====

  // POST /api/borrows   body: { equipmentId, dueDate }
  async create(req, res) {
    const { equipmentId, dueDate } = req.body;

    if (!equipmentId) throw badRequest('กรุณาระบุอุปกรณ์');
    if (!DATE_RE.test(dueDate ?? '')) {
      throw badRequest('กรุณาระบุวันครบกำหนดคืนในรูปแบบ YYYY-MM-DD');
    }

    const item = await equipmentModel.findById(equipmentId);
    if (!item) throw notFound('ไม่พบอุปกรณ์');

    // ข้อความเดียวกับ mockApi
    if (item.available <= 0) throw conflict('อุปกรณ์ชิ้นนี้ถูกยืมหมดแล้ว');

    const today = new Date().toISOString().slice(0, 10);
    if (dueDate < today) throw badRequest('วันครบกำหนดคืนต้องไม่ใช่วันที่ผ่านมาแล้ว');

    const borrow = await borrowModel.create({
      equipmentId,
      borrowerId: req.user.id,   // แทน CURRENT_USER_ID
      dueDate
    });

    res.status(201).json(borrow);
  },

  // GET /api/borrows/mine
  async listMine(req, res) {
    res.json(await borrowModel.listByBorrower(req.user.id));
  },

  // PUT /api/borrows/:id/request-return
  async requestReturn(req, res) {
    const borrow = await borrowModel.findById(req.params.id);
    if (!borrow) throw notFound('ไม่พบรายการยืม');

    // ผู้ยืมแจ้งคืนได้เฉพาะรายการของตัวเอง (staff/admin ทำแทนได้)
    if (borrow.borrowerId !== req.user.id && req.role === 'user') {
      throw conflict('แจ้งคืนได้เฉพาะรายการยืมของตัวเอง');
    }

    if (borrow.status !== 'approved') throw conflict('รายการนี้ยังไม่ได้อยู่ในสถานะยืม');

    res.json(await borrowModel.setStatus(borrow.id, 'returning'));
  },

  // ===== ฝั่ง staff =====

  // GET /api/borrows
  async list(req, res) {
    res.json(await borrowModel.listAll());
  },

  // PUT /api/borrows/:id/approve
  async approve(req, res) {
    const borrow = await borrowModel.findById(req.params.id);
    if (!borrow) throw notFound('ไม่พบรายการยืม');
    if (borrow.status !== 'pending') throw conflict('รายการนี้ไม่ได้รออนุมัติ');

    const item = await equipmentModel.findById(borrow.equipmentId);
    if (item.available <= 0) throw conflict('อุปกรณ์หมดแล้ว ถูกอนุมัติให้คนอื่นไปก่อน');

    // ไม่ต้องแก้ equipment — available คำนวณจาก borrows อยู่แล้ว
    res.json(await borrowModel.setStatus(borrow.id, 'approved'));
  },

  // PUT /api/borrows/:id/reject
  async reject(req, res) {
    const borrow = await borrowModel.findById(req.params.id);
    if (!borrow) throw notFound('ไม่พบรายการยืม');
    if (borrow.status !== 'pending') throw conflict('รายการนี้ไม่ได้รออนุมัติ');

    res.json(await borrowModel.setStatus(borrow.id, 'rejected'));
  },

  // PUT /api/borrows/:id/confirm-return
  async confirmReturn(req, res) {
    const borrow = await borrowModel.findById(req.params.id);
    if (!borrow) throw notFound('ไม่พบรายการยืม');

    if (borrow.status !== 'approved' && borrow.status !== 'returning') {
      throw conflict('รายการนี้ไม่ได้อยู่ระหว่างการยืม');
    }

    res.json(await borrowModel.markReturned(borrow.id));
  }
};

module.exports = borrowController;
