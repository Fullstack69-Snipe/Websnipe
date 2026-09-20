# db

ชั้นฐานข้อมูลของระบบยืม-คืนอุปกรณ์ — PostgreSQL + [Drizzle ORM](https://orm.drizzle.team)

แพ็กเกจนี้เป็นเจ้าของ schema, migration, ข้อมูลตั้งต้น และชั้น model ทั้งหมด
[`backend/`](../backend/) เรียกใช้ผ่าน `require('db')` ไม่ได้เขียน SQL เอง

---

## เริ่มใช้งาน

```bash
cp .env.example .env     # แก้รหัสผ่านก่อนใช้จริง
pnpm install
pnpm db:up               # ยก postgres ด้วย docker compose
pnpm db:generate         # สร้างไฟล์ migration จาก schema.ts
pnpm db:migrate          # รัน migration ใส่ฐานข้อมูล
pnpm db:seed             # ใส่ข้อมูลตัวอย่าง (--reset เพื่อล้างก่อน)
```

> ถ้ารันทั้งระบบด้วย compose ที่ root ไม่ต้องทำขั้นตอนพวกนี้เอง —
> backend รัน migration และ seed ให้ตอนบูต (ดู `backend/docker-entrypoint.sh`)

| คำสั่ง | ทำอะไร |
| --- | --- |
| `pnpm db:up` / `db:down` | เปิด/ปิด container postgres |
| `pnpm db:reset` | ลบ volume แล้วยกขึ้นใหม่ (ข้อมูลหายหมด) |
| `pnpm db:generate` | อ่าน `db/schema.ts` แล้วสร้าง `.sql` ลง `db/migration` |
| `pnpm db:migrate` | รัน migration ที่ยังไม่ได้รัน |
| `pnpm db:push` | ยัด schema ลง DB ตรงๆ ข้าม migration (ใช้ตอน prototype เท่านั้น) |
| `pnpm db:studio` | เปิด Drizzle Studio ดู/แก้ข้อมูลผ่านเบราว์เซอร์ |
| `pnpm db:seed` | ใส่ข้อมูลตัวอย่าง |
| `pnpm build` | build เป็น ESM + CommonJS ลง `dist/` (ต้องทำก่อน backend ใช้งาน) |
| `pnpm typecheck` | ตรวจ TypeScript |

---

## โครงสร้าง

```
db/
├── index.ts          จุดเข้าเดียวของแพ็กเกจ — backend import จากไฟล์นี้
├── schema.ts         นิยามตาราง enum index constraint และ relations
├── client.ts         คอนเนกชันและ dbClient
├── utils.ts          ประกอบ connection string จาก env + ตรวจว่าตั้งค่าครบ
├── migrate.ts        ตัวรัน migration
├── seed.ts           ข้อมูลตัวอย่าง
├── prototype.ts      สคริปต์ไว้ลองเขียน query
├── migration/        ไฟล์ .sql ที่ drizzle-kit สร้าง (commit ไว้ในรีโป)
└── models/
    ├── authModel.ts      login ด้วย OAuth, จับคู่บัญชี, จัดการ session
    ├── userModel.ts      ผู้ใช้และสิทธิ์
    ├── equipmentModel.ts อุปกรณ์ + คำนวณ available
    ├── borrowModel.ts    รายการยืม
    └── helpers.ts        ตัวช่วยที่ใช้ร่วมกัน

_entrypoint/init.sh   สร้าง app user + schema drizzle ตอน container เกิดครั้งแรก
```

---

## ตาราง

| ตาราง | เก็บอะไร |
| --- | --- |
| `users` | ผู้ใช้ + role (`user` / `staff` / `admin`) |
| `user_identities` | บัญชี OAuth ที่ผูกไว้ — คนเดียวผูกได้หลายผู้ให้บริการ |
| `sessions` | session ที่ยังไม่หมดอายุ (คุกกี้เก็บแค่ token) |
| `equipment` | อุปกรณ์และจำนวนทั้งหมดที่มี |
| `borrows` | รายการยืม หนึ่งแถว = อุปกรณ์หนึ่งชิ้น |

### ทำไมถึงเป็นแบบ "จำนวนรวม" ไม่ใช่ "รายชิ้น"

หนึ่งแถวใน `equipment` = อุปกรณ์หนึ่ง **ชนิด** พร้อมจำนวนที่มี ไม่ใช่หนึ่ง **ชิ้น**
จึงไม่มีรหัสครุภัณฑ์รายชิ้น ไม่มีที่เก็บรายชิ้น และไม่มีสถานะรายชิ้น
(ว่าง / ถูกยืม / ซ่อมบำรุง / ปลดระวาง)

เคยพิจารณาเปลี่ยนไปเก็บแบบรายชิ้นตามแบบร่างเดิมแล้ว แต่ **ตัดสินใจไม่เปลี่ยน
(21 ก.ย. 2026)** เพราะต้องรื้อการคำนวณจำนวนคงเหลือใหม่ทั้งหมด ตั้งแต่ `db/`
ไปจนถึง `backend/` และทุกหน้าในฝั่ง frontend (การ์ดอุปกรณ์แสดง "เหลือ X / Y ชิ้น"
ตัวกรองมีแค่ว่าง/หมด และฟอร์มกรอกเป็นจำนวน) ซึ่งไม่คุ้มกับขอบเขตงานตอนนี้

ถ้าวันหนึ่งต้องติดตามอุปกรณ์เป็นรายชิ้นจริงๆ (เช่น ต้องรู้ว่าโปรเจกเตอร์ตัวไหน
อยู่กับใคร) ค่อยกลับมาทบทวนใหม่ทั้งระบบพร้อมกัน อย่าแก้ทีละชั้น

### สิ่งที่ตั้งใจออกแบบไว้แบบนี้

- **`equipment` ไม่มีคอลัมน์ `available`** — คำนวณสดทุกครั้งจาก
  `quantity - (จำนวน borrows ที่สถานะอยู่ใน HOLDING_STATUSES)`
  เก็บตัวเลขซ้ำสองที่แล้วมันจะไม่ตรงกันเมื่อไหร่ก็ได้
- `HOLDING_STATUSES` (`approved`, `returning`) export จาก `schema.ts` ให้ทุกที่ใช้ค่าชุดเดียวกัน
  — `pending` ไม่นับ เพราะเจ้าหน้าที่อาจปฏิเสธ
- **ไม่มีสถานะ "เกินกำหนด"** — คำนวณจาก `approved` + `dueDate < วันนี้`
- FK ของ `borrows` เป็น `ON DELETE RESTRICT` ทั้งคู่ ลบอุปกรณ์หรือผู้ใช้ที่ยังมีรายการค้างไม่ได้
  ส่วน `user_identities` กับ `sessions` เป็น `CASCADE` (ลบผู้ใช้แล้วตามไปหมด)
- อีเมลใน `users` unique แบบไม่สนตัวพิมพ์ (`lower(email)`)
- มี CHECK บังคับว่า `returned_at` มีค่าได้เฉพาะตอน status เป็น `returned`
  และ `quantity` ห้ามติดลบ

---

## ใช้จากฝั่ง backend

build ออกมาสองแบบ: ESM (`dist/db`) และ CommonJS (`dist/cjs/db`)
backend เป็น `type: commonjs` จึง `require()` ได้ตรงๆ

```bash
pnpm build          # ต้อง build ก่อนให้ที่อื่นใช้งาน
```

```js
const { equipmentModel, borrowModel, userModel, authModel } = require('db');

const items = await equipmentModel.listAll();   // ทุกฟังก์ชันเป็น async
```

| model | ฟังก์ชัน |
| --- | --- |
| `userModel` | `listAll` `findById` `setRole` |
| `equipmentModel` | `listAll` `findById` `borrowedCount` `create` `update` `remove` |
| `borrowModel` | `listAll` `listByBorrower` `findById` `create` `setStatus` `markReturned` |
| `authModel` | `findOrCreateFromOAuth` `createSession` `findUserBySession` `deleteSession` `deleteExpiredSessions` |

สิ่งที่ชั้นนี้รับประกันให้:

- คีย์เป็น camelCase ตรงกับ `frontend/src/types.ts`
- `findById` คืน `undefined` เมื่อไม่พบ (ไม่ใช่ `null`)
- อุปกรณ์ทุกแถวมี `available` ที่คำนวณมาแล้ว
- `createdAt` / `returnedAt` เป็น ISO string ไม่ใช่ `Date` object

> **ถ้าแก้โค้ดใน `db/` แล้ว backend ยังเห็นของเก่า** ให้รัน `pnpm build` ใหม่
> เพราะ backend ใช้ผลลัพธ์ใน `dist/` ไม่ได้อ่าน `.ts` ตรงๆ

---

## เพิ่ม/แก้ schema

```bash
# 1. แก้ db/schema.ts
# 2. สร้าง migration แล้วอ่าน .sql ที่ได้ก่อนเสมอ
pnpm db:generate
# 3. รันใส่ฐานข้อมูล
pnpm db:migrate
# 4. build ให้ backend เห็น type ใหม่
pnpm build
```

ไฟล์ใน `db/migration/` commit ลงรีโปด้วย — เป็นบันทึกว่า schema เปลี่ยนมายังไง
ถ้าไม่ commit ทุกคนจะได้ฐานข้อมูลหน้าตาไม่เหมือนกัน

---

## ข้อควรรู้

- `_entrypoint/init.sh` รันเฉพาะตอน data directory ว่างเท่านั้น
  แก้ไฟล์นี้แล้วต้อง `pnpm db:reset` ถึงจะมีผล
- สคริปต์ต้องเป็น LF — ถ้าเป็น CRLF จะพังใน container แบบเงียบๆ
  (`/bin/bash^M: bad interpreter`) มี `.gitattributes` กันไว้แล้ว
- `init.sh` ให้สิทธิ์ `GRANT ALL ON DATABASE` กับ app user ซึ่งกว้างเกินจำเป็น
  ถ้าจะขึ้น production ควรลดให้เหลือเท่าที่ใช้จริง
- หนึ่งแถวใน `borrows` = ยืมหนึ่งชิ้น ถ้าจะให้ยืมหลายชิ้นในรายการเดียว
  ต้องเพิ่มคอลัมน์ `quantity` แล้วเปลี่ยนการนับจาก `COUNT(*)` เป็น `SUM(quantity)`
