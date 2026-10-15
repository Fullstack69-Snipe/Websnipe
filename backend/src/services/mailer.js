// src/services/mailer.js
// ส่งอีเมลแจ้งเตือน — ไม่ตั้ง SMTP_HOST = ปิดอีเมล เหลือแจ้งเตือนในเว็บอย่างเดียว
//
// ตัวอย่าง Gmail: SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_USER=<อีเมล> SMTP_PASS=<App password>

const nodemailer = require('nodemailer');

const enabled = Boolean(process.env.SMTP_HOST);
const port = Number(process.env.SMTP_PORT) || 587;

const transport = enabled
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null;

const FROM = process.env.SMTP_FROM || `BORROW APP <${process.env.SMTP_USER || 'no-reply@localhost'}>`;

// ส่งไม่สำเร็จแค่ log ไว้ — อีเมลพังต้องไม่ทำให้การอนุมัติ/คืนของล้มตาม
async function sendMail(to, subject, text) {
  if (!transport || !to) return;
  try {
    await transport.sendMail({ from: FROM, to, subject, text });
  } catch (err) {
    console.error(`ส่งอีเมลถึง ${to} ไม่สำเร็จ:`, err.message);
  }
}

module.exports = { sendMail, mailEnabled: enabled };
