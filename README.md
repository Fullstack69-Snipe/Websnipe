# BORROW APP — ระบบยืม-คืนอุปกรณ์

เว็บแอปสำหรับยืม-คืนอุปกรณ์ภายในองค์กร แบ่งสิทธิ์ 3 ระดับ (ผู้ยืม / เจ้าหน้าที่ / ผู้ดูแลระบบ)
เข้าสู่ระบบด้วยบัญชี Google, GitHub หรือ Discord

React + Express + PostgreSQL รันทั้งระบบด้วย Docker Compose ไฟล์เดียว

- ขอยืมแบบเลือกช่วงวัน ระบบกันจองทับให้ — หน้าอุปกรณ์มีปฏิทินบอกวันที่ว่าง
- อุปกรณ์แบ่งตามแผนก เจ้าหน้าที่จัดการได้เฉพาะแผนกตัวเอง
- ติด QR บนตัวของ (พิมพ์ได้ทีละชิ้นหรือทั้งแผนกเป็นแผ่น) สแกนแล้วขอยืม/รับของ/คืนของได้จากหน้านั้นเลย
- แจ้งเตือนในเว็บ (และอีเมลถ้าตั้ง SMTP) เมื่อสถานะเปลี่ยน ใกล้ครบกำหนด และเกินกำหนด
- หน้ารายงานพร้อมส่งออก CSV เปิดใน Excel ได้
- ติดตั้งเป็นแอปบนมือถือได้ (Add to Home Screen) มีโหมดมืด

---

## เริ่มใช้งาน

```bash
cp .env.example .env     # แก้รหัสผ่าน + ใส่ OAuth credentials (ดูหัวข้อถัดไป)
docker compose up -d --build
```

เปิด <http://localhost:6002>

ตอนบูตครั้งแรก backend จะรัน migration และใส่ข้อมูลตัวอย่างให้เอง
รันซ้ำได้ ถ้ามีข้อมูลอยู่แล้วจะข้ามการ seed

ข้อมูลตัวอย่างมี 2 แผนก อุปกรณ์ 6 ชิ้นพร้อมรูปจริง และคำขอยืมครบทุกสถานะ
(รูปมาจาก Wikimedia Commons — เครดิตอยู่ที่ [`frontend/public/seed/CREDITS.md`](frontend/public/seed/CREDITS.md))
อยากล้างแล้วใส่ใหม่: `docker compose exec backend sh -c "cd /app/db && node dist/db/seed.js --reset"`

> ยังเข้าสู่ระบบไม่ได้จนกว่าจะตั้งค่า OAuth อย่างน้อยหนึ่งช่องทาง

---

## ตั้งค่าเข้าสู่ระบบ

ต้องไปลงทะเบียนแอปกับผู้ให้บริการเอง ช่องทางไหนไม่ได้ตั้งค่า ปุ่มของช่องทางนั้นจะไม่ขึ้น

