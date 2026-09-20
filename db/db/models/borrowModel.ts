// จัดการตาราง borrows
//
// ทุก SELECT join equipment + users เพื่อส่ง equipmentName / borrowerName กลับไปด้วย
// ให้ตรงกับ type Borrow ใน frontend/src/types.ts (frontend อ่าน field เหล่านี้ตรงๆ)
//
// การเปลี่ยนสถานะทุกครั้งจะเขียน equipment_logs ในทรานแซกชันเดียวกันเสมอ
// ถ้าแยกกันเขียนจะมีจังหวะที่สถานะเปลี่ยนแล้วแต่ log หาย ประวัติจะเชื่อไม่ได้

import crypto from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { dbClient } from "@db/client.js";
import {
  borrowsTable,
  equipmentTable,
  usersTable,
  type BorrowStatus,
  type LogAction,
} from "@db/schema.js";
import { firstOrUndefined, toIso, toIsoOrNull } from "@db/models/helpers.js";
import { logModel } from "@db/models/logModel.js";

/** ผู้ที่ลงมือทำ ใช้บันทึกลงประวัติ */
export type Actor = { id: string; fullName: string };

export type BorrowRow = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  borrowerId: string;
  borrowerName: string;
  dueDate: string;
  status: BorrowStatus;
  purpose: string | null;
  approvedBy: string | null;
  approverName: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  receivedBy: string | null;
  returnNote: string | null;
  createdAt: string;
  returnedAt: string | null;
};

// alias แยกสองตัวเพราะ users ถูก join ซ้ำ (ผู้ยืม กับ ผู้อนุมัติ)
const approver = alias(usersTable, "approver");

const selection = {
  id: borrowsTable.id,
  equipmentId: borrowsTable.equipmentId,
  equipmentName: equipmentTable.name,
  borrowerId: borrowsTable.borrowerId,
  borrowerName: usersTable.fullName,
  dueDate: borrowsTable.dueDate,
  status: borrowsTable.status,
  purpose: borrowsTable.purpose,
  approvedBy: borrowsTable.approvedBy,
  approverName: approver.fullName,
  approvedAt: borrowsTable.approvedAt,
  rejectReason: borrowsTable.rejectReason,
  receivedBy: borrowsTable.receivedBy,
  returnNote: borrowsTable.returnNote,
  createdAt: borrowsTable.createdAt,
  returnedAt: borrowsTable.returnedAt,
};

const baseQuery = () =>
  dbClient
    .select(selection)
    .from(borrowsTable)
    .innerJoin(equipmentTable, eq(equipmentTable.id, borrowsTable.equipmentId))
    .innerJoin(usersTable, eq(usersTable.id, borrowsTable.borrowerId))
    // left join เพราะรายการที่ยังไม่ถูกอนุมัติยังไม่มีผู้อนุมัติ
    .leftJoin(approver, eq(approver.id, borrowsTable.approvedBy));

type RawRow = Omit<BorrowRow, "createdAt" | "returnedAt" | "approvedAt"> & {
  createdAt: Date;
  returnedAt: Date | null;
  approvedAt: Date | null;
};

const toBorrowRow = (row: RawRow): BorrowRow => ({
  ...row,
  createdAt: toIso(row.createdAt),
  returnedAt: toIsoOrNull(row.returnedAt),
  approvedAt: toIsoOrNull(row.approvedAt),
});

// สถานะ -> action ที่บันทึกลงประวัติ
const ACTION_FOR: Partial<Record<BorrowStatus, LogAction>> = {
  approved: "borrow_approved",
  rejected: "borrow_rejected",
  returning: "borrow_return_requested",
  returned: "borrow_returned",
};

export const borrowModel = {
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

  async create(
    input: {
      equipmentId: string;
      borrowerId: string;
      dueDate: string;
      purpose?: string | null;
    },
    actor?: Actor,
  ): Promise<BorrowRow | undefined> {
    const id = crypto.randomUUID();

    await dbClient.transaction(async (tx) => {
      await tx.insert(borrowsTable).values({
        id,
        equipmentId: input.equipmentId,
        borrowerId: input.borrowerId,
        dueDate: input.dueDate,
        purpose: input.purpose ?? null,
        status: "pending",
      });

      const item = await tx
        .select({ name: equipmentTable.name })
        .from(equipmentTable)
        .where(eq(equipmentTable.id, input.equipmentId))
        .limit(1);

      await logModel.write(
        {
          equipmentId: input.equipmentId,
          equipmentName: item[0]?.name ?? "(ถูกลบแล้ว)",
          borrowId: id,
          actorId: actor?.id ?? input.borrowerId,
          actorName: actor?.fullName ?? "(ไม่ทราบ)",
          action: "borrow_requested",
          toStatus: "pending",
          note: input.purpose ?? null,
        },
        tx,
      );
    });

    return borrowModel.findById(id);
  },

  /**
   * เปลี่ยนสถานะรายการยืม + บันทึกว่าใครเป็นคนทำ
   *
   * ต้องดูแล returnedAt ไปด้วย เพราะ schema มี CHECK บังคับว่า returned_at
   * จะมีค่าก็ต่อเมื่อ status = 'returned'
   */
  async setStatus(
    id: string,
    status: BorrowStatus,
    opts: { actor?: Actor; reason?: string | null; note?: string | null } = {},
  ): Promise<BorrowRow | undefined> {
    const before = await borrowModel.findById(id);
    if (!before) return undefined;

    await dbClient.transaction(async (tx) => {
      const isReturned = status === "returned";
      const isDecision = status === "approved" || status === "rejected";

      await tx
        .update(borrowsTable)
        .set({
          status,
          returnedAt: isReturned ? new Date() : null,
          // บันทึกผู้ตัดสินใจเฉพาะตอนอนุมัติ/ปฏิเสธ
          ...(isDecision && opts.actor
            ? { approvedBy: opts.actor.id, approvedAt: new Date() }
            : {}),
          ...(status === "rejected" ? { rejectReason: opts.reason ?? null } : {}),
          ...(isReturned && opts.actor
            ? { receivedBy: opts.actor.id, returnNote: opts.note ?? null }
            : {}),
        })
        .where(eq(borrowsTable.id, id));

      const action = ACTION_FOR[status];
      if (action) {
        await logModel.write(
          {
            equipmentId: before.equipmentId,
            equipmentName: before.equipmentName,
            borrowId: id,
            actorId: opts.actor?.id ?? null,
            actorName: opts.actor?.fullName ?? "(ระบบ)",
            action,
            fromStatus: before.status,
            toStatus: status,
            note: opts.reason ?? opts.note ?? null,
          },
          tx,
        );
      }
    });

    return borrowModel.findById(id);
  },

  async markReturned(
    id: string,
    opts: { actor?: Actor; note?: string | null } = {},
  ): Promise<BorrowRow | undefined> {
    return borrowModel.setStatus(id, "returned", opts);
  },
};

export default borrowModel;
