// src/utils/HttpError.js
// error ที่พ่วง HTTP status มาด้วย ใช้ทั่วทั้ง controller
// ข้อความ error เป็นภาษาไทยให้ตรงกับที่ mockApi เคย throw ไว้
// frontend จึงแสดงข้อความเดิมได้โดยไม่ต้องแก้

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const badRequest = (msg) => new HttpError(400, msg);
const forbidden = (msg) => new HttpError(403, msg);
const notFound = (msg) => new HttpError(404, msg);
const conflict = (msg) => new HttpError(409, msg);

module.exports = { HttpError, badRequest, forbidden, notFound, conflict };
