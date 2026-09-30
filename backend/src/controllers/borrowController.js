
const borrowModel = require('../models/borrowModel');
const equipmentModel = require('../models/equipmentModel');

const {
  badRequest,
  notFound,
  conflict,
  forbidden
} = require('../utils/HttpError');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const borrowController = {

  // =========================================
  // ฝั่งผู้ยืม
  // =========================================

  // POST /api/borrows
  async create(req, res) {
    const { equipmentId, dueDate } = req.body;

    if (!equipmentId) {
      throw badRequest('กรุณาระบุอุปกรณ์');
    }

    if (!DATE_RE.test(dueDate ?? '')) {
      throw badRequest(
        'กรุณาระบุวันครบกำหนดคืนในรูปแบบ YYYY-MM-DD'
      );
    }

    const item = await equipmentModel.findById(equipmentId);

    if (!item) {
      throw notFound('ไม่พบอุปกรณ์');
    }

    if (item.available <= 0) {
      throw conflict('อุปกรณ์ชิ้นนี้ถูกยืมหมดแล้ว');
    }

    const today = new Date().toISOString().slice(0, 10);

    if (dueDate < today) {
      throw badRequest(
        'วันครบกำหนดคืนต้องไม่ใช่วันที่ผ่านมาแล้ว'
      );
    }

    const borrow = await borrowModel.create(
      {
        equipmentId,
        borrowerId: req.user.id,
        dueDate,
        purpose:
          typeof req.body.purpose === 'string'
            ? req.body.purpose.trim() || null
            : null
      },
      req.user
    );

    res.status(201).json(borrow);
  },

  // GET /api/borrows/mine
  async listMine(req, res) {
    const borrows = await borrowModel.listByBorrower(
      req.user.id
    );

    res.json(borrows);
  },

  // =========================================
  // ยกเลิกคำขอยืม (เพิ่มใหม่)
  // =========================================

  // PUT /api/borrows/:id/cancel
  async cancel(req, res) {

    const borrow = await borrowModel.findById(
      req.params.id
    );

    // ตรวจสอบรายการยืม
    if (!borrow) {
      throw notFound('ไม่พบรายการยืม');
    }

    // ตรวจสอบเจ้าของคำขอ
    if (
      String(borrow.borrowerId) !==
      String(req.user.id)
    ) {
      throw forbidden(
        'คุณไม่มีสิทธิ์ยกเลิกคำขอของผู้อื่น'
      );
    }

    // ยกเลิกได้เฉพาะ pending
    if (borrow.status !== 'pending') {
      throw conflict(
        'ยกเลิกได้เฉพาะคำขอที่รออนุมัติเท่านั้น'
      );
    }

    // เปลี่ยนสถานะเป็น cancelled
    const updated = await borrowModel.setStatus(
      borrow.id,
      'cancelled',
      {
        actor: req.user
      }
    );

    res.json({
      message: 'ยกเลิกคำขอยืมสำเร็จ',
      borrow: updated
    });
  },

  // =========================================
  // แจ้งคืนอุปกรณ์
  // =========================================

  // PUT /api/borrows/:id/request-return
  async requestReturn(req, res) {

    const borrow = await borrowModel.findById(
      req.params.id
    );

    if (!borrow) {
      throw notFound('ไม่พบรายการยืม');
    }

    if (
      String(borrow.borrowerId) !==
        String(req.user.id) &&
      req.role === 'user'
    ) {
      throw conflict(
        'แจ้งคืนได้เฉพาะรายการยืมของตัวเอง'
      );
    }

    if (borrow.status !== 'approved') {
      throw conflict(
        'รายการนี้ยังไม่ได้อยู่ในสถานะยืม'
      );
    }

    res.json(
      await borrowModel.setStatus(
        borrow.id,
        'returning',
        { actor: req.user }
      )
    );
  },

  // =========================================
  // ฝั่งเจ้าหน้าที่
  // =========================================

  // GET /api/borrows
  async list(req, res) {
    res.json(await borrowModel.listAll());
  },

  // PUT /api/borrows/:id/approve
  async approve(req, res) {

    const borrow = await borrowModel.findById(
      req.params.id
    );

    if (!borrow) {
      throw notFound('ไม่พบรายการยืม');
    }

    if (borrow.status !== 'pending') {
      throw conflict(
        'รายการนี้ไม่ได้รออนุมัติ'
      );
    }

    const item = await equipmentModel.findById(
      borrow.equipmentId
    );

    if (item.available <= 0) {
      throw conflict(
        'อุปกรณ์หมดแล้ว ถูกอนุมัติให้คนอื่นไปก่อน'
      );
    }

    res.json(
      await borrowModel.setStatus(
        borrow.id,
        'approved',
        { actor: req.user }
      )
    );
  },

  // PUT /api/borrows/:id/reject
  async reject(req, res) {

    const borrow = await borrowModel.findById(
      req.params.id
    );

    if (!borrow) {
      throw notFound('ไม่พบรายการยืม');
    }

    if (borrow.status !== 'pending') {
      throw conflict(
        'รายการนี้ไม่ได้รออนุมัติ'
      );
    }

    const reason =
      typeof req.body.reason === 'string'
        ? req.body.reason.trim() || null
        : null;

    res.json(
      await borrowModel.setStatus(
        borrow.id,
        'rejected',
        {
          actor: req.user,
          reason
        }
      )
    );
  },

  // PUT /api/borrows/:id/confirm-return
  async confirmReturn(req, res) {

    const borrow = await borrowModel.findById(
      req.params.id
    );

    if (!borrow) {
      throw notFound('ไม่พบรายการยืม');
    }

    if (
      borrow.status !== 'approved' &&
      borrow.status !== 'returning'
    ) {
      throw conflict(
        'รายการนี้ไม่ได้อยู่ระหว่างการยืม'
      );
    }

    const note =
      typeof req.body.note === 'string'
        ? req.body.note.trim() || null
        : null;

    res.json(
      await borrowModel.markReturned(
        borrow.id,
        {
          actor: req.user,
          note
        }
      )
    );
  }
};

module.exports = borrowController;
