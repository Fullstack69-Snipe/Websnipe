// src/controllers/equipmentController.js
// ตรงกับ mockApi: listEquipment / createEquipment / updateEquipment / deleteEquipment

const equipmentModel = require('../models/equipmentModel');
const { logModel } = require('db');
const { badRequest, notFound, conflict } = require('../utils/HttpError');

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

  // POST /api/equipment
  async create(req, res) {
    const input = parseInput(req.body);
    res.status(201).json(await equipmentModel.create(input, req.user));
  },

  // PUT /api/equipment/:id
  async update(req, res) {
    const { id } = req.params;
    if (!await equipmentModel.findById(id)) throw notFound('ไม่พบอุปกรณ์');

    const input = parseInput(req.body);

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

    res.json(await logModel.listByEquipment(id));
  },

  // DELETE /api/equipment/:id
  async remove(req, res) {
    const { id } = req.params;
    if (!await equipmentModel.findById(id)) throw notFound('ไม่พบอุปกรณ์');

    if (await equipmentModel.borrowedCount(id) > 0) {
      throw conflict('อุปกรณ์กำลังถูกยืมอยู่ ลบไม่ได้');
    }

    await equipmentModel.remove(id, req.user);
    res.status(204).end();
  }
};

module.exports = equipmentController;
