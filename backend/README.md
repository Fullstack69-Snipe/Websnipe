# backend

REST API ของระบบยืม-คืนอุปกรณ์ — Express 4 (CommonJS) + PostgreSQL

ไม่ได้ต่อฐานข้อมูลเอง แต่เรียกผ่านแพ็กเกจ [`db`](../db/) ที่ import แบบ `file:../db`
ตรรกะทางธุรกิจและการตรวจสิทธิ์ทั้งหมดอยู่ที่นี่

---

## รัน

ปกติรันจาก root ของ repo พร้อมทั้งระบบ — ดู [README หลัก](../README.md)

```bash
docker compose up -d --build
```

รันเฉพาะ backend (ต้องมี postgres ขึ้นอยู่ก่อน):

```bash
cd db && docker compose up -d      # ยก postgres + สร้าง network
cd ../backend
cp .env.example .env
docker compose up -d --build       # เปิดพอร์ต 3001 ไว้ให้ยิงทดสอบตรงๆ
```

รันบนเครื่องตัวเองโดยไม่ผ่าน container:

```bash
cd db && pnpm build                # ต้อง build แพ็กเกจ db ก่อน
cd ../backend && pnpm install
POSTGRES_HOST=localhost pnpm dev
```

### ทดสอบ

```bash
BASE=http://localhost:6002/api node db/smoke-test.js
```

122 เคส ครอบคลุมทุก endpoint, ทุกสิทธิ์, ข้อความ error, วงจรการยืมทั้งวงจร, ช่วงเวลายืม,
การรับของ, สิทธิ์ตามแผนก, QR, แจ้งเตือน, การกลับหน้าเดิมหลัง login และกรณีกดพร้อมกัน (อนุมัติชิ้นสุดท้ายซ้อนกัน, ยกเลิกจังหวะเดียวกับอนุมัติ)
(ไม่ได้ตั้งค่า OAuth จะข้าม 3 เคสที่เกี่ยวกับ login — GitHub Actions รันชุดนี้ทุก push ดู `.github/workflows/ci.yml`)
สคริปต์สร้าง session ใส่ฐานข้อมูลโดยตรงเพื่อใช้ทดสอบ แล้วลบทิ้งเมื่อจบ
(ไม่มีช่องทางลัดใดๆ ในตัว backend)

---

## API

ทุก path ขึ้นต้นด้วย `/api` — error ตอบรูปแบบ `{ "error": "ข้อความภาษาไทย" }`

### ไม่ต้องเข้าสู่ระบบ

| HTTP | ทำอะไร |
| --- | --- |
| `GET /health` | ใช้กับ healthcheck ของ docker |
| `GET /auth/providers` | ช่องทาง login ที่เปิดใช้อยู่ |
| `GET /showcase` | path รูปอุปกรณ์ (สุ่ม ไม่เกิน 12) ให้หน้าเข้าสู่ระบบวนโชว์ — ไม่มีชื่อ/จำนวนของ |
| `GET /auth/:provider?next=/path` | เด้งไปหน้า login ของผู้ให้บริการ แล้วกลับมาที่ `next` (รับเฉพาะ path ในแอป) |
| `GET /auth/:provider/callback` | ผู้ให้บริการเรียกกลับมาที่นี่ |

### ต้องเข้าสู่ระบบ

