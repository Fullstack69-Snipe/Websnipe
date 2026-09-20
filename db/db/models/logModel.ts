// ประวัติการเปลี่ยนแปลงของอุปกรณ์
//
// ทุกฟังก์ชันที่เขียน log รับ tx เข้ามาได้ เพื่อให้เขียนอยู่ในทรานแซกชันเดียว
// กับการเปลี่ยนแปลงจริง — ไม่งั้นจะมีกรณีที่เปลี่ยนสถานะสำเร็จแต่ log หาย
// (หรือกลับกัน) แล้วประวัติจะเชื่อถือไม่ได้

import { desc, eq } from "drizzle-orm";
import { dbClient } from "@db/client.js";
import {
  equipmentLogsTable,
  type BorrowStatus,
  type LogAction,
} from "@db/schema.js";
import { toIso } from "@db/models/helpers.js";

export type LogInput = {
  equipmentId: string | null;
  equipmentName: string;
  borrowId?: string | null;
  actorId: string | null;
  actorName: string;
  action: LogAction;
  fromStatus?: BorrowStatus | null;
  toStatus?: BorrowStatus | null;
  note?: string | null;
};

export type LogRow = {
  id: number;
  equipmentId: string | null;
  equipmentName: string;
  borrowId: string | null;
  actorId: string | null;
  actorName: string;
  action: LogAction;
  fromStatus: BorrowStatus | null;
  toStatus: BorrowStatus | null;
  note: string | null;
  createdAt: string;
};

// dbClient กับ tx ใช้ API ชุดเดียวกัน จึงรับตัวไหนก็ได้
type Executor = Pick<typeof dbClient, "insert" | "select">;

const toLogRow = (row: Omit<LogRow, "createdAt"> & { createdAt: Date }): LogRow => ({
  ...row,
  createdAt: toIso(row.createdAt),
});

export const logModel = {
  /** เขียน log หนึ่งแถว — ส่ง tx มาด้วยถ้าอยู่ในทรานแซกชัน */
  async write(input: LogInput, tx: Executor = dbClient): Promise<void> {
    await tx.insert(equipmentLogsTable).values({
      equipmentId: input.equipmentId,
      equipmentName: input.equipmentName,
      borrowId: input.borrowId ?? null,
      actorId: input.actorId,
      actorName: input.actorName,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      note: input.note ?? null,
    });
  },

  /** ประวัติของอุปกรณ์ชิ้นหนึ่ง ใหม่สุดขึ้นก่อน */
  async listByEquipment(equipmentId: string, limit = 100): Promise<LogRow[]> {
    const rows = await dbClient
      .select()
      .from(equipmentLogsTable)
      .where(eq(equipmentLogsTable.equipmentId, equipmentId))
      .orderBy(desc(equipmentLogsTable.createdAt))
      .limit(limit);

    return rows.map(toLogRow);
  },

  /** ประวัติทั้งระบบ ใหม่สุดขึ้นก่อน */
  async listAll(limit = 200): Promise<LogRow[]> {
    const rows = await dbClient
      .select()
      .from(equipmentLogsTable)
      .orderBy(desc(equipmentLogsTable.createdAt))
      .limit(limit);

    return rows.map(toLogRow);
  },
};

export default logModel;
