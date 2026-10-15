// src/services/notify.js
// สร้างแจ้งเตือนตามเหตุการณ์ของการยืม + เตือนใกล้ครบกำหนด/เกินกำหนด
//
// แจ้งเตือนในเว็บรอให้เขียนเสร็จก่อนตอบ (หน้าจอจะได้เห็นทันที)
// ส่วนอีเมลส่งตามหลังโดยไม่รอ — SMTP ช้าหรือพังต้องไม่หน่วงการกดอนุมัติ

const { notificationModel, departmentModel, borrowModel, userModel } = require('db');
const { APP_URL } = require('../config/oauth');
const { sendMail } = require('./mailer');

const HOUR = 60 * 60 * 1000;

const until = (b) => b.details?.endAt ?? `${b.dueDate}T23:59:59+07:00`;

// วันที่ภาษาไทย ปี พ.ศ. ตามเวลาไทย เช่น "16 ต.ค. 2569 23:59"
const thaiDate = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dateText = (iso) => thaiDate.format(new Date(iso));

async function send(rows) {
  const created = await notificationModel.notify(rows);
  // ส่งอีเมลเฉพาะแจ้งเตือนที่เพิ่งสร้างจริง (ตัวที่ซ้ำถูกข้ามไปแล้ว)
  for (const n of created) {
    void userModel.findById(n.userId).then((u) =>
      sendMail(
        u?.email,
        `[BORROW APP] ${n.title}`,
        `${n.body ?? ''}\n\nเปิดดูในระบบ: ${APP_URL.replace(/\/$/, '')}${n.link ?? '/'}`,
      ),
    );
  }
  return created;
}

const toUser = (userId, borrow, type, title, body, link) => ({
  userId,
  borrowId: borrow.id,
  type,
  title,
  body,
  link,
});

async function toManagers(borrow, type, title, body, link) {
  const ids = await departmentModel.managersOf(borrow.equipmentId);
  return ids.map((id) => toUser(id, borrow, type, title, body, link));
}

const notify = {
  async requested(b) {
    return send(await toManagers(b, 'request_new', 'มีคำขอยืมใหม่',
      `${b.borrowerName} ขอยืม "${b.equipmentName}"${b.purpose ? ` — ${b.purpose}` : ''}`,
      '/manage/requests'));
  },

  async approved(b) {
    return send([toUser(b.borrowerId, b, 'approved', 'คำขอยืมได้รับอนุมัติแล้ว',
      `"${b.equipmentName}" พร้อมให้ไปรับแล้ว ไปรับที่เจ้าหน้าที่แล้วกดยืนยันรับของในระบบ`,
      `/equipment/${encodeURIComponent(b.equipmentId)}`)]);
  },

  async rejected(b) {
    return send([toUser(b.borrowerId, b, 'rejected', 'คำขอยืมถูกปฏิเสธ',
      `"${b.equipmentName}"${b.rejectReason ? ` — เหตุผล: ${b.rejectReason}` : ''}`,
      '/my-borrows')]);
  },

  async returnRequested(b) {
    return send(await toManagers(b, 'return_requested', 'ผู้ยืมแจ้งคืนอุปกรณ์',
      `${b.borrowerName} แจ้งคืน "${b.equipmentName}" รอตรวจรับ`,
      '/manage/requests'));
  },

  async returned(b) {
    return send([toUser(b.borrowerId, b, 'returned', 'รับคืนอุปกรณ์เรียบร้อย',
      `เจ้าหน้าที่รับคืน "${b.equipmentName}" แล้ว${b.returnNote ? ` — ${b.returnNote}` : ''}`,
      '/my-borrows')]);
  },

  /**
   * เตือนใกล้ครบกำหนด (เหลือไม่ถึง 24 ชม.) และเกินกำหนด — รันซ้ำได้ ไม่ส่งซ้ำ (unique ในตาราง)
   * shortcut: ดึงรายการยืมทั้งหมดมากรองในหน่วยความจำ — ถ้ารายการยืมเยอะเป็นแสนค่อยกรองใน SQL
   */
  async reminders(now = Date.now()) {
    const holding = (await borrowModel.listAll()).filter(
      (b) => b.status === 'approved' || b.status === 'returning',
    );
    let sent = 0;
    for (const b of holding) {
      const end = Date.parse(until(b));
      if (end < now) {
        sent += (await send([
          toUser(b.borrowerId, b, 'overdue', 'เกินกำหนดคืนอุปกรณ์แล้ว',
            `"${b.equipmentName}" ครบกำหนดคืน ${dateText(until(b))} กรุณานำมาคืนโดยเร็ว`,
            '/my-borrows'),
          ...(await toManagers(b, 'overdue_staff', 'มีอุปกรณ์เกินกำหนดคืน',
            `${b.borrowerName} ยังไม่คืน "${b.equipmentName}" (ครบกำหนด ${dateText(until(b))})`,
            '/manage/requests')),
        ])).length;
      } else if (end - now < 24 * HOUR && b.status === 'approved') {
        sent += (await send([toUser(b.borrowerId, b, 'due_soon', 'ใกล้ครบกำหนดคืนอุปกรณ์',
          `"${b.equipmentName}" ครบกำหนดคืน ${dateText(until(b))}`,
          '/my-borrows')])).length;
      }
    }
    return sent;
  },
};

// เรียกจาก controller: แจ้งเตือนพังต้องไม่ทำให้การทำรายการล้ม — log ไว้พอ
const safely = (fn) => async (borrow) => {
  try {
    if (borrow) await fn(borrow);
  } catch (err) {
    console.error('สร้างแจ้งเตือนไม่สำเร็จ:', err);
  }
};

module.exports = {
  notify,
  onRequested: safely(notify.requested),
  onApproved: safely(notify.approved),
  onRejected: safely(notify.rejected),
  onReturnRequested: safely(notify.returnRequested),
  onReturned: safely(notify.returned),
};
