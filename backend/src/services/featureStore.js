// Backend-owned extension tables. No changes to the shared db package.
const { dbConn: sql } = require('db');
let ready;
function init() {
  if (!ready) ready = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS ws_departments (
      id BIGSERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS ws_equipment_departments (
      equipment_id VARCHAR(64) PRIMARY KEY REFERENCES equipment(id) ON DELETE CASCADE,
      department_id BIGINT NOT NULL REFERENCES ws_departments(id) ON DELETE RESTRICT)`;
    await sql`CREATE TABLE IF NOT EXISTS ws_staff_departments (
      user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      department_id BIGINT NOT NULL REFERENCES ws_departments(id) ON DELETE CASCADE,
      PRIMARY KEY(user_id, department_id))`;
    await sql`CREATE TABLE IF NOT EXISTS ws_borrow_details (
      borrow_id VARCHAR(64) PRIMARY KEY REFERENCES borrows(id) ON DELETE CASCADE,
      start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ NOT NULL,
      picked_up_at TIMESTAMPTZ, picked_up_by VARCHAR(64) REFERENCES users(id),
      CHECK (end_at > start_at))`;
    await sql`CREATE INDEX IF NOT EXISTS ws_borrow_period_idx ON ws_borrow_details(start_at, end_at)`;
  })().catch(err => { ready = undefined; throw err; });
  return ready;
}
const one = rows => rows[0] || null;
async function equipmentDepartment(id) { await init(); return one(await sql`SELECT department_id AS "departmentId" FROM ws_equipment_departments WHERE equipment_id=${id}`); }
async function assertStaffAccess(user, equipmentId) {
  if (user.role === 'admin') return;
  const dep = await equipmentDepartment(equipmentId);
  if (!dep) return; // Unassigned equipment remains accessible to all staff (legacy).
  const rows = await sql`SELECT 1 FROM ws_staff_departments WHERE user_id=${user.id} AND department_id=${dep.departmentId}`;
  if (!rows.length) { const { forbidden } = require('../utils/HttpError'); throw forbidden('เจ้าหน้าที่ไม่มีสิทธิ์จัดการอุปกรณ์ของแผนกนี้'); }
}
async function detail(id) { await init(); return one(await sql`SELECT borrow_id AS "borrowId", start_at AS "startAt", end_at AS "endAt", picked_up_at AS "pickedUpAt", picked_up_by AS "pickedUpBy" FROM ws_borrow_details WHERE borrow_id=${id}`); }
async function decorate(b) { if (!b) return b; return { ...b, details: await detail(b.id) }; }
async function overlap(equipmentId, startAt, endAt, excludeId = '') {
  await init();
  const rows = await sql`SELECT COUNT(*)::int AS n FROM ws_borrow_details d JOIN borrows b ON b.id=d.borrow_id WHERE b.equipment_id=${equipmentId} AND b.id<>${excludeId} AND b.status IN ('approved','returning') AND d.start_at < ${endAt} AND d.end_at > ${startAt}`;
  return rows[0].n;
}
module.exports = { sql, init, equipmentDepartment, assertStaffAccess, detail, decorate, overlap };
