# pf-backend — Backend ระบบยืม-คืนอุปกรณ์

Express + SQLite เขียนให้เข้ากับ frontend เดิมแบบ **drop-in** ทุก endpoint คืน field
ชื่อตรงกับ `types.ts` และข้อความ error ตรงกับที่ `mockApi.ts` เคย throw ไว้
เปลี่ยน frontend แค่บรรทัด import เท่านั้น

ฟังพอร์ต **3000** ชื่อ container **pf-backend** ให้ตรงกับ `NGINX_PROXY=http://pf-backend:3000` ใน `.env.test`

---

## รันแบบเร็วสุด

```bash
cd backend
npm install
npm run seed        # ใส่ข้อมูลตั้งต้นชุดเดียวกับ mockApi
npm start           # http://localhost:3000
```

ตรวจว่ารันอยู่: `curl localhost:3000/api/health`

รันชุดทดสอบ (39 เคส เทียบกับสัญญาของ mockApi):

```bash
npm run seed:reset
npm start &
node db/smoke-test.js
```

## รันด้วย Docker

วาง `backend/` ไว้ข้างๆ `Dockerfile` ของ frontend แล้วเพิ่ม service `backend` ลงใน
`docker-compose.yml` ตามไฟล์ตัวอย่าง `docker-compose.example.yml` จากนั้น

```bash
docker compose --env-file .env.test up -d --build
docker compose exec backend npm run seed
```

จุดที่ต้องคงไว้: `container_name: pf-backend` และ `PORT=3000` เพราะ nginx ฝั่ง frontend
proxy ไปที่ชื่อนี้ ถ้าเปลี่ยนต้องแก้ `NGINX_PROXY` ด้วย

---

## ต่อกับ frontend (3 ขั้น)

**1. ก็อปไฟล์ 2 ไฟล์จาก `frontend-patch/` ไปที่ `frontend/src/lib/`**

- `realApi.ts` — ตัวเรียก backend จริง ชื่อฟังก์ชันเหมือน `mockApi` ทุกตัว
- `api.ts` — ตัวสลับ mock / ของจริงด้วย env

**2. แก้ import ในไฟล์ที่ใช้ `mockApi` อยู่** (`EquipmentList.tsx`, `MyBorrows.tsx`,
`BorrowRequests.tsx`, `ManageEquipment.tsx`)

```diff
- import { mockApi } from '../lib/mockApi'
+ import { api } from '../lib/api'
```

แล้ว replace `mockApi.` → `api.` ในไฟล์นั้น ไม่ต้องแก้ตรรกะอื่นเลย เพราะ signature
เหมือนกันหมด (มี type assertion ใน `compat-check` ยืนยันตอน compile)

**3. ทับ `role.tsx` ด้วยเวอร์ชันใน `frontend-patch/`**

ต่างจากเดิมแค่เรียก `setCurrentRole(r)` เพิ่มใน `setRole` เพื่อให้ role ที่สลับบนจอ
ถูกส่งไปกับทุก request ถ้าไม่ทำขั้นนี้ สลับเป็น staff บนหน้าจอแล้วจะยังโดนตอบ 403 อยู่

### ตั้งค่า vite (ตอน dev)

ใน `vite.config.ts` ให้ proxy `/api` กับ `/uploads` ไปที่ backend:

```ts
server: {
  proxy: {
    '/api': 'http://localhost:3000',
    '/uploads': 'http://localhost:3000',
  },
}
```

หรือข้าม proxy โดยตั้ง `VITE_API_BASE=http://localhost:3000/api` ใน `.env.local` (CORS เปิดไว้ให้แล้ว)

กลับไปใช้ mock ชั่วคราว: ตั้ง `VITE_USE_MOCK=true`

---

## API

ทุก path ขึ้นต้นด้วย `/api` — error ตอบรูปแบบ `{ "error": "ข้อความภาษาไทย" }`

| mockApi | HTTP | สิทธิ์ |
|---|---|---|
| `listEquipment()` | `GET /equipment` | ทุกคน |
| `createEquipment(input)` | `POST /equipment` | staff, admin |
| `updateEquipment(id, input)` | `PUT /equipment/:id` | staff, admin |
| `deleteEquipment(id)` | `DELETE /equipment/:id` | staff, admin |
| `requestBorrow(equipmentId, dueDate)` | `POST /borrows` | ทุกคน |
| `listMyBorrows()` | `GET /borrows/mine` | ทุกคน |
| `requestReturn(borrowId)` | `PUT /borrows/:id/request-return` | เจ้าของรายการ |
| `listBorrows()` | `GET /borrows` | staff, admin |
| `approveBorrow(borrowId)` | `PUT /borrows/:id/approve` | staff, admin |
| `rejectBorrow(borrowId)` | `PUT /borrows/:id/reject` | staff, admin |
| `confirmReturn(borrowId)` | `PUT /borrows/:id/confirm-return` | staff, admin |
| `listUsers()` | `GET /users` | admin |
| `updateUserRole(userId, role)` | `PUT /users/:id/role` | admin |
| *(เพิ่มใหม่)* `me()` | `GET /me` | ทุกคน |
| *(เพิ่มใหม่)* `uploadImage(file)` | `POST /uploads` | staff, admin |

