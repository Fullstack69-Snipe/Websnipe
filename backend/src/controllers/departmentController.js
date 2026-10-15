// src/controllers/departmentController.js
// แผนก — ทุกคนดูรายการได้ สร้าง/มอบหมายได้เฉพาะ admin

const { departmentModel, equipmentModel, userModel } = require('db');
const { badRequest, notFound, conflict } = require('../utils/HttpError');

function parseId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw badRequest('รหัสแผนกไม่ถูกต้อง');
  return id;
}

// drizzle ห่อ error ของ postgres ไว้ชั้นหนึ่ง โค้ดจริงอยู่ที่ err.cause (เหมือน categoryController)
function asConflict(err) {
  return (err?.code ?? err?.cause?.code) === '23505' ? conflict('ชื่อแผนกซ้ำ') : err;
}

function parseName(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) throw badRequest('ชื่อแผนกต้องมี 1–120 ตัวอักษร');
  return name;
}

async function findDepartment(value) {
  const department = await departmentModel.findById(parseId(value));
  if (!department) throw notFound('ไม่พบแผนก');
  return department;
}

module.exports = {
  // GET /api/departments
  // รายชื่อ/อีเมลเจ้าหน้าที่ให้เห็นเฉพาะ admin — ผู้ยืมใช้แค่ชื่อแผนกไปเลือกดูของ
  async list(req, res) {
    const departments = await departmentModel.listAll();
    res.json(
      req.role === 'admin'
        ? departments
        : departments.map((d) => ({ ...d, staff: [] }))
    );
  },

  // POST /api/departments
  async create(req, res) {
    const department = await departmentModel.create(parseName(req.body));
    if (!department) throw conflict('ชื่อแผนกซ้ำ');
    res.status(201).json(department);
  },

  // PUT /api/departments/:id — แก้ชื่อ
  async rename(req, res) {
    const department = await findDepartment(req.params.id);
    try {
      res.json(await departmentModel.rename(department.id, parseName(req.body)));
    } catch (err) {
      throw asConflict(err);
    }
  },

  // DELETE /api/departments/:id — อุปกรณ์ในแผนกกลายเป็นไม่สังกัดแผนก (ไม่ถูกลบ)
  async remove(req, res) {
    const department = await findDepartment(req.params.id);
    res.json({ ok: true, unassigned: await departmentModel.remove(department.id) });
  },

  // GET /api/departments/:id/equipment — หน้าตาเดียวกับ GET /api/equipment
  async equipment(req, res) {
    const department = await findDepartment(req.params.id);
    res.json(await equipmentModel.listAll({ departmentId: department.id }));
  },

  // PUT /api/departments/:id/equipment/:equipmentId
  async assignEquipment(req, res) {
    const department = await findDepartment(req.params.id);
    const { equipmentId } = req.params;
    if (!await equipmentModel.findById(equipmentId)) throw notFound('ไม่พบอุปกรณ์');

    await departmentModel.assignEquipment(department.id, equipmentId);
    res.json({ equipmentId, departmentId: department.id });
  },

  // PUT /api/departments/:id/staff/:userId
  async assignStaff(req, res) {
    const department = await findDepartment(req.params.id);
    const { userId } = req.params;
    if (!await userModel.findById(userId)) throw notFound('ไม่พบผู้ใช้');

    await departmentModel.assignStaff(department.id, userId);
    res.json({ userId, departmentId: department.id });
  },

  // DELETE /api/departments/:id/staff/:userId
  async removeStaff(req, res) {
    const department = await findDepartment(req.params.id);
    await departmentModel.removeStaff(department.id, req.params.userId);
    res.status(204).end();
  },

  // DELETE /api/departments/:id/equipment/:equipmentId — กลับเป็นไม่สังกัดแผนก
  async unassignEquipment(req, res) {
    const department = await findDepartment(req.params.id);
    await departmentModel.unassignEquipment(department.id, req.params.equipmentId);
    res.status(204).end();
  },
};
