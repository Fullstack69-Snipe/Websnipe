// src/utils/wrap.js
// ห่อ handler ให้ error ที่ throw ออกมา (รวมถึงใน async) วิ่งไปที่ errorHandler เสมอ
// Express 4 ไม่จับ rejected promise ให้เอง จึงต้องห่อไว้

module.exports = function wrap(handler) {
  return (req, res, next) => {
    try {
      const result = handler(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };
};
