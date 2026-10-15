const { BorrowConflictError } = require('db');
const { assertCanManage } = require('../middleware/identity');
const borrowModel = require('../models/borrowModel');
const equipmentModel = require('../models/equipmentModel');

const {
  badRequest,
  notFound,
  conflict,
  forbidden
} = require('../utils/HttpError');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ต้องมี timezone กำกับ ไม่งั้นแต่ละเครื่องตีความเวลาไม่ตรงกัน
const ISO_TZ_RE = /(Z|[+-]\d{2}:\d{2})$/;

function parseIso(value, field) {
  const date = typeof value === 'string' && ISO_TZ_RE.test(value)
    ? new Date(value)
    : new Date(NaN);

  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} ต้องเป็น ISO datetime พร้อม timezone`);
  }
  return date;
}

// "วันนี้" ต้องเป็นวันที่ตามเวลาไทย ไม่ใช่ UTC
// ไม่งั้นช่วงเที่ยงคืนถึงตีเจ็ด ระบบจะยังถือว่าเป็นเมื่อวาน และยอมให้ใส่วันครบกำหนดย้อนหลังได้
// en-CA จัดรูปแบบเป็น YYYY-MM-DD พอดี
const todayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok'
});

const today = () => todayFmt.format(new Date());

const CONFLICT_MESSAGE = {
  status_changed:
    'รายการนี้ถูกเปลี่ยนสถานะไปแล้ว กรุณารีเฟรชหน้า',
  unavailable:
    'อุปกรณ์ถูกจองเต็มในช่วงเวลานี้',
  already_picked_up:
    'รายการนี้รับอุปกรณ์แล้ว หรือไม่มีข้อมูลช่วงเวลายืม'
};

// model ตรวจสถานะซ้ำหลังล็อกแถว (กันสองคนกดพร้อมกัน)
// ถ้าแพ้จังหวะจะโยน BorrowConflictError — แปลงเป็น 409 ตรงนี้
async function transition(promise) {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof BorrowConflictError) {
      throw conflict(CONFLICT_MESSAGE[err.reason]);
    }
    throw err;
  }
}

const borrowController = {

  // =========================================
  // ฝั่งผู้ยืม
  // =========================================

  // POST /api/borrows
  // ส่ง startAt/endAt หรือ dueDate อย่างเดียวแบบเดิมก็ได้ (= เริ่มตอนนี้ ถึงสิ้นวัน dueDate เวลาไทย)
  async create(req, res) {
    const { equipmentId } = req.body;

    if (!equipmentId) {
      throw badRequest('กรุณาระบุอุปกรณ์');
    }

    const startAt = req.body.startAt === undefined
      ? new Date()
      : parseIso(req.body.startAt, 'startAt');
    const endAt = req.body.endAt === undefined
      ? undefined
      : parseIso(req.body.endAt, 'endAt');
    const dueDate = endAt ? todayFmt.format(endAt) : req.body.dueDate;

    if (!DATE_RE.test(dueDate ?? '')) {
      throw badRequest(
        'กรุณาระบุวันครบกำหนดคืนในรูปแบบ YYYY-MM-DD'
      );
    }

    if (dueDate < today()) {
      throw badRequest(
        'วันครบกำหนดคืนต้องไม่ใช่วันที่ผ่านมาแล้ว'
      );
    }

    if (todayFmt.format(startAt) < today()) {
      throw badRequest(
        'วันเริ่มยืมต้องไม่ใช่วันที่ผ่านมาแล้ว'
      );
    }

    const end = endAt ?? new Date(`${dueDate}T23:59:59+07:00`);

    if (end <= startAt) {
      throw badRequest('วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น');
    }

    const item = await equipmentModel.findById(equipmentId);

    if (!item) {
      throw notFound('ไม่พบอุปกรณ์');
    }

    // นับเฉพาะที่จองทับช่วงนี้ ของที่ถูกยืมอยู่ตอนนี้แต่คืนก่อนช่วงนี้ไม่นับ
    if (await borrowModel.bookedCount(equipmentId, startAt, end) >= item.quantity) {
      throw conflict('อุปกรณ์ชิ้นนี้ถูกยืมหมดแล้ว');
    }

    const borrow = await borrowModel.create(
      {
        equipmentId,
        borrowerId: req.user.id,
        dueDate,
        startAt,
        endAt: end,
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
  // ยกเลิกคำขอยืม
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
    res.json(
      await transition(
        borrowModel.setStatus(
          borrow.id,
          'cancelled',
          {
            actor: req.user,
            from: ['pending']
          }
        )
      )
    );
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
      await transition(
        borrowModel.setStatus(
          borrow.id,
          'returning',
          {
            actor: req.user,
            from: ['approved']
          }
        )
      )
    );
  },

  // =========================================
  // ฝั่งเจ้าหน้าที่
  // =========================================

  // GET /api/borrows
  async list(req, res) {
    res.json(
      await borrowModel.listAll(
        req.role === 'admin' ? {} : { staffId: req.user.id }
      )
    );
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

    await assertCanManage(req.user, borrow.equipmentId);

    if (borrow.details && new Date(borrow.details.endAt) <= new Date()) {
      throw conflict('ช่วงเวลาจองสิ้นสุดแล้ว');
    }

    res.json(
      await transition(
        borrowModel.setStatus(
          borrow.id,
          'approved',
          {
            actor: req.user,
            from: ['pending']
          }
        )
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

    await assertCanManage(req.user, borrow.equipmentId);

    const reason =
      typeof req.body.reason === 'string'
        ? req.body.reason.trim() || null
        : null;

    res.json(
      await transition(
        borrowModel.setStatus(
          borrow.id,
          'rejected',
          {
            actor: req.user,
            reason,
            from: ['pending']
          }
        )
      )
    );
  },

  // PUT /api/borrows/:id/pickup
  // ผู้ยืมกดเองว่ารับของแล้ว หรือ staff กดตอนส่งมอบ
  async pickup(req, res) {
    const borrow = await borrowModel.findById(req.params.id);

    if (!borrow) {
      throw notFound('ไม่พบรายการยืม');
    }

    if (borrow.borrowerId !== req.user.id) {
      if (req.role === 'user') {
        throw forbidden('ยืนยันรับของได้เฉพาะรายการของตัวเอง');
      }
      await assertCanManage(req.user, borrow.equipmentId);
    }

    if (borrow.status !== 'approved') {
      throw conflict('ต้องอนุมัติรายการก่อนส่งมอบ');
    }

    res.json(
      await transition(
        borrowModel.pickup(borrow.id, req.user)
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

    await assertCanManage(req.user, borrow.equipmentId);

    const note =
      typeof req.body.note === 'string'
        ? req.body.note.trim() || null
        : null;

    res.json(
      await transition(
        borrowModel.markReturned(
          borrow.id,
          {
            actor: req.user,
            note
          }
        )
      )
    );
  }
};

module.exports = borrowController;