### การอัปโหลดรูป

`types.ts` กำหนด `imageUrl: string | null` ดังนั้นการอัปโหลดแยกเป็น 2 ขั้น
endpoint อุปกรณ์จึงยังเป็น JSON ล้วน ไม่ต้องแก้ type:

```ts
const url = await api.uploadImage(file)           // -> "/uploads/172...png"
await api.createEquipment({ name, description, quantity, imageUrl: url })
```

รับ jpg / jpeg / png / gif / webp ไม่เกิน 5MB เสิร์ฟกลับที่ `/uploads/<filename>`

### ตัวตนผู้ใช้ (ยังไม่มี login)

แทน `CURRENT_USER_ID` ด้วย 2 header — `realApi.ts` ใส่ให้อัตโนมัติ:

| header | ความหมาย |
|---|---|
| `x-user-id` | id ผู้ใช้ ไม่ส่งมาใช้ `u1` (ตั้งได้ที่ `DEFAULT_USER_ID`) |
| `x-role` | role ที่ใช้ตรวจสิทธิ์ ไม่ส่งมาใช้ role จริงจาก DB |

ผู้ใช้ตั้งต้นเหมือน mockApi: `u1` สมชาย (user), `u2` สมหญิง (staff), `u3` ผู้ดูแล (admin), `u4` วิชัย (user)

---

## จุดที่ยึดตาม mockApi เป๊ะๆ

**`available` ไม่ได้เก็บใน DB** — คำนวณสดจากตาราง `borrows` ทุกครั้ง
(`quantity - COUNT(สถานะ approved หรือ returning)`) เหมือน `withAvailable()` ในของเดิม
จึงไม่มีทางที่ตัวเลขจะเพี้ยนจากความจริง

**`pending` ไม่ตัดจำนวนคงเหลือ** — ตัดตอน `approve` เท่านั้น เพราะ staff อาจปฏิเสธ
และ `returning` ยังนับว่าถือของอยู่ จะคืนเข้าสต็อกตอน `confirm-return`

วงจรสถานะ: `pending` → `approved` → `returning` → `returned` และ `pending` → `rejected`

| กติกา | ข้อความ |
|---|---|
| ยืมของที่หมด | อุปกรณ์ชิ้นนี้ถูกยืมหมดแล้ว |
| อนุมัติแต่ของหมดไปก่อน | อุปกรณ์หมดแล้ว ถูกอนุมัติให้คนอื่นไปก่อน |
| ลดจำนวนต่ำกว่าที่ยืมอยู่ | ลดจำนวนไม่ได้ ตอนนี้ถูกยืมอยู่ N ชิ้น |
| ลบของที่ถูกยืมอยู่ | อุปกรณ์กำลังถูกยืมอยู่ ลบไม่ได้ |

---

## โครงสร้างไฟล์

```
backend/
├── src/
│   ├── server.js                  ประกอบ app + ฟังพอร์ต
│   ├── config/db.js               เปิด SQLite + รัน schema
│   ├── models/                    ชั้น query (ไม่มี logic HTTP)
│   │   ├── equipmentModel.js      ← available คำนวณที่นี่
│   │   ├── borrowModel.js
│   │   └── userModel.js
│   ├── controllers/               ตรวจ input + กติกาธุรกิจ
│   │   ├── equipmentController.js
│   │   ├── borrowController.js
│   │   └── userController.js
│   ├── routes/                    map path → controller + สิทธิ์
│   │   ├── equipmentRoutes.js
│   │   ├── borrowRoutes.js
│   │   ├── userRoutes.js
│   │   └── uploadRoutes.js
│   ├── middleware/
│   │   ├── identity.js            ← แทน CURRENT_USER_ID + ตรวจ role
│   │   ├── upload.js              multer
│   │   └── errorHandler.js
│   └── utils/
│       ├── HttpError.js
│       └── wrap.js
├── db/
│   ├── schema.sql                 โครงตาราง
│   ├── seed.js                    ข้อมูลตั้งต้นชุดเดียวกับ mockApi
│   ├── smoke-test.js              ทดสอบ 39 เคส
│   └── data.sqlite                (สร้างอัตโนมัติ)
├── uploads/                       รูปที่อัปโหลด
├── Dockerfile
└── docker-compose.example.yml
```

## สิ่งที่ต้องทำต่อก่อนใช้งานจริง

1. **ทำ login จริง** — ตอนนี้ใครก็ส่ง `x-role: admin` มาได้ ไม่มีการยืนยันตัวตนจริง
   ต้องเพิ่ม JWT แล้วแก้ `middleware/identity.js` ให้อ่านจาก token
   (controller ทุกตัวอ่านจาก `req.user` / `req.role` อยู่แล้ว จึงไม่ต้องแก้)
2. ถ้าจะขึ้น production หลายเครื่องพร้อมกัน ควรย้ายจาก SQLite ไป Postgres
   (`schema.sql` แก้ไม่มาก เปลี่ยน `TEXT` timestamp เป็น `timestamptz`)
3. เพิ่มการตรวจว่าไฟล์ที่อัปโหลดเป็นรูปจริง (ตอนนี้เช็คแค่นามสกุลกับขนาด)
