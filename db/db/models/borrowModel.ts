// จัดการตาราง borrows
//
// ทุก SELECT join equipment + users เพื่อส่ง equipmentName / borrowerName กลับไปด้วย
// ให้ตรงกับ type Borrow ใน frontend/src/types.ts (frontend อ่าน field เหล่านี้ตรงๆ)
//
// เทียบเท่า backend/src/models/borrowModel.js (SQLite) ทุกฟังก์ชัน
// ต่างกันแค่ทุกตัวเป็น async

import crypto from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { dbClient } from "@db/client.js";
import {
  borrowsTable,
  equipmentTable,
  usersTable,
  type BorrowStatus,
} from "@db/schema.js";
import { firstOrUndefined, toIso, toIsoOrNull } from "@db/models/helpers.js";

export type BorrowRow = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  borrowerId: string;
  borrowerName: string;
  dueDate: string;
  status: BorrowStatus;
  createdAt: string;
  returnedAt: string | null;
};

// คอลัมน์ชุดเดียวกับ SELECT_BORROW ของเวอร์ชัน SQLite
const selection = {
  id: borrowsTable.id,
  equipmentId: borrowsTable.equipmentId,
  equipmentName: equipmentTable.name,
  borrowerId: borrowsTable.borrowerId,
  borrowerName: usersTable.fullName,
  dueDate: borrowsTable.dueDate,
  status: borrowsTable.status,
  createdAt: borrowsTable.createdAt,
  returnedAt: borrowsTable.returnedAt,
};

// JOIN ทั้งสองตารางเป็น inner join เหมือนเดิม (FK บังคับว่ามีแถวปลายทางเสมอ)
const baseQuery = () =>
  dbClient
    .select(selection)
    .from(borrowsTable)
    .innerJoin(equipmentTable, eq(equipmentTable.id, borrowsTable.equipmentId))
    .innerJoin(usersTable, eq(usersTable.id, borrowsTable.borrowerId));

// Postgres คืน timestamptz เป็น Date — frontend คาด string
const toBorrowRow = (row: {
  id: string;
  equipmentId: string;
  equipmentName: string;
  borrowerId: string;
  borrowerName: string;
  dueDate: string;
  status: BorrowStatus;
  createdAt: Date;
  returnedAt: Date | null;
}): BorrowRow => ({
  ...row,
  createdAt: toIso(row.createdAt),
  returnedAt: toIsoOrNull(row.returnedAt),
});

export const borrowModel = {
  // เรียงใหม่สุดขึ้นก่อน
  async listAll(): Promise<BorrowRow[]> {
    const rows = await baseQuery().orderBy(desc(borrowsTable.createdAt));
    return rows.map(toBorrowRow);
  },

  async listByBorrower(borrowerId: string): Promise<BorrowRow[]> {
    const rows = await baseQuery()
      .where(eq(borrowsTable.borrowerId, borrowerId))
      .orderBy(desc(borrowsTable.createdAt));

    return rows.map(toBorrowRow);
  },

  async findById(id: string): Promise<BorrowRow | undefined> {
    const rows = await baseQuery().where(eq(borrowsTable.id, id)).limit(1);
    const row = firstOrUndefined(rows);
    return row === undefined ? undefined : toBorrowRow(row);
  },

  async create(input: {
    equipmentId: string;
    borrowerId: string;
    dueDate: string;
  }): Promise<BorrowRow | undefined> {
    const id = crypto.randomUUID();

    await dbClient.insert(borrowsTable).values({
      id,
      equipmentId: input.equipmentId,
      borrowerId: input.borrowerId,
      dueDate: input.dueDate,
      status: "pending",
    });

    return borrowModel.findById(id);
  },

  /**
   * เปลี่ยนสถานะรายการยืม
   *
   * ต่างจากเวอร์ชัน SQLite ตรงที่ต้องดูแล returnedAt ไปด้วย เพราะ schema ฝั่ง
   * Postgres มี CHECK บังคับว่า returned_at จะมีค่าก็ต่อเมื่อ status = 'returned'
   * ถ้าเซ็ตสถานะเฉยๆ แบบเดิมจะติด constraint ทันที
   */
  async setStatus(
    id: string,
    status: BorrowStatus,
  ): Promise<BorrowRow | undefined> {
    await dbClient
      .update(borrowsTable)
      .set({
        status,
        returnedAt: status === "returned" ? new Date() : null,
      })
      .where(eq(borrowsTable.id, id));

    return borrowModel.findById(id);
  },

  async markReturned(id: string): Promise<BorrowRow | undefined> {
    await dbClient
      .update(borrowsTable)
      .set({ status: "returned", returnedAt: new Date() })
      .where(eq(borrowsTable.id, id));

    return borrowModel.findById(id);
  },
};

export default borrowModel;
