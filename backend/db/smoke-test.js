// db/smoke-test.js
// ทดสอบทุก endpoint เทียบกับสัญญาที่ mockApi.ts กำหนดไว้
// วิธีใช้:  npm run seed:reset && node src/server.js &  แล้ว  node db/smoke-test.js

// รันจากเครื่องตัวเอง (นอก container) ให้ชี้ไป localhost ที่ compose เปิดพอร์ตไว้
// ต้องตั้งก่อน require('db') เพราะ dotenv จะไม่ทับค่าที่มีอยู่แล้ว
process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';

// อ้างไปที่ build ของแพ็กเกจ db ตรงๆ แทน require('db')
// เพราะ pnpm คัดลอกแพ็กเกจแบบ file: ไว้ตอน install ถ้า rebuild db แล้วไม่ install ใหม่
// สำเนานั้นจะเก่าค้าง เทสต์จะพังแบบงงๆ — อ้างตรงไปที่ dist ชัวร์กว่า
const { authModel, dbConn } = require('../../db/dist/cjs/db/index.js');

const BASE = process.env.BASE || 'http://localhost:3000/api';

// ตอนนี้ระบบใช้ session cookie ไม่มี header x-user-id / x-role แล้ว
// เทสต์จึงสร้าง session ตรงเข้าฐานข้อมูลแทนการเดินผ่าน OAuth จริง
// (ไม่ได้เปิดช่องทางลัดใดๆ ใน backend — แค่ใช้สิทธิ์เข้าถึง DB ที่เทสต์มีอยู่แล้ว)
const SESSION_FOR = { user: 'u1', staff: 'u2', admin: 'u3', user2: 'u4' };
const cookies = {};

async function createSessions() {
  for (const [as, userId] of Object.entries(SESSION_FOR)) {
    const { token } = await authModel.createSession(userId);
    cookies[as] = `pf_session=${token}`;
  }
}

let pass = 0, fail = 0;

