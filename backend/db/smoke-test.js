// db/smoke-test.js
// ทดสอบทุก endpoint เทียบกับสัญญาที่ mockApi.ts กำหนดไว้
// วิธีใช้:  npm run seed:reset && node src/server.js &  แล้ว  node db/smoke-test.js

const BASE = process.env.BASE || 'http://localhost:3000/api';

let pass = 0, fail = 0;

function check(label, cond, extra = '') {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label} ${extra}`); }
}

async function call(method, path, { body, userId = 'u1', role } = {}) {
  const headers = { 'x-user-id': userId };
  if (body) headers['Content-Type'] = 'application/json';
  if (role) headers['x-role'] = role;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const STAFF = { role: 'staff' };

(async () => {
  console.log('\n-- Equipment shape ตรงกับ type Equipment --');
  {
    const { body: list } = await call('GET', '/equipment');
    check('listEquipment คืน array', Array.isArray(list));
    const keys = Object.keys(list[0]).sort().join(',');
    check('field ครบและชื่อตรง', keys === 'available,description,id,imageUrl,name,quantity', `got: ${keys}`);
    check('id เป็น string', typeof list[0].id === 'string');
    const e5 = list.find((e) => e.id === 'e5');
    check('e5 available = 0 (ถูกยืมอยู่)', e5.available === 0, `got ${e5.available}`);
    const e2 = list.find((e) => e.id === 'e2');
    check('e2 available = 2 จาก 3', e2.quantity === 3 && e2.available === 2, `got ${e2.available}`);
    const e4 = list.find((e) => e.id === 'e4');
    check('imageUrl เป็น null ได้', e4.imageUrl === null);
  }

  console.log('\n-- Borrow shape ตรงกับ type Borrow --');
  {
    const { body: mine } = await call('GET', '/borrows/mine');
    const keys = Object.keys(mine[0]).sort().join(',');
    check('field ครบและชื่อตรง',
      keys === 'borrowerId,borrowerName,createdAt,dueDate,equipmentId,equipmentName,id,returnedAt,status',
      `got: ${keys}`);
    check('u1 เห็นแต่รายการตัวเอง', mine.every((b) => b.borrowerId === 'u1'));
    check('เรียงใหม่สุดขึ้นก่อน', mine[0].createdAt >= mine[mine.length - 1].createdAt);
    check('equipmentName ถูก join มาให้', typeof mine[0].equipmentName === 'string' && mine[0].equipmentName.length > 0);
  }

  console.log('\n-- สิทธิ์ตาม role --');
  {
    check('user ดู /borrows ทั้งหมดไม่ได้', (await call('GET', '/borrows')).status === 403);
    check('staff ดู /borrows ได้', (await call('GET', '/borrows', STAFF)).status === 200);
    check('user เพิ่มอุปกรณ์ไม่ได้',
      (await call('POST', '/equipment', { body: { name: 'x', quantity: 1 } })).status === 403);
    check('user ดู /users ไม่ได้', (await call('GET', '/users')).status === 403);
    check('admin ดู /users ได้', (await call('GET', '/users', { userId: 'u3' })).status === 200);
  }

  console.log('\n-- ข้อความ error ตรงกับ mockApi --');
  {
    const r1 = await call('POST', '/borrows', { body: { equipmentId: 'e5', dueDate: '2030-01-01' } });
    check('ยืมของที่หมด -> "อุปกรณ์ชิ้นนี้ถูกยืมหมดแล้ว"', r1.body.error === 'อุปกรณ์ชิ้นนี้ถูกยืมหมดแล้ว', r1.body.error);

    const r2 = await call('PUT', '/equipment/e2', {
      ...STAFF,
      body: { name: 'n', description: '', imageUrl: null, quantity: 0 }
    });
    check('ลดจำนวนต่ำกว่าที่ยืม -> "ลดจำนวนไม่ได้ ตอนนี้ถูกยืมอยู่ 1 ชิ้น"',
      r2.body.error === 'ลดจำนวนไม่ได้ ตอนนี้ถูกยืมอยู่ 1 ชิ้น', r2.body.error);

    const r3 = await call('DELETE', '/equipment/e2', STAFF);
    check('ลบของที่ถูกยืม -> "อุปกรณ์กำลังถูกยืมอยู่ ลบไม่ได้"',
      r3.body.error === 'อุปกรณ์กำลังถูกยืมอยู่ ลบไม่ได้', r3.body.error);

    const r4 = await call('PUT', '/borrows/b1/approve', STAFF);
    check('อนุมัติรายการที่อนุมัติแล้ว -> "รายการนี้ไม่ได้รออนุมัติ"',
      r4.body.error === 'รายการนี้ไม่ได้รออนุมัติ', r4.body.error);

    const r5 = await call('PUT', '/borrows/b3/request-return');
    check('แจ้งคืนรายการที่คืนแล้ว -> "รายการนี้ยังไม่ได้อยู่ในสถานะยืม"',
      r5.body.error === 'รายการนี้ยังไม่ได้อยู่ในสถานะยืม', r5.body.error);

    const r6 = await call('GET', '/equipment/ไม่มีจริง');
    check('หาอุปกรณ์ไม่เจอ -> 404 "ไม่พบอุปกรณ์"', r6.status === 404 && r6.body.error === 'ไม่พบอุปกรณ์');
  }

  console.log('\n-- วงจรการยืมเต็มรูปแบบ --');
  {
    const before = (await call('GET', '/equipment/e3')).body.available;

    const created = await call('POST', '/borrows', { body: { equipmentId: 'e3', dueDate: '2030-01-01' } });
    check('requestBorrow -> 201 status pending', created.status === 201 && created.body.status === 'pending');
    const id = created.body.id;

    const pendingAvail = (await call('GET', '/equipment/e3')).body.available;
    check('pending ยังไม่ตัดจำนวนคงเหลือ', pendingAvail === before, `${before} -> ${pendingAvail}`);

    const approved = await call('PUT', `/borrows/${id}/approve`, STAFF);
    check('approveBorrow -> approved', approved.body.status === 'approved');
    check('อนุมัติแล้วคงเหลือลด 1', (await call('GET', '/equipment/e3')).body.available === before - 1);

    const returning = await call('PUT', `/borrows/${id}/request-return`);
    check('requestReturn -> returning', returning.body.status === 'returning');
    check('แจ้งคืนแล้วยังนับว่าถือของอยู่', (await call('GET', '/equipment/e3')).body.available === before - 1);

    const done = await call('PUT', `/borrows/${id}/confirm-return`, STAFF);
    check('confirmReturn -> returned + มี returnedAt', done.body.status === 'returned' && !!done.body.returnedAt);
    check('รับคืนแล้วคงเหลือกลับมาเท่าเดิม', (await call('GET', '/equipment/e3')).body.available === before);
  }

  console.log('\n-- ปฏิเสธคำขอ --');
  {
    const created = await call('POST', '/borrows', { body: { equipmentId: 'e6', dueDate: '2030-01-01' } });
    const before = (await call('GET', '/equipment/e6')).body.available;
    const rejected = await call('PUT', `/borrows/${created.body.id}/reject`, STAFF);
    check('rejectBorrow -> rejected', rejected.body.status === 'rejected');
    check('ปฏิเสธแล้วไม่กระทบจำนวนคงเหลือ', (await call('GET', '/equipment/e6')).body.available === before);
  }

  console.log('\n-- CRUD อุปกรณ์ --');
  {
    const created = await call('POST', '/equipment', {
      ...STAFF,
      body: { name: 'ของใหม่', description: 'ทดสอบ', imageUrl: null, quantity: 3 }
    });
    check('createEquipment -> 201 + คำนวณ available ให้', created.status === 201 && created.body.available === 3);
    check('id ที่สร้างเป็น uuid string', typeof created.body.id === 'string' && created.body.id.length > 20);

    const id = created.body.id;
    const updated = await call('PUT', `/equipment/${id}`, {
      ...STAFF,
      body: { name: 'แก้ชื่อ', description: 'd', imageUrl: '/uploads/x.png', quantity: 7 }
    });
    check('updateEquipment แก้ได้ทุก field',
      updated.body.name === 'แก้ชื่อ' && updated.body.quantity === 7 && updated.body.imageUrl === '/uploads/x.png');

    check('deleteEquipment -> 204', (await call('DELETE', `/equipment/${id}`, STAFF)).status === 204);
    check('ลบแล้วหาไม่เจอ', (await call('GET', `/equipment/${id}`)).status === 404);
  }

  console.log('\n-- admin จัดการ role --');
  {
    const r = await call('PUT', '/users/u4/role', { userId: 'u3', body: { role: 'staff' } });
    check('updateUserRole สำเร็จ', r.body.role === 'staff');
    check('field ตรงกับ type User', Object.keys(r.body).sort().join(',') === 'email,fullName,id,role');
    await call('PUT', '/users/u4/role', { userId: 'u3', body: { role: 'user' } });

    const bad = await call('PUT', '/users/u4/role', { userId: 'u3', body: { role: 'wizard' } });
    check('role ที่ไม่ถูกต้อง -> 400', bad.status === 400);
  }

  console.log(`\n${'='.repeat(46)}`);
  console.log(`ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
  console.log('='.repeat(46));
  process.exit(fail > 0 ? 1 : 0);
})();
