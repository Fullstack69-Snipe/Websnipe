// src/controllers/equipmentController.js
// ตรงกับ mockApi: listEquipment / createEquipment / updateEquipment / deleteEquipment

const equipmentModel = require('../models/equipmentModel');
const { badRequest, notFound, conflict } = require('../utils/HttpError');

// ตรวจ EquipmentInput = { name, description, imageUrl, quantity }
function parseInput(body) {
  const { name, description, imageUrl, quantity } = body;

  if (typeof name !== 'string' || !name.trim()) {
    throw badRequest('กรุณากรอกชื่ออุปกรณ์');
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 0) {
    throw badRequest('จำนวนต้องเป็นจำนวนเต็มไม่ติดลบ');
  }

  return {
    name: name.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    // imageUrl เป็น string | null ตาม types.ts
    imageUrl: typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null,
    quantity: qty
  };
}

const equipmentController = {
  // GET /api/equipment
  list(req, res) {
    res.json(equipmentModel.listAll());
  },

  // GET /api/equipment/:id
  getOne(req, res) {
    const item = equipmentModel.findById(req.params.id);
    if (!item) throw notFound('ไม่พบอุปกรณ์');
    res.json(item);
  },

  // POST /api/equipment
  create(req, res) {
    const input = parseInput(req.body);
    res.status(201).json(equipmentModel.create(input));
  },

  // PUT /api/equipment/:id
  update(req, res) {
    const { id } = req.params;
    if (!equipmentModel.findById(id)) throw notFound('ไม่พบอุปกรณ์');

    const input = parseInput(req.body);

    // กันลดจำนวนต่ำกว่าที่ถูกยืมอยู่ (ข้อความเดียวกับ mockApi)
    const holding = equipmentModel.borrowedCount(id);
    if (input.quantity < holding) {
      throw conflict(`ลดจำนวนไม่ได้ ตอนนี้ถูกยืมอยู่ ${holding} ชิ้น`);
    }

    res.json(equipmentModel.update(id, input));
  },

  // DELETE /api/equipment/:id
  remove(req, res) {
    const { id } = req.params;
    if (!equipmentModel.findById(id)) throw notFound('ไม่พบอุปกรณ์');

    if (equipmentModel.borrowedCount(id) > 0) {
      throw conflict('อุปกรณ์กำลังถูกยืมอยู่ ลบไม่ได้');
    }

    equipmentModel.remove(id);
    res.status(204).end();
  }
};

module.exports = equipmentController;
