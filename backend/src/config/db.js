// src/config/db.js
// เปิดการเชื่อมต่อ SQLite และรัน schema.sql ให้อัตโนมัติ

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', '..', 'db', 'data.sqlite');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// รัน schema ทุกครั้งที่เริ่มระบบ (ทุกคำสั่งเป็น IF NOT EXISTS จึงปลอดภัย)
const schemaPath = path.join(__dirname, '..', '..', 'db', 'schema.sql');
db.exec(fs.readFileSync(schemaPath, 'utf8'));

module.exports = db;
module.exports.DB_FILE = DB_FILE;
