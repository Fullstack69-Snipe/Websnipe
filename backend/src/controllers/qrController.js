const equipmentModel = require("../models/equipmentModel");
const { notFound, badRequest } = require("../utils/HttpError");
// QR encodes a URL/path to the existing equipment. It is an identifier, not an authorization token.
module.exports = {
  async get(req, res) {
    const e = await equipmentModel.findById(req.params.id);
    if (!e) throw notFound("ไม่พบอุปกรณ์");
    const origin = (process.env.APP_URL || "http://localhost:6002").replace(
      /\/$/,
      "",
    );
    res.json({
      equipmentId: e.id,
      qrPayload: `${origin}/equipment/${encodeURIComponent(e.id)}`,
      borrowApi: "/api/borrows",
    });
  },
  async resolve(req, res) {
    const value = req.body?.payload;
    if (typeof value !== "string" || value.length > 2048)
      throw badRequest("QR payload ไม่ถูกต้อง");
    let id;
    try {
      const u = new URL(value);
      const allowed = new URL(process.env.APP_URL || "http://localhost:6002");
      if (u.origin !== allowed.origin) throw Error();
      const m = u.pathname.match(/^\/equipment\/([^/]+)$/);
      if (!m) throw Error();
      id = decodeURIComponent(m[1]);
    } catch {
      throw badRequest("QR ไม่ใช่รหัสอุปกรณ์ของระบบนี้");
    }
    const item = await equipmentModel.findById(id);
    if (!item) throw notFound("ไม่พบอุปกรณ์");
    res.json(item);
  },
};
