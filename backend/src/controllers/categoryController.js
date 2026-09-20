// src/controllers/categoryController.js
// หมวดหมู่อุปกรณ์ — อ่านได้ทุกคน เขียนได้เฉพาะ staff/admin

const { categoryModel } = require('db');
const { badRequest, notFound, conflict } = require('../utils/HttpError');

function parseInput(body) {
  const { name, description } = body;

  if (typeof name !== 'string' || !name.trim()) {
    throw badRequest('กรุณากรอกชื่อหมวดหมู่');
  }
  if (name.trim().length > 100) {
    throw badRequest('ชื่อหมวดหมู่ยาวเกิน 100 ตัวอักษร');
  }

  return {
    name: name.trim(),
    description:
      typeof description === 'string' && description.trim() ? description.trim() : null
  };
}

// id เป็น bigserial — ต้องเป็นจำนวนเต็มบวก
function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound('ไม่พบหมวดหมู่');
  return id;
}

// unique index เป็น lower(trim(name)) — ชนแล้ว postgres ตอบ 23505
//
// drizzle ห่อ error ของ postgres ไว้อีกชั้น (DrizzleQueryError) โค้ดจริงจึงอยู่ที่
// err.cause ไม่ใช่ err ตรงๆ ถ้าเช็คแค่ชั้นนอกจะกลายเป็น 500 แทนที่จะเป็น 409
function asConflict(err) {
  const code = err?.code ?? err?.cause?.code;
  if (code === '23505') {
    return conflict('มีหมวดหมู่ชื่อนี้อยู่แล้ว');
  }
  return err;
}

const categoryController = {
  // GET /api/categories
  async list(req, res) {
    res.json(await categoryModel.listAll());
  },

  // POST /api/categories
  async create(req, res) {
    const input = parseInput(req.body);
    try {
      res.status(201).json(await categoryModel.create(input));
    } catch (err) {
      throw asConflict(err);
    }
  },

  // PUT /api/categories/:id
  async update(req, res) {
    const id = parseId(req.params.id);
    if (!await categoryModel.findById(id)) throw notFound('ไม่พบหมวดหมู่');

    const input = parseInput(req.body);
    try {
      res.json(await categoryModel.update(id, input));
    } catch (err) {
      throw asConflict(err);
    }
  },

  // DELETE /api/categories/:id
  // ลบได้เสมอ อุปกรณ์ในหมวดนี้จะกลายเป็น "ไม่ระบุหมวดหมู่"
  async remove(req, res) {
    const id = parseId(req.params.id);
    if (!await categoryModel.findById(id)) throw notFound('ไม่พบหมวดหมู่');

    const affected = await categoryModel.remove(id);
    res.json({ ok: true, unassigned: affected });
  }
};

module.exports = categoryController;
