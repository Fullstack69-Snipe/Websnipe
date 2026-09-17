// src/server.js
// จุดเริ่มต้นของ backend — ฟังพอร์ต 3000 ให้ตรงกับ NGINX_PROXY=http://pf-backend:3000

const path = require('path');
const express = require('express');
const cors = require('cors');

const db = require('./config/db');
const { attachIdentity } = require('./middleware/identity');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { UPLOAD_DIR } = require('./middleware/upload');

const equipmentRoutes = require('./routes/equipmentRoutes');
const borrowRoutes = require('./routes/borrowRoutes');
const userRoutes = require('./routes/userRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const userController = require('./controllers/userController');
const wrap = require('./utils/wrap');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// nginx ฝั่ง frontend proxy เข้ามาอยู่แล้ว CORS จึงไม่จำเป็นตอน deploy
// แต่เปิดไว้ให้รัน vite dev server (localhost:5173) ยิงตรงมาได้
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// เสิร์ฟรูปที่อัปโหลด — ต้องมาก่อน attachIdentity เพราะไม่ต้องรู้ตัวตนก็ดูรูปได้
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: db.DB_FILE, time: new Date().toISOString() });
});

// ทุก route ใต้ /api ต้องผ่านการระบุตัวตนก่อน (ยังเป็น header-based ชั่วคราว)
app.use('/api', wrap(attachIdentity));

app.get('/api/me', wrap(userController.me));
app.use('/api/equipment', equipmentRoutes);
app.use('/api/borrows', borrowRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`pf-backend listening on http://0.0.0.0:${PORT}`);
  console.log(`database: ${db.DB_FILE}`);
  console.log(`uploads : ${UPLOAD_DIR}`);
});