function check(label, cond, extra = '') {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label} ${extra}`); }
}

async function call(method, path, { body, as = 'user' } = {}) {
  const headers = { Cookie: cookies[as] };
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const STAFF = { as: 'staff' };
const EQUIPMENT_KEYS =
  'available,categoryId,categoryName,departmentId,departmentName,description,id,imageUrl,name,quantity';

(async () => {
  await createSessions();
  console.log('\n-- Equipment shape ตรงกับ type Equipment --');
  {
    const { body: list } = await call('GET', '/equipment');
    check('listEquipment คืน array', Array.isArray(list));
    const keys = Object.keys(list[0]).sort().join(',');
    check('field ครบและชื่อตรง', keys === EQUIPMENT_KEYS, `got: ${keys}`);
    check('id เป็น string', typeof list[0].id === 'string');
    const e5 = list.find((e) => e.id === 'e5');
    check('e5 available = 0 (ถูกยืมอยู่)', e5.available === 0, `got ${e5.available}`);
    const e2 = list.find((e) => e.id === 'e2');
    // ไม่ยึดตัวเลขตายตัว เพราะฐานข้อมูลที่ใช้จริงอาจมีรายการยืมอื่นปนอยู่
    // ขอแค่ให้ available สอดคล้องกับ quantity และอยู่ในช่วงที่เป็นไปได้
    check('e2 available สมเหตุสมผลกับ quantity',
      e2.quantity === 3 && e2.available >= 0 && e2.available <= e2.quantity,
      `quantity=${e2.quantity} available=${e2.available}`);
    check('imageUrl เป็น string หรือ null', list.every((e) => typeof e.imageUrl === 'string' || e.imageUrl === null));
  }

  console.log('\n-- Borrow shape ตรงกับ type Borrow --');
  {
    const { body: mine } = await call('GET', '/borrows/mine');
    const keys = Object.keys(mine[0]).sort().join(',');
    check('field ครบและชื่อตรง',
      keys === 'approvedAt,approvedBy,approverName,borrowerId,borrowerName,createdAt,details,dueDate,equipmentId,equipmentName,id,purpose,receivedBy,rejectReason,returnNote,returnedAt,status',
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
    check('admin ดู /users ได้', (await call('GET', '/users', { as: 'admin' })).status === 200);
  }

  console.log('\n-- ข้อความ error ตรงกับ mockApi --');
  {
    const r1 = await call('POST', '/borrows', { body: { equipmentId: 'e5', dueDate: '2030-01-01' } });
    check('ยืมของที่หมด -> "อุปกรณ์ชิ้นนี้ถูกยืมหมดแล้ว"', r1.body.error === 'อุปกรณ์ชิ้นนี้ถูกยืมหมดแล้ว', r1.body.error);

    const r2 = await call('PUT', '/equipment/e2', {
      ...STAFF,
      body: { name: 'n', description: '', imageUrl: null, quantity: 0 }
    });
    // จำนวนในข้อความขึ้นกับข้อมูลจริง จึงเทียบด้วย regexp แทนข้อความเต็ม
    check('ลดจำนวนต่ำกว่าที่ยืม -> บอกจำนวนที่ถูกยืมอยู่',
      /^ลดจำนวนไม่ได้ ตอนนี้ถูกยืมอยู่ \d+ ชิ้น$/.test(r2.body.error ?? ''), r2.body.error);

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

  console.log('\n-- ยกเลิกคำขอ --');
  {
    const before = (await call('GET', '/equipment/e3')).body.available;
    const created = await call('POST', '/borrows', { body: { equipmentId: 'e3', dueDate: '2030-01-01' } });
    const id = created.body.id;

    check('staff ยกเลิกคำขอของคนอื่นไม่ได้ -> 403',
      (await call('PUT', `/borrows/${id}/cancel`, STAFF)).status === 403);

    const cancelled = await call('PUT', `/borrows/${id}/cancel`);
    check('cancelBorrow -> คืน Borrow สถานะ cancelled',
      cancelled.status === 200 && cancelled.body.id === id && cancelled.body.status === 'cancelled',
      JSON.stringify(cancelled.body));
    check('ยกเลิกแล้วไม่กระทบจำนวนคงเหลือ', (await call('GET', '/equipment/e3')).body.available === before);

    const again = await call('PUT', `/borrows/${id}/cancel`);
    check('ยกเลิกซ้ำ -> "ยกเลิกได้เฉพาะคำขอที่รออนุมัติเท่านั้น"',
      again.status === 409 && again.body.error === 'ยกเลิกได้เฉพาะคำขอที่รออนุมัติเท่านั้น', again.body.error);

    const approve = await call('PUT', `/borrows/${id}/approve`, STAFF);
    check('อนุมัติรายการที่ยกเลิกแล้ว -> 409', approve.status === 409, approve.body.error);

    const { body: logs } = await call('GET', '/equipment/e3/logs', STAFF);
    check('บันทึก borrow_cancelled ลงประวัติ',
      logs.some((l) => l.borrowId === id && l.action === 'borrow_cancelled' && l.toStatus === 'cancelled'));
  }

  console.log('\n-- กดพร้อมกัน --');
  {
    const { body: item } = await call('POST', '/equipment', {
      ...STAFF,
      body: { name: 'ชิ้นเดียว', description: '', imageUrl: null, quantity: 1 }
    });
    // ยิงหลายคำขอพร้อมกัน — ถ้าแค่สองคำขอ จังหวะมักไม่ซ้อนกันจริง เทสต์จะผ่านทั้งที่โค้ดมีปัญหา
    const ids = [];
    for (let i = 0; i < 5; i++) {
      ids.push((await call('POST', '/borrows', { body: { equipmentId: item.id, dueDate: '2030-01-01' } })).body.id);
    }

    const results = await Promise.all(ids.map((id) => call('PUT', `/borrows/${id}/approve`, STAFF)));
    const won = ids.filter((_, i) => results[i].status === 200);
    check('อนุมัติชิ้นสุดท้ายพร้อมกันหลายคำขอ -> ผ่านแค่หนึ่ง',
      won.length === 1 && results.every((r) => r.status === 200 || r.status === 409),
      results.map((r) => r.status).join(','));
    const avail = (await call('GET', `/equipment/${item.id}`)).body.available;
    check('คงเหลือไม่ติดลบ', avail === 0, `available=${avail}`);

    for (const id of won) await call('PUT', `/borrows/${id}/confirm-return`, STAFF);

    // ผู้ยืมกดยกเลิกจังหวะเดียวกับที่ staff กดอนุมัติ — ต้องสำเร็จแค่ฝั่งเดียว
    const c = (await call('POST', '/borrows', { body: { equipmentId: item.id, dueDate: '2030-01-01' } })).body.id;
    const [cancel, approve] = await Promise.all([
      call('PUT', `/borrows/${c}/cancel`),
      call('PUT', `/borrows/${c}/approve`, STAFF),
    ]);
    const final = (await call('GET', '/borrows', STAFF)).body.find((x) => x.id === c).status;
    check('ยกเลิกกับอนุมัติพร้อมกัน -> สำเร็จฝั่งเดียว และสถานะตรงกับฝั่งที่ชนะ',
      [cancel.status, approve.status].sort().join(',') === '200,409' &&
        final === (cancel.status === 200 ? 'cancelled' : 'approved'),
      `cancel=${cancel.status} approve=${approve.status} final=${final}`);
    if (final === 'approved') await call('PUT', `/borrows/${c}/confirm-return`, STAFF);

    await call('DELETE', `/equipment/${item.id}`, STAFF);
  }

  console.log('\n-- วันครบกำหนดคิดตามเวลาไทย --');
  {
    const bangkok = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' });
    const today = bangkok.format(new Date());
    const yesterday = bangkok.format(new Date(Date.now() - 24 * 60 * 60 * 1000));

    const ok = await call('POST', '/borrows', { body: { equipmentId: 'e3', dueDate: today } });
    check('คืนภายในวันนี้ (เวลาไทย) ได้', ok.status === 201, ok.body.error);
    if (ok.status === 201) await call('PUT', `/borrows/${ok.body.id}/cancel`);

    const past = await call('POST', '/borrows', { body: { equipmentId: 'e3', dueDate: yesterday } });
    check('เมื่อวาน (เวลาไทย) -> 400', past.status === 400, past.body.error);
  }

  const at = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const ADMIN = { as: 'admin' };
  const { body: booked } = await call('POST', '/equipment', {
    ...STAFF,
    body: { name: 'จองล่วงหน้า', description: '', imageUrl: null, quantity: 1 }
  });
  const borrowWindow = (from, to, as = 'user') =>
    call('POST', '/borrows', { as, body: { equipmentId: booked.id, startAt: at(from), endAt: at(to) } });

  console.log('\n-- ช่วงเวลายืม --');
  let current, future;
  {
    const now = await borrowWindow(0, 2);
    check('ยืมแบบมีช่วงเวลา -> 201 + details', now.status === 201 && now.body.details?.startAt && now.body.details.pickedUpAt === null,
      JSON.stringify(now.body));
    current = now.body.id;
    await call('PUT', `/borrows/${current}/approve`, STAFF);
    check('อนุมัติแล้วคงเหลือตอนนี้เป็น 0', (await call('GET', `/equipment/${booked.id}`)).body.available === 0);

    const later = await borrowWindow(7, 9);
    check('ของหมดตอนนี้ แต่จองช่วงสัปดาห์หน้าได้', later.status === 201, later.body.error);
    future = later.body.id;
    check('อนุมัติช่วงที่ไม่ทับกันได้', (await call('PUT', `/borrows/${future}/approve`, STAFF)).status === 200);

    const clash = await borrowWindow(1, 3);
    check('จองทับช่วงที่เต็ม -> "อุปกรณ์ชิ้นนี้ถูกยืมหมดแล้ว"',
      clash.status === 409 && clash.body.error === 'อุปกรณ์ชิ้นนี้ถูกยืมหมดแล้ว', clash.body.error);

    check('เริ่มเมื่อวาน -> 400', (await borrowWindow(-1.5, 2)).status === 400);
    check('สิ้นสุดก่อนเริ่ม -> 400', (await borrowWindow(3, 2)).status === 400);
    const noTz = await call('POST', '/borrows', { body: { equipmentId: booked.id, startAt: '2030-01-01T09:00:00', endAt: at(9) } });
    check('ไม่มี timezone -> 400', noTz.status === 400, noTz.body.error);
  }

  console.log('\n-- รับของ --');
  {
    const other = await call('PUT', `/borrows/${current}/pickup`, { as: 'user2' });
    check('ผู้ใช้อื่นกดรับของแทนไม่ได้ -> 403', other.status === 403, other.body.error);

    const picked = await call('PUT', `/borrows/${current}/pickup`);
    check('ผู้ยืมกดรับของเองได้', picked.status === 200 && !!picked.body.details?.pickedUpAt && picked.body.details.pickedUpBy === 'u1',
      JSON.stringify(picked.body.details ?? picked.body));

    const again = await call('PUT', `/borrows/${current}/pickup`);
    check('กดรับของซ้ำ -> 409', again.status === 409, again.body.error);

    const legacy = await call('PUT', '/borrows/b1/pickup', { as: 'user2' });
    check('รับของรายการที่รับไปแล้ว -> 409', legacy.status === 409, legacy.body.error);

    check('staff กดส่งมอบให้ได้', (await call('PUT', `/borrows/${future}/pickup`, STAFF)).status === 200);

    const { body: logs } = await call('GET', `/equipment/${booked.id}/logs`, STAFF);
    check('บันทึก borrow_picked_up ลงประวัติ', logs.some((l) => l.borrowId === current && l.action === 'borrow_picked_up'));

    await call('PUT', `/borrows/${current}/confirm-return`, STAFF);
    check('คืนแล้ว การจองล่วงหน้าไม่ทำให้คงเหลือตอนนี้เป็น 0',
      (await call('GET', `/equipment/${booked.id}`)).body.available === 1);
  }

  console.log('\n-- แผนก --');
  let departmentId;
  {
    const name = `ทดสอบ ${Date.now()}`;
    const created = await call('POST', '/departments', { ...ADMIN, body: { name } });
    check('admin สร้างแผนก -> 201', created.status === 201 && created.body.name === name);
    departmentId = created.body.id;

    check('ชื่อซ้ำ -> 409', (await call('POST', '/departments', { ...ADMIN, body: { name } })).status === 409);
    check('staff สร้างแผนกไม่ได้ -> 403', (await call('POST', '/departments', { ...STAFF, body: { name: 'x' } })).status === 403);
    check('รหัสแผนกไม่ใช่ตัวเลข -> 400', (await call('GET', '/departments/abc/equipment')).status === 400);
    check('แผนกที่ไม่มี -> 404', (await call('GET', '/departments/999999999/equipment')).status === 404);

    await call('PUT', `/departments/${departmentId}/equipment/${booked.id}`, ADMIN);
    const { body: list } = await call('GET', `/departments/${departmentId}/equipment`);
    check('อุปกรณ์ในแผนกหน้าตาเดียวกับ Equipment',
      list.length === 1 && Object.keys(list[0]).sort().join(',') === EQUIPMENT_KEYS,
      JSON.stringify(list));

    const req = (await borrowWindow(20, 21)).body.id;
    const denied = await call('PUT', `/borrows/${req}/approve`, STAFF);
    check('staff นอกแผนกอนุมัติไม่ได้ -> 403', denied.status === 403, denied.body.error);
    check('staff นอกแผนกไม่เห็นคำขอของแผนกนี้',
      !(await call('GET', '/borrows', STAFF)).body.some((b) => b.id === req));
    check('admin เห็นทุกคำขอ', (await call('GET', '/borrows', ADMIN)).body.some((b) => b.id === req));

    await call('PUT', `/departments/${departmentId}/staff/u2`, ADMIN);
    check('staff ในแผนกเห็นคำขอ', (await call('GET', '/borrows', STAFF)).body.some((b) => b.id === req));
    check('staff ในแผนกอนุมัติได้', (await call('PUT', `/borrows/${req}/approve`, STAFF)).status === 200);
    await call('PUT', `/borrows/${req}/confirm-return`, STAFF);

    const dep = (await call('GET', '/departments', ADMIN)).body.find((d) => d.id === departmentId);
    check('รายการแผนกบอก staff และจำนวนอุปกรณ์',
      dep?.equipmentCount === 1 && dep.staff.some((s) => s.id === 'u2' && s.fullName),
      JSON.stringify(dep));
    const seenByUser = (await call('GET', '/departments')).body.find((d) => d.id === departmentId);
    check('ผู้ยืมเห็นชื่อแผนกแต่ไม่เห็นรายชื่อ/อีเมลเจ้าหน้าที่',
      seenByUser?.name === dep?.name && seenByUser.staff.length === 0);
    check('/me บอกแผนกที่ staff ดูแล',
      (await call('GET', '/me', STAFF)).body.departmentIds?.includes(departmentId));
    const { body: item } = await call('GET', `/equipment/${booked.id}`);
    check('อุปกรณ์บอกชื่อแผนก', item.departmentId === departmentId && item.departmentName === dep?.name);

    check('เอา staff ออกจากแผนก -> 204',
      (await call('DELETE', `/departments/${departmentId}/staff/u2`, ADMIN)).status === 204);
    const req2 = (await borrowWindow(22, 23)).body.id;
    check('เอาออกแล้ว staff อนุมัติไม่ได้อีก',
      (await call('PUT', `/borrows/${req2}/approve`, STAFF)).status === 403);
    await call('PUT', `/borrows/${req2}/cancel`);

    check('เอาอุปกรณ์ออกจากแผนก -> 204',
      (await call('DELETE', `/departments/${departmentId}/equipment/${booked.id}`, ADMIN)).status === 204);
    check('เอาออกแล้วกลับเป็นไม่สังกัดแผนก',
      (await call('GET', `/equipment/${booked.id}`)).body.departmentId === null);
    check('staff สั่งเอาของออกจากแผนกไม่ได้ -> 403',
      (await call('DELETE', `/departments/${departmentId}/equipment/${booked.id}`, STAFF)).status === 403);

    // ตั้งแผนกจากฟอร์มอุปกรณ์ — admin ได้ / staff ส่งมาก็ไม่มีผล
    const form = { name: booked.name, description: '', imageUrl: null, quantity: 1 };
    await call('PUT', `/equipment/${booked.id}`, { ...STAFF, body: { ...form, departmentId } });
    check('staff ตั้งแผนกจากฟอร์มไม่ได้ (ไม่มีผล)',
      (await call('GET', `/equipment/${booked.id}`)).body.departmentId === null);
    const set = await call('PUT', `/equipment/${booked.id}`, { ...ADMIN, body: { ...form, departmentId } });
    check('admin ตั้งแผนกจากฟอร์มได้', set.body.departmentId === departmentId, JSON.stringify(set.body));
    const keep = await call('PUT', `/equipment/${booked.id}`, { ...ADMIN, body: form });
    check('แก้อุปกรณ์โดยไม่ส่ง departmentId = แผนกเดิมไม่หาย', keep.body.departmentId === departmentId);
    check('แผนกที่ไม่มีอยู่ -> 404',
      (await call('PUT', `/equipment/${booked.id}`, { ...ADMIN, body: { ...form, departmentId: 999999999 } })).status === 404);

    // แก้ชื่อ / ลบแผนก
    const renamed = await call('PUT', `/departments/${departmentId}`, { ...ADMIN, body: { name: `${name} (ใหม่)` } });
    check('admin แก้ชื่อแผนกได้', renamed.status === 200 && renamed.body.name === `${name} (ใหม่)`, JSON.stringify(renamed.body));
    const other = (await call('GET', '/departments', ADMIN)).body.find((d) => d.id !== departmentId);
    if (other) {
      check('แก้เป็นชื่อที่ซ้ำ -> 409',
        (await call('PUT', `/departments/${departmentId}`, { ...ADMIN, body: { name: other.name } })).status === 409);
    }
    check('staff แก้ชื่อแผนกไม่ได้ -> 403',
      (await call('PUT', `/departments/${departmentId}`, { ...STAFF, body: { name: 'x' } })).status === 403);
    const removed = await call('DELETE', `/departments/${departmentId}`, ADMIN);
    check('ลบแผนก -> บอกจำนวนอุปกรณ์ที่ถูกปลดออก', removed.status === 200 && removed.body.unassigned === 1, JSON.stringify(removed.body));
    check('ลบแผนกแล้วอุปกรณ์ไม่หาย แค่ไม่สังกัดแผนก',
      (await call('GET', `/equipment/${booked.id}`)).body.departmentId === null);
  }

  console.log('\n-- ช่วงที่ถูกจองแล้ว --');
  {
    const res = await call('GET', '/equipment/e2/bookings');
    check('ผู้ยืมดูช่วงที่ถูกจองได้', res.status === 200 && Array.isArray(res.body));
    check('มีช่วงของรายการที่อนุมัติแล้ว (b1)', res.body.some((b) => b.startAt && b.endAt));
    check('ไม่มีข้อมูลผู้ยืมหลุดออกมา',
      res.body.every((b) => Object.keys(b).sort().join(',') === 'endAt,startAt'), JSON.stringify(res.body[0]));
    check('อุปกรณ์ที่ไม่มี -> 404', (await call('GET', '/equipment/nope/bookings')).status === 404);
  }

  console.log('\n-- QR --');
  {
    const res = await fetch(`${BASE}/qr/equipment/e3.svg`, { headers: { Cookie: cookies.user } });
    const body = await res.text();
    check('รูป QR เป็น SVG', res.ok && res.headers.get('content-type')?.startsWith('image/svg+xml') && body.startsWith('<svg'));
    check('QR ของที่ไม่มี -> 404',
      (await fetch(`${BASE}/qr/equipment/nope.svg`, { headers: { Cookie: cookies.user } })).status === 404);
    check('ยังไม่ login ดู QR ไม่ได้ -> 401', (await fetch(`${BASE}/qr/equipment/e3.svg`)).status === 401);
  }

  console.log('\n-- กลับหน้าเดิมหลัง login --');
  {
    const { body: { providers } } = await call('GET', '/auth/providers');
    if (providers.length === 0) {
      console.log('  skip ยังไม่ได้ตั้งค่า OAuth');
    } else {
      // จำหน้าไว้ในคุกกี้ก่อนเด้งไป provider — callback อ่านคุกกี้นี้แล้วพากลับ
      const nextCookie = async (next) => {
        const res = await fetch(`${BASE}/auth/${providers[0].name}?next=${encodeURIComponent(next)}`, { redirect: 'manual' });
        const m = (res.headers.get('set-cookie') ?? '').match(/pf_oauth_next=([^;]*)/);
        return m ? decodeURIComponent(m[1]) : null;
      };
      check('จำหน้าในแอปไว้ได้', (await nextCookie('/equipment/e3')) === '/equipment/e3');
      check('ลิงก์เว็บอื่น -> กลับหน้าแรกแทน', (await nextCookie('//evil.example')) === '/');
      check('URL เต็ม -> กลับหน้าแรกแทน', (await nextCookie('https://evil.example')) === '/');
    }
  }

  // เก็บกวาด — ต้องคืนของก่อนถึงลบอุปกรณ์ได้ และต้องลบอุปกรณ์ก่อนถึงลบแผนกได้
  await call('PUT', `/borrows/${future}/confirm-return`, ADMIN);
  await call('DELETE', `/equipment/${booked.id}`, ADMIN);
  await dbConn`DELETE FROM departments WHERE id = ${departmentId}`;

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
    const r = await call('PUT', '/users/u4/role', { as: 'admin', body: { role: 'staff' } });
    check('updateUserRole สำเร็จ', r.body.role === 'staff');
    check('field ตรงกับ type User', Object.keys(r.body).sort().join(',') === 'email,fullName,id,role');
    await call('PUT', '/users/u4/role', { as: 'admin', body: { role: 'user' } });

    const bad = await call('PUT', '/users/u4/role', { as: 'admin', body: { role: 'wizard' } });
    check('role ที่ไม่ถูกต้อง -> 400', bad.status === 400);
  }

  console.log(`\n${'='.repeat(46)}`);
  console.log(`ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
  console.log('='.repeat(46));
  // เก็บกวาด session ที่เทสต์สร้างไว้
  for (const c of Object.values(cookies)) {
    await authModel.deleteSession(c.replace('pf_session=', ''));
  }
  await dbConn.end();

  process.exit(fail > 0 ? 1 : 0);
})();
