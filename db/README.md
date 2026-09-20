# db

ชั้นฐานข้อมูลของระบบยืม-คืนอุปกรณ์ — PostgreSQL + Drizzle ORM

## เริ่มใช้งาน

```bash
cp .env.example .env     # แก้รหัสผ่านให้เรียบร้อยก่อน
pnpm install
pnpm db:up               # ยก postgres ขึ้นด้วย docker compose
pnpm db:generate         # สร้างไฟล์ migration จาก db/schema.ts
pnpm db:migrate          # รัน migration ใส่ฐานข้อมูล
pnpm db:seed             # ใส่ข้อมูลตั้งต้น (--reset เพื่อล้างก่อน)
```

## คำสั่งที่มี

| คำสั่ง | ทำอะไร |
| --- | --- |
| `pnpm db:up` / `db:down` | เปิด/ปิด container postgres |
| `pnpm db:reset` | ลบ volume แล้วยกขึ้นใหม่ (ข้อมูลหายหมด) |
| `pnpm db:generate` | อ่าน `db/schema.ts` สร้าง `.sql` ลง `db/migration` |
| `pnpm db:migrate` | รัน migration ที่ยังไม่ได้รัน |
| `pnpm db:push` | ยัด schema ลง DB ตรงๆ ไม่ผ่าน migration (ใช้ตอน prototype เท่านั้น) |
| `pnpm db:studio` | เปิด Drizzle Studio ดูข้อมูลผ่านเบราว์เซอร์ |
| `pnpm db:seed` | ใส่ข้อมูลตั้งต้น |
| `pnpm typecheck` | ตรวจ TypeScript |

## โครงสร้าง

| ไฟล์ | หน้าที่ |
| --- | --- |
| `db/index.ts` | จุดเข้าเดียวของแพ็กเกจ — ฝั่ง backend import จากไฟล์นี้ |
| `db/schema.ts` | นิยามตาราง `users` / `equipment` / `borrows` + enum + relations |
| `db/models/` | ชั้น model หน้าตาเดียวกับ `backend/src/models/*.js` |
| `db/client.ts` | คอนเนกชันและ `dbClient` ที่ไฟล์อื่นเรียกใช้ |
| `db/utils.ts` | ประกอบ connection string จาก env + ตรวจว่าตั้งค่าครบ |
| `db/migrate.ts` | ตัวรัน migration |
| `db/seed.ts` | ข้อมูลตั้งต้น |
| `db/prototype.ts` | สคริปต์ทดลองเขียน query |
| `_entrypoint/init.sh` | สร้าง app user + schema `drizzle` ตอน container เกิดครั้งแรก |

## หมายเหตุเรื่อง schema

- **ตาราง `equipment` ไม่มีคอลัมน์ `available`** — จำนวนคงเหลือคำนวณสดจาก
  `quantity - (จำนวน borrows ที่สถานะอยู่ใน HOLDING_STATUSES)` ทุกครั้ง
  เพื่อไม่ให้ข้อมูลไม่ตรงกันจากการเก็บตัวเลขซ้ำสองที่ ดูตัวอย่าง query ใน `db/prototype.ts`
- `HOLDING_STATUSES` (`approved`, `returning`) export จาก `schema.ts` เพื่อให้ทุกที่ใช้ค่าชุดเดียวกัน
  — `pending` ไม่นับ เพราะ staff อาจปฏิเสธ
- FK เป็น `ON DELETE RESTRICT` ทั้งคู่ ลบอุปกรณ์ที่ยังมีประวัติการยืมค้างไม่ได้
  ต้องเคลียร์ `borrows` ก่อน

## ใช้จากฝั่ง backend

`db/` build ออกมาสองแบบ ESM (`dist/db`) และ CommonJS (`dist/cjs/db`)
ฝั่ง backend เป็น `"type": "commonjs"` จึง `require()` ได้ตรงๆ

```bash
pnpm build          # ต้อง build ก่อนใช้งานจากที่อื่น
```

```jsonc
// backend/package.json — เพิ่ม dependency แบบ path
"dependencies": {
  "db": "file:../db"
}
```

```js
const { equipmentModel, borrowModel, userModel } = require('db');
```

ชื่อฟังก์ชันและหน้าตาข้อมูลที่คืนกลับ ตรงกับ `backend/src/models/*.js` เดิมทุกตัว

| model | ฟังก์ชัน |
| --- | --- |
| `userModel` | `listAll` `findById` `setRole` |
| `equipmentModel` | `listAll` `findById` `borrowedCount` `create` `update` `remove` + `HOLDING` |
| `borrowModel` | `listAll` `listByBorrower` `findById` `create` `setStatus` `markReturned` |

สิ่งที่รับประกันว่าเหมือนเดิม:

- คีย์เป็น camelCase ตรงกับ `frontend/src/types.ts`
- `findById` คืน `undefined` เมื่อไม่พบ (ไม่ใช่ `null`) — controller ที่เช็ค `if (!item)` ใช้ได้เลย
- `equipment` มี `available` ที่คำนวณมาแล้วติดมาด้วยทุกแถว
- `createdAt` / `returnedAt` เป็น ISO string ไม่ใช่ Date object
- `equipmentModel.remove()` คืนจำนวน borrows ที่ถูกลบไป

**จุดเดียวที่ backend ต้องแก้: ทุกฟังก์ชันเป็น async** เพราะไดรเวอร์ Postgres
ไม่มีโหมด synchronous แบบ better-sqlite3 — ต้องเติม `await` ที่ทุกจุดที่เรียก
แล้วทำ controller เป็น `async` ตาม (`wrap()` ที่มีอยู่แล้วรองรับ promise อยู่)

```js
// เดิม
const item = equipmentModel.findById(id);
// ใหม่
const item = await equipmentModel.findById(id);
```

> `setStatus(id, 'returned')` ต่างจากเวอร์ชัน SQLite เล็กน้อย: จะเซ็ต `returnedAt` ให้ด้วย
> เพราะ schema ฝั่ง Postgres มี CHECK บังคับว่า `returned_at` มีค่าได้เฉพาะตอน status เป็น
> `returned` — controller ปัจจุบันเรียกผ่าน `markReturned` อยู่แล้วจึงไม่กระทบ

## ยังไม่ได้ทำ

- `_entrypoint/init.sh` ให้สิทธิ์ `GRANT ALL ON DATABASE` กับ app user ซึ่งกว้างเกินจำเป็น
  สำหรับ production ควรลดเหลือเฉพาะสิทธิ์ที่ใช้จริง
- ตาราง `users` ยังไม่มีคอลัมน์สำหรับ authentication (password hash / provider id)
  เพราะระบบยังใช้ header `x-user-id` แทน login จริง
- หนึ่งแถวใน `borrows` = ยืมหนึ่งชิ้น ถ้าต้องการยืมหลายชิ้นในรายการเดียว
  ต้องเพิ่มคอลัมน์ `quantity` แล้วแก้การนับจาก `COUNT(*)` เป็น `SUM(quantity)`
