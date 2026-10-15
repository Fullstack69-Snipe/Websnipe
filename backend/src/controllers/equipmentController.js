// src/controllers/equipmentController.js
// ตรงกับ mockApi: listEquipment / createEquipment / updateEquipment / deleteEquipment

const equipmentModel = require('../models/equipmentModel');
const { logModel, departmentModel, borrowModel } = require('db');
const { badRequest, notFound, conflict } = require('../utils/HttpError');
const { assertCanManage } = require('../middleware/identity');

// ตรวจ EquipmentInput = { name, description, imageUrl, quantity }
function parseInput(body) {
  const { name, description, imageUrl, quantity, categoryId } = body;

  if (typeof name !== 'string' || !name.trim()) {
    throw badRequest('กรุณากรอกชื่ออุปกรณ์');
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 0) {
    throw badRequest('จำนวนต้องเป็นจำนวนเต็มไม่ติดลบ');
  }

  // categoryId ไม่บังคับ — null = ไม่ระบุหมวดหมู่
  let category = null;
  if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
    category = Number(categoryId);
    if (!Number.isInteger(category) || category <= 0) {
      throw badRequest('หมวดหมู่ไม่ถูกต้อง');
    }
  }

  return {
    name: name.trim(),
    categoryId: category,
    description: typeof description === 'string' ? description.trim() : '',
    // imageUrl เป็น string | null ตาม types.ts
    imageUrl: typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null,
    quantity: qty
  };
}

// แผนกตั้งได้เฉพาะ admin — staff ส่งมาก็ไม่สนใจ (กันย้ายของออกจากแผนกที่ตัวเองดูแลแล้วจัดการไม่ได้อีก)
// ไม่ส่ง departmentId มาเลย = ไม่แตะแผนกเดิม / null หรือ '' = ไม่สังกัดแผนก
async function withDepartment(input, req) {
  const raw = req.body.departmentId;
  if (req.role !== 'admin' || raw === undefined) return input;
  if (raw === null || raw === '') return { ...input, departmentId: null };

  const departmentId = Number(raw);
  if (!Number.isSafeInteger(departmentId) || departmentId <= 0) throw badRequest('แผนกไม่ถูกต้อง');
  if (!await departmentModel.findById(departmentId)) throw notFound('ไม่พบแผนก');
  return { ...input, departmentId };
}

const equipmentController = {
  // GET /api/equipment
  async list(req, res) {
    res.json(await equipmentModel.listAll());
  },

  // GET /api/equipment/:id
  async getOne(req, res) {
    const item = await equipmentModel.findById(req.params.id);
    if (!item) throw notFound('ไม่พบอุปกรณ์');
    res.json(item);
  },

  // GET /api/equipment/:id/bookings — ช่วงที่ถูกจองแล้ว (ไม่มีชื่อผู้ยืม)
  async bookings(req, res) {
    if (!await equipmentModel.findById(req.params.id)) throw notFound('ไม่พบอุปกรณ์');
    res.json(await borrowModel.bookingsOf(req.params.id));
  },

  // POST /api/equipment
  async create(req, res) {
    const input = await withDepartment(parseInput(req.body), req);
    res.status(201).json(await equipmentModel.create(input, req.user));
  },

  // PUT /api/equipment/:id
  async update(req, res) {
    const { id } = req.params;
    if (!await equipmentModel.findById(id)) throw notFound('ไม่พบอุปกรณ์');

    await assertCanManage(req.user, id);
    const input = await withDepartment(parseInput(req.body), req);

    // กันลดจำนวนต่ำกว่าที่ถูกยืมอยู่ (ข้อความเดียวกับ mockApi)
    const holding = await equipmentModel.borrowedCount(id);
    if (input.quantity < holding) {
      throw conflict(`ลดจำนวนไม่ได้ ตอนนี้ถูกยืมอยู่ ${holding} ชิ้น`);
    }

    res.json(await equipmentModel.update(id, input, req.user));
  },

  // GET /api/equipment/:id/logs — ประวัติของอุปกรณ์ชิ้นนี้
  async logs(req, res) {
    const { id } = req.params;
    if (!await equipmentModel.findById(id)) throw notFound('ไม่พบอุปกรณ์');

    await assertCanManage(req.user, id);
    res.json(await logModel.listByEquipment(id));
  },

  // DELETE /api/equipment/:id
  async remove(req, res) {
    const { id } = req.params;
    if (!await equipmentModel.findById(id)) throw notFound('ไม่พบอุปกรณ์');

    await assertCanManage(req.user, id);
    if (await equipmentModel.borrowedCount(id) > 0) {
      throw conflict('อุปกรณ์กำลังถูกยืมอยู่ ลบไม่ได้');
    }

    await equipmentModel.remove(id, req.user);
    res.status(204).end();
  }
};

module.exports = equipmentController;