| ผู้ให้บริการ | ลงทะเบียนที่ | Redirect / Callback URL |
| --- | --- | --- |
| Google | [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth client ID (Web application) | `http://localhost:6002/api/auth/google/callback` |
| GitHub | [github.com/settings/developers](https://github.com/settings/developers) → New OAuth App | `http://localhost:6002/api/auth/github/callback` |
| Discord | [discord.com/developers/applications](https://discord.com/developers/applications) → New Application → OAuth2 → Redirects | `http://localhost:6002/api/auth/discord/callback` |

เอาค่าที่ได้ใส่ `.env` แล้วรีสตาร์ต backend:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# อีเมลของคุณเอง เพื่อให้ได้สิทธิ์ admin ตอน login
ADMIN_EMAILS=you@example.com
```

```bash
docker compose up -d backend
```

> **`ADMIN_EMAILS` สำคัญ** — ผู้สมัครใหม่ทุกคนได้สิทธิ์ "ผู้ยืม" เสมอ
> ถ้าไม่ตั้งค่านี้จะไม่มีใครเป็น admin ได้เลย ต้องเข้าไปแก้ในฐานข้อมูลเอง
> เมื่อมี admin คนแรกแล้ว จะตั้งสิทธิ์ให้คนอื่นผ่านหน้า "จัดการผู้ใช้" ได้

> ถ้าเปลี่ยนโดเมนหรือพอร์ต ต้องแก้ `APP_URL` ใน `.env` **และ** แก้ callback URL
> ที่ลงทะเบียนไว้ฝั่งผู้ให้บริการให้ตรงกัน ไม่งั้นจะโดนปฏิเสธ

---

## สถาปัตยกรรม

```
เบราว์เซอร์
    |
    v
pf-frontend   nginx :6000  -- เสิร์ฟไฟล์ static + proxy /api และ /uploads
    |
    v
pf-backend    express :3000 -- ตรรกะทั้งหมด ตรวจสิทธิ์ จัดการ session
    |
    v
pf-db         postgres :5432
```

| โฟลเดอร์ | หน้าที่ | เอกสาร |
| --- | --- | --- |
| [`frontend/`](frontend/) | หน้าจอ React + Vite เสิร์ฟผ่าน nginx | [README](frontend/README.md) |
| [`backend/`](backend/) | REST API + OAuth + สิทธิ์การใช้งาน | [README](backend/README.md) |
| [`db/`](db/) | schema, migration, seed, ชั้น model | [README](db/README.md) |

backend ไม่ได้ต่อฐานข้อมูลเอง แต่เรียกผ่านแพ็กเกจ `db` ที่ import แบบ `file:../db`

---

## คำสั่งที่ใช้บ่อย

```bash
docker compose up -d --build     # รันทั้งระบบ
docker compose logs -f backend   # ดู log
docker compose ps                # ดูสถานะ + healthcheck
docker compose down              # ปิด (ข้อมูลยังอยู่)
docker compose down -v           # ปิดและลบข้อมูลทั้งหมด
```

ทดสอบ API ทั้ง 122 เคส (ต้องรันระบบอยู่):

```bash
cd backend && BASE=http://localhost:6002/api node db/smoke-test.js
```

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) รันทุก push เข้า main และทุก PR:
lint ของ frontend + build ทั้งระบบด้วย compose (ตรวจ type ของ db/frontend, migration, seed) + smoke test ชุดนี้

---

## ตัวแปรใน .env

| ตัวแปร | ใช้ทำอะไร |
| --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | superuser ของ container ใช้ตอน init ครั้งแรก |
| `POSTGRES_APP_USER` / `POSTGRES_APP_PASSWORD` | บัญชีที่ backend ใช้เชื่อมต่อจริง |
| `POSTGRES_PORT` | พอร์ต postgres ที่เปิดออกมาที่เครื่อง (สำหรับ drizzle studio) |
| `NGINX_PORT` | พอร์ตที่เปิดเว็บ (ค่าเริ่มต้น 6002) |
| `NGINX_PROXY` | ปลายทางที่ nginx proxy `/api` ไปหา |
| `APP_URL` | URL ที่ผู้ใช้เปิดจริง ใช้ประกอบ callback URL ของ OAuth |
| `GOOGLE_*` / `GITHUB_*` / `DISCORD_*` | credentials ของแต่ละช่องทาง ว่างไว้ = ปิดช่องทางนั้น |
| `ADMIN_EMAILS` | อีเมลที่ได้สิทธิ์ admin อัตโนมัติ คั่นด้วย comma |
| `CORS_ORIGINS` | origin ที่เรียก API แบบแนบคุกกี้ได้ คั่นด้วย comma |
| `SESSION_DAYS` | อายุ session (วัน) ค่าเริ่มต้น 30 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | อีเมลแจ้งเตือน ว่างไว้ = แจ้งเตือนในเว็บอย่างเดียว |

`.env` ทุกไฟล์ถูก gitignore ไว้ — ตัวอย่างอยู่ใน `.env.example`

---

## รันทีละส่วนตอนพัฒนา

แต่ละโฟลเดอร์มี `docker-compose.yml` ของตัวเองไว้รันเฉพาะส่วนนั้น
ต้องยก `db/` ขึ้นก่อนเสมอ เพราะเป็นตัวสร้าง network `preflight_pf-net`

```bash
cd db && docker compose up -d      # postgres อย่างเดียว
cd db && pnpm db:studio            # ดู/แก้ข้อมูลผ่านเบราว์เซอร์
```

วิธีรัน frontend ด้วย vite dev server ดูใน [frontend/README.md](frontend/README.md)

---

## แก้ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
| --- | --- |
| หน้า sign-in บอกว่ายังไม่ได้ตั้งค่า | ยังไม่ได้ใส่ `*_CLIENT_ID` ใน `.env` หรือยังไม่ได้รีสตาร์ต backend |
| ผู้ให้บริการปฏิเสธตอน login | callback URL ที่ลงทะเบียนไว้ไม่ตรงกับ `APP_URL` |
| login ได้แต่เข้าเมนูจัดการไม่ได้ | ยังเป็น role `user` — ใส่อีเมลตัวเองใน `ADMIN_EMAILS` แล้ว login ใหม่ |
| `password authentication failed` ตอน migrate | volume เก่าค้างอยู่ ทำให้ `init.sh` ไม่ได้รัน → `docker compose down -v` แล้วขึ้นใหม่ |
| แก้ `init.sh` แล้ว container ไม่สนใจ | สคริปต์รันเฉพาะตอน volume ว่างเท่านั้น ต้อง `down -v` |

---

## ข้อจำกัดที่ยังมีอยู่

- หนึ่งรายการยืม = อุปกรณ์หนึ่งชิ้น ยังยืมหลายชิ้นในคำขอเดียวไม่ได้
- ลบอุปกรณ์แล้ว รายละเอียดของรายการยืมเก่า (ใครยืม เหตุผลที่ปฏิเสธ หมายเหตุตอนคืน) จะหายไปด้วย
  เหลือแค่บรรทัดใน `equipment_logs` ว่าลบไปกี่รายการ
- รูปที่อัปโหลดเก็บใน volume ของ container ไม่ได้ขึ้น object storage และลบอุปกรณ์แล้วไฟล์รูปยังค้างอยู่
- รายงานและการแบ่งหน้าคำนวณในเบราว์เซอร์จากรายการที่โหลดมาทั้งหมด — ถ้าข้อมูลเป็นหมื่นแถวควรย้ายไปทำที่ backend
- ติดตั้งเป็นแอปได้ แต่ยังไม่มี service worker จึงใช้งานออฟไลน์ไม่ได้ (และต้องเปิดผ่าน https)
- คุกกี้ session ตั้ง `Secure` อัตโนมัติเฉพาะตอน `NODE_ENV=production` + `APP_URL` เป็น https