| HTTP | สิทธิ์ |
| --- | --- |
| `POST /auth/logout` | ทุกคน |
| `GET /me` | ทุกคน (มี `departmentIds` = แผนกที่ดูแล) |
| `GET /equipment` · `GET /equipment/:id` | ทุกคน |
| `GET /equipment/:id/bookings` | ทุกคน — ช่วงที่ถูกจองแล้ว (ไม่มีชื่อผู้ยืม) ให้หน้าขอยืมเลือกวันได้ถูก |
| `POST /equipment` · `PUT /equipment/:id` · `DELETE /equipment/:id` | staff, admin |
| `POST /uploads` | staff, admin |
| `GET /equipment/:id/logs` | staff, admin |
| `GET /categories` | ทุกคน |
| `POST /categories` · `PUT /categories/:id` · `DELETE /categories/:id` | staff, admin |
| `POST /borrows` | ทุกคน |
| `GET /borrows/mine` | ทุกคน |
| `PUT /borrows/:id/cancel` | เจ้าของรายการเท่านั้น (เฉพาะสถานะ `pending`) |
| `PUT /borrows/:id/request-return` | เจ้าของรายการ (staff/admin ทำแทนได้) |
| `GET /borrows` | staff, admin |
| `PUT /borrows/:id/approve` · `/reject` · `/confirm-return` | staff ในแผนก, admin |
| `PUT /borrows/:id/pickup` | เจ้าของรายการ หรือ staff ในแผนก, admin |
| `GET /departments` · `GET /departments/:id/equipment` | ทุกคน |
| `POST /departments` · `PUT` / `DELETE /departments/:id` (แก้ชื่อ / ลบ) · `PUT` / `DELETE /departments/:id/equipment/:equipmentId` · `PUT` / `DELETE /departments/:id/staff/:userId` | admin |
| `GET /qr/equipment/:id.svg` | ทุกคน — รูป QR ที่ลิงก์ไปหน้า `/equipment/:id` |
| `GET /users` · `PUT /users/:id/role` | admin |
| `GET /notifications` → `{ items, unread }` · `PUT /notifications/:id/read` · `PUT /notifications/read-all` | ทุกคน (เฉพาะของตัวเอง) |
| `POST /notifications/reminders` → `{ sent }` | admin — สั่งรันงานเตือนครบกำหนดทันที (ปกติรันเองทุก 15 นาที) |

### แจ้งเตือน

สร้างตอนสถานะการยืมเปลี่ยน: มีคำขอใหม่ (ถึง staff ของแผนก), อนุมัติ, ปฏิเสธ, แจ้งคืน (ถึง staff), รับคืนแล้ว
และงานเตือนทุก 15 นาที: ใกล้ครบกำหนด (เหลือไม่ถึง 24 ชม.) / เกินกำหนด (ถึงผู้ยืม + staff)
แต่ละเหตุการณ์ส่งครั้งเดียว (unique `user_id, borrow_id, type`) งานเตือนจึงรันซ้ำได้
staff ของแผนก = คนที่ดูแลแผนกของอุปกรณ์ชิ้นนั้น — อุปกรณ์ไม่สังกัดแผนกส่งถึง staff ทุกคน (ไม่มี staff เลยส่งถึง admin)
ตั้ง `SMTP_HOST` แล้วจะส่งอีเมลด้วย (ไม่ตั้ง = แจ้งเตือนในเว็บอย่างเดียว) ส่งพลาดแค่เขียน log ไม่ทำให้คำขอล้ม

### อัปโหลดรูป

แยกเป็นสองขั้นเพราะ `imageUrl` เป็น string ธรรมดา endpoint อุปกรณ์จึงยังเป็น JSON ล้วน

```
POST /api/uploads   (multipart, field = "file")  ->  { "url": "/uploads/172....png" }
```

รับ jpg / jpeg / png / gif / webp ไม่เกิน 5MB เสิร์ฟกลับที่ `/uploads/<filename>`
ไฟล์เก็บใน volume `pf-uploads` แยกจากฐานข้อมูล

---

## การเข้าสู่ระบบ

OAuth 2.0 authorization-code flow เขียนเองตรงๆ ไม่ผ่านไลบรารี (ดู `src/controllers/authController.js`)

```
1. GET /api/auth/google          -> สุ่ม state เก็บใส่คุกกี้ แล้ว redirect ไป Google
2. Google เด้งกลับ /callback     -> ตรวจ state, แลก code เป็น access token
3. ดึงโปรไฟล์ -> หา/สร้างผู้ใช้ -> สร้าง session -> ตั้งคุกกี้ -> เด้งเข้าหน้าแรก
```

- **session เก็บในฐานข้อมูล** ไม่ใช่ JWT คุกกี้ `pf_session` เก็บแค่ token สุ่ม 32 ไบต์
  ออกจากระบบ = ลบแถวจริง จึงเพิกถอนได้ทันที
- คุกกี้เป็น httpOnly + SameSite=Lax และตั้ง `Secure` อัตโนมัติเมื่อ
  `NODE_ENV=production` และ `APP_URL` เป็น https
