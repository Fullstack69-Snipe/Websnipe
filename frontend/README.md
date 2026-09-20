# frontend

หน้าจอของระบบยืม-คืนอุปกรณ์ — React 19 + TypeScript + Vite
สไตล์ใช้ [Pico CSS](https://picocss.com) แบบ classless เป็นหลัก จึงมี CSS ที่เขียนเองน้อยมาก

ตอน deploy จะถูก build เป็นไฟล์ static แล้วเสิร์ฟด้วย nginx
ซึ่ง proxy `/api` กับ `/uploads` ต่อไปที่ backend (ดู `nginx.conf.template`)

---

## รันด้วย Docker (ปกติใช้แบบนี้)

รันจาก root ของ repo — ดู [README หลัก](../README.md)

```bash
docker compose up -d --build
```

## รันด้วย vite dev server (ตอนแก้ UI)

vite ไม่ได้ตั้ง proxy ไว้ ต้องบอก URL ของ backend ตรงๆ ผ่าน `VITE_API_BASE`

```bash
# ยก backend + db ขึ้นก่อน (จาก root)
docker compose up -d postgres backend

cd frontend
echo 'VITE_API_BASE=http://localhost:6002/api' > .env.local
pnpm install
pnpm dev                     # http://localhost:5173
```

`http://localhost:5173` อยู่ใน `CORS_ORIGINS` ของ backend อยู่แล้ว คุกกี้ session
จึงส่งข้ามพอร์ตได้ (ทุก request ตั้ง `credentials: 'include'` ไว้)

### โหมด mock — แก้ UI โดยไม่ต้องเปิด backend

```bash
VITE_USE_MOCK=true pnpm dev
```

ข้อมูลทั้งหมดอยู่ในหน่วยความจำ (`src/lib/mockApi.ts`) รีเฟรชแล้วรีเซ็ต
โหมดนี้ถือว่า login เป็น `u1` ตลอด จึงไม่เห็นหน้า sign-in

| คำสั่ง | ทำอะไร |
| --- | --- |
| `pnpm dev` | dev server พร้อม hot reload |
| `pnpm build` | ตรวจ type แล้ว build ลง `dist/` |
| `pnpm preview` | ลองเปิดผลลัพธ์ที่ build แล้ว |
| `pnpm lint` | oxlint |

---

## โครงสร้าง

```
src/
├── main.tsx              จุดเริ่ม — ครอบ <BrowserRouter> และตั้ง locale ไทยให้ dayjs
├── App.tsx               เส้นทางทั้งหมด + ตัวกันสิทธิ์ (Guard)
├── types.ts              type กลางที่ใช้ร่วมกับ backend
│
├── pages/
│   ├── SignIn.tsx        ปุ่มเข้าสู่ระบบ (ขึ้นเฉพาะช่องทางที่ backend เปิดไว้)
│   ├── EquipmentList.tsx รายการอุปกรณ์ + ค้นหา + ขอยืม
│   ├── MyBorrows.tsx     การยืมของฉัน + แจ้งคืน
│   ├── ManageEquipment.tsx  เพิ่ม/แก้/ลบอุปกรณ์            (staff, admin)
│   ├── BorrowRequests.tsx   อนุมัติ/ปฏิเสธ/รับคืน          (staff, admin)
│   └── ManageUsers.tsx      ตั้งสิทธิ์ผู้ใช้                (admin)
│
├── components/
│   ├── Layout.tsx        แถบนำทาง + เมนูผู้ใช้ + ปุ่มออกจากระบบ
│   ├── EquipmentCard.tsx การ์ดอุปกรณ์ในหน้ารายการ
│   ├── EquipmentForm.tsx ฟอร์มเพิ่ม/แก้อุปกรณ์ (อัปโหลดรูปด้วย)
│   ├── StatusBadge.tsx   ป้ายสถานะ
│   └── ProviderIcon.tsx  โลโก้ Google / GitHub / Discord (SVG ฝังในไฟล์)
│
└── lib/
    ├── api.ts            เลือกใช้ realApi หรือ mockApi ตาม VITE_USE_MOCK
    ├── realApi.ts        เรียก backend จริงด้วย fetch
    ├── mockApi.ts        ข้อมูลจำลองในหน่วยความจำ
    ├── auth.tsx          AuthProvider — ถาม /api/me ตอนเปิดแอป
    ├── useAuth.ts        hook อ่านผู้ใช้ปัจจุบัน
    └── labels.ts         คำแปลภาษาไทยของ status และ role
```

---

## การเข้าสู่ระบบและสิทธิ์

`AuthProvider` เรียก `/api/me` ครั้งเดียวตอนเปิดแอป

- ได้ผู้ใช้กลับมา = มี session อยู่
- ได้ 401 = ยังไม่ได้เข้าสู่ระบบ → `Guard` พาไปหน้า `/signin`

ตัวตนอยู่ในคุกกี้ `pf_session` ซึ่งเป็น httpOnly — JavaScript อ่านไม่ได้และไม่จำเป็นต้องอ่าน
แค่ถูกแนบไปกับทุก request เอง

ปุ่มเข้าสู่ระบบเป็น `<a href="/api/auth/google">` ไม่ใช่ `fetch` เพราะต้องให้เบราว์เซอร์
redirect ออกไปหน้าเว็บของผู้ให้บริการจริงๆ

`Guard` ใน `App.tsx` ซ่อนหน้าที่สิทธิ์ไม่ถึง และ `Layout` ซ่อนเมนู
**แต่ทั้งสองอย่างเป็นแค่ความสะดวกของหน้าจอ — สิทธิ์จริงตรวจที่ backend ทุก request**

| เส้นทาง | สิทธิ์ที่ต้องมี |
| --- | --- |
| `/signin` | ไม่ต้อง login |
| `/equipment`, `/my-borrows` | login แล้ว |
| `/manage/equipment`, `/manage/requests` | staff, admin |
| `/admin/users` | admin |

---

## การเรียก API

ทุกหน้า import จาก `lib/api.ts` ไฟล์เดียว ไม่เรียก `fetch` ตรงๆ

```ts
import { api } from '../lib/api'

const items = await api.listEquipment()
```

`realApi` กับ `mockApi` มีชื่อฟังก์ชันและ signature เหมือนกันทั้งหมด จึงสลับกันได้
โดยหน้าจอไม่ต้องแก้ — backend ตอบ error เป็น `{ error: "ข้อความไทย" }` แล้ว
`realApi` โยนเป็น `Error` ให้ UI จับไปแสดงได้เหมือนเดิม

การอัปโหลดรูปแยกเป็นสองขั้น เพราะ `imageUrl` ใน `types.ts` เป็น string:

```ts
const url = await api.uploadImage(file)
await api.createEquipment({ name, description, quantity, imageUrl: url })
```

---

## สิ่งที่ควรรู้

- **`available` ไม่ได้เก็บในฐานข้อมูล** — backend คำนวณให้ทุกครั้งจากจำนวนที่ถูกยืมอยู่
  หน้าจอแค่แสดงผล ไม่ต้องคำนวณเอง
- **"เกินกำหนด" ก็คำนวณหน้าจอเอง** จาก `status === 'approved'` กับ `dueDate < วันนี้`
  ไม่มีสถานะ overdue ในฐานข้อมูล
- `axios` ติดตั้งไว้ใน `package.json` แต่ยังไม่ได้ใช้ที่ไหน (ทุกที่ใช้ `fetch`)
- มีทั้ง `react-router` และ `react-router-dom` ใน dependencies แต่โค้ดทั้งหมด
  import จาก `react-router-dom` อย่างเดียว
