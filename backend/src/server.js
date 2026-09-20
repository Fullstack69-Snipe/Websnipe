// src/server.js
// จุดเริ่มต้นของ backend — ฟังพอร์ต 3000 ให้ตรงกับ NGINX_PROXY=http://pf-backend:3000

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { authModel } = require('db');
const { attachIdentity } = require('./middleware/identity');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { UPLOAD_DIR } = require('./middleware/upload');

const equipmentRoutes = require('./routes/equipmentRoutes');
const borrowRoutes = require('./routes/borrowRoutes');
const userRoutes = require('./routes/userRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const authRoutes = require('./routes/authRoutes');
const userController = require('./controllers/userController');
const wrap = require('./utils/wrap');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ตอน deploy จริง nginx proxy เข้ามา origin เดียวกันอยู่แล้ว CORS จึงแทบไม่ถูกใช้
// เปิดไว้เฉพาะ origin ที่รู้จัก เพื่อให้ vite dev server ยิงตรงมาได้
//
// ห้ามใช้ origin: true คู่กับ credentials: true เพราะมันสะท้อน Origin อะไรก็ได้กลับไป
// เท่ากับอนุญาตให้เว็บไหนก็ได้เรียก API แบบแนบคุกกี้ผู้ใช้
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:6002')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    // ไม่มี Origin = เรียกจาก server/curl/same-origin ปล่อยผ่าน
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // ไม่โยน error เพราะจะกลายเป็น 500 + log รก
    // แค่ไม่ใส่ header ACAO กลับไป เบราว์เซอร์จะบล็อกฝั่งนั้นเอง
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// เสิร์ฟรูปที่อัปโหลด — ต้องมาก่อน attachIdentity เพราะไม่ต้องรู้ตัวตนก็ดูรูปได้
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: 'postgres', time: new Date().toISOString() });
});

// login/logout ต้องเรียกได้ตอนยังไม่มีตัวตน จึงวางไว้ก่อน attachIdentity
app.use('/api/auth', authRoutes);

// ทุก route ใต้ /api ที่เหลือต้องผ่านการระบุตัวตนก่อน
app.use('/api', wrap(attachIdentity));

app.get('/api/me', wrap(userController.me));
app.use('/api/equipment', equipmentRoutes);
app.use('/api/borrows', borrowRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// กวาด session ที่หมดอายุทิ้งวันละครั้ง
// การหมดอายุถูกบังคับตอนอ่านอยู่แล้ว ตรงนี้แค่กันตารางบวมไปเรื่อยๆ
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const sweep = () =>
  authModel
    .deleteExpiredSessions()
    .then((n) => n > 0 && console.log(`ลบ session หมดอายุ ${n} รายการ`))
    .catch((err) => console.error('กวาด session ไม่สำเร็จ:', err));

setInterval(sweep, SWEEP_INTERVAL_MS).unref();
sweep();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`pf-backend listening on http://0.0.0.0:${PORT}`);
  console.log(`database: postgres (ผ่านแพ็กเกจ db)`);
  console.log(`uploads : ${UPLOAD_DIR}`);
});