- **role อ่านจากฐานข้อมูลเท่านั้น** ไม่มี header ให้ override
  (เวอร์ชันก่อนหน้าใช้ `x-user-id` / `x-role` ซึ่งแปลว่าใครส่ง `x-role: admin` มาก็ได้สิทธิ์เต็ม)
- ผู้สมัครใหม่ได้ role `user` เสมอ ตั้ง `ADMIN_EMAILS` เพื่อให้อีเมลนั้นได้ admin อัตโนมัติ
  และจะยกระดับให้ทุกครั้งที่ login จึงใช้กู้สิทธิ์ตัวเองได้

การจับคู่บัญชีทำตามลำดับ: หาจาก (provider, account id) ก่อน → ไม่เจอค่อยหาจากอีเมล
ที่ผู้ให้บริการยืนยันแล้ว → ยังไม่เจอจึงสร้างใหม่
คนเดียวผูกได้ทั้ง Google, GitHub และ Discord ถ้าอีเมลเดียวกัน

> ผู้ใช้จาก seed (`u1`–`u5`) เป็นข้อมูลตัวอย่างเท่านั้น ไม่ได้ผูกกับบัญชี OAuth ใด
> จึง login เข้าบัญชีเหล่านั้นไม่ได้

---

## โครงสร้าง

```
src/
├── server.js               ประกอบ middleware ตามลำดับ + กวาด session หมดอายุวันละครั้ง + งานเตือนทุก 15 นาที
│
├── config/oauth.js         ตั้งค่าผู้ให้บริการ — เจ้าไหนไม่มี env ก็ปิดอัตโนมัติ
│
├── middleware/
│   ├── identity.js         อ่าน session จากคุกกี้ -> req.user / req.role + requireRole()
│   ├── upload.js           multer (5MB, เฉพาะไฟล์รูป)
│   └── errorHandler.js     รวมรูปแบบ error — 500 ไม่ส่งรายละเอียดออกไป
│
├── routes/                 ผูก path เข้ากับ controller + ระบุสิทธิ์ที่ต้องมี
├── controllers/            ตรวจ input, บังคับกติกาทางธุรกิจ, ตอบ JSON
├── models/                 ทางผ่านบางๆ ไปยังแพ็กเกจ db
├── services/
│   ├── notify.js           สร้างแจ้งเตือนตามเหตุการณ์ + งานเตือนครบกำหนด
│   └── mailer.js           ส่งอีเมลผ่าน SMTP (ไม่ตั้ง SMTP_HOST = ปิด)
└── utils/
    ├── HttpError.js        error ที่พ่วง status (badRequest, unauthorized, ...)
    └── wrap.js             ห่อ handler ให้ error ใน async วิ่งไป errorHandler
```

ลำดับ middleware ใน `server.js` สำคัญ:

```
cors -> json -> cookieParser -> /uploads (static) -> /api/health
     -> /api/auth/*  (ยังไม่ต้องมีตัวตน)
     -> attachIdentity  (ทุกอย่างหลังจากนี้ต้อง login)
     -> route ที่เหลือ -> notFound -> errorHandler
```

---

## กติกาทางธุรกิจ

- **`available` ไม่เก็บในฐานข้อมูล** — คำนวณสดทุกครั้งจาก `quantity` ลบจำนวนที่ถือของอยู่
  (สถานะ `approved` กับ `returning`) `pending` ไม่นับเพราะอาจถูกปฏิเสธ
- ลดจำนวนอุปกรณ์ต่ำกว่าที่ถูกยืมอยู่ไม่ได้
- ลบอุปกรณ์ที่กำลังถูกยืมอยู่ไม่ได้ ถ้าลบได้จะลบประวัติการยืมที่จบแล้วตามไปด้วย
  (FK เป็น `ON DELETE RESTRICT`)
- แจ้งคืนได้เฉพาะรายการของตัวเอง ยกเว้น staff/admin ทำแทนได้
- ยกเลิกคำขอได้เฉพาะเจ้าของ และเฉพาะตอนที่ยัง `pending` — อนุมัติแล้วต้องใช้การแจ้งคืนแทน
- วันครบกำหนดต้องไม่ก่อน "วันนี้" ตามเวลาไทย (Asia/Bangkok) ไม่ใช่ UTC
- ขอยืมได้สองแบบ: ส่ง `startAt` / `endAt` (ISO พร้อม timezone) หรือส่ง `dueDate` อย่างเดียว
  (= เริ่มตอนนี้ ถึงสิ้นวัน `dueDate`) ของพอไหมดูจากรายการที่อนุมัติแล้วและจองทับช่วงเดียวกัน
  ของหมดตอนนี้ก็ยังจองช่วงอื่นได้ — `available` ของอุปกรณ์คือจำนวนที่อยู่บนชั้นตอนนี้
- รายการเก่าที่ไม่มีช่วงเวลา และของที่เลยกำหนดแล้วยังไม่คืน ถือว่าจองไว้จนกว่าจะคืน
- รับของ (`pickup`) กดได้ครั้งเดียว เฉพาะรายการที่อนุมัติแล้วและมีช่วงเวลายืม
- staff จัดการได้เฉพาะอุปกรณ์ในแผนกที่ตัวเองดูแล และอุปกรณ์ที่ไม่สังกัดแผนก
- ตั้งแผนกของอุปกรณ์ (`departmentId` ตอนเพิ่ม/แก้อุปกรณ์) ได้เฉพาะ admin — staff ส่งมาก็ไม่มีผล
  ไม่ส่ง `departmentId` เลย = แผนกเดิมไม่เปลี่ยน / ลบแผนกแล้วอุปกรณ์กลายเป็นไม่สังกัดแผนก (ไม่ถูกลบ)
  `GET /borrows` ของ staff จึงเห็นเฉพาะคำขอของอุปกรณ์กลุ่มนั้น admin เห็นทั้งหมด
- การเปลี่ยนสถานะล็อกแถวแล้วตรวจซ้ำในทรานแซกชัน ถ้ามีคนเปลี่ยนไปก่อน
  (เช่น สองคนอนุมัติชิ้นสุดท้ายพร้อมกัน) คนที่มาทีหลังได้ 409
- "เกินกำหนด" ไม่ใช่สถานะในฐานข้อมูล แต่คำนวณจาก `approved` + `dueDate < วันนี้`
- ทุกการเปลี่ยนสถานะบันทึกลง `equipment_logs` พร้อมว่าใครเป็นคนทำ
  และเก็บ `approved_by` / `received_by` / `reject_reason` / `return_note` ไว้ในแถวการยืมด้วย
  (ตอนปฏิเสธและรับคืนส่งเหตุผล/หมายเหตุมาใน body ได้ ไม่บังคับ)

---

## ตัวแปรที่ใช้

ดูรายการเต็มใน `.env.example` — ตัวที่เฉพาะของ backend:

| ตัวแปร | ค่าเริ่มต้น | ใช้ทำอะไร |
| --- | --- | --- |
| `PORT` | 3000 | พอร์ตที่ express ฟัง |
| `UPLOAD_DIR` | `/data/uploads` | ที่เก็บรูปที่อัปโหลด |
| `CORS_ORIGINS` | localhost:5173, :6002 | origin ที่เรียก API แบบแนบคุกกี้ได้ |
| `ADMIN_EMAILS` | (ว่าง) | อีเมลที่ได้ admin อัตโนมัติ |
| `SESSION_DAYS` | 30 | อายุ session |
| `RUN_SEED` | — | `true` = ใส่ข้อมูลตัวอย่างตอนบูต (ข้ามถ้ามีข้อมูลแล้ว) |
| `APP_URL` | — | ประกอบลิงก์ใน QR และในอีเมลแจ้งเตือน |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | (ว่าง) / 587 | อีเมลแจ้งเตือน — พอร์ต 465 ใช้ TLS ตรง (เช่น Gmail + App password) |

---

## สิ่งที่ยังไม่ได้ทำ

- ไม่มี rate limit ที่ `/api/auth/*`
- ไม่มี refresh token — session หมดอายุแล้วต้อง login ใหม่
- ยังไม่มี endpoint สำหรับถอนการผูกบัญชี OAuth หรือลบผู้ใช้
- ลบอุปกรณ์แล้วไฟล์รูปใน `UPLOAD_DIR` ยังค้างอยู่ (ไม่ได้ลบตาม)
- งานเตือนรันใน process ของ backend — ถ้าวันหนึ่งรัน backend หลายตัวจะเช็คซ้ำ (ไม่ส่งซ้ำเพราะ unique แต่เปลืองแรง)
