// จัดการตาราง borrows
//
// ทุก SELECT join equipment + users เพื่อส่ง equipmentName / borrowerName กลับไปด้วย
// ให้ตรงกับ type Borrow ใน frontend/src/types.ts (frontend อ่าน field เหล่านี้ตรงๆ)
//
// การเปลี่ยนสถานะทุกครั้งจะเขียน equipment_logs ในทรานแซกชันเดียวกันเสมอ
// ถ้าแยกกันเขียนจะมีจังหวะที่สถานะเปลี่ยนแล้วแต่ log หาย ประวัติจะเชื่อไม่ได้

import crypto from "node:crypto";
import { and, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { dbClient } from "@db/client.js";
import {
  borrowsTable,
  equipmentTable,
  HOLDING_STATUSES,
  staffDepartmentsTable,
  usersTable,
  type BorrowStatus,
  type LogAction,
} from "@db/schema.js";
import { firstOrUndefined, overlapsSql, toIso, toIsoOrNull } from "@db/models/helpers.js";
import { logModel } from "@db/models/logModel.js";

/** ผู้ที่ลงมือทำ ใช้บันทึกลงประวัติ */
export type Actor = { id: string; fullName: string };

/**
 * เปลี่ยนสถานะไม่ได้ เพราะข้อมูลเปลี่ยนไประหว่างที่ controller ตรวจกับตอนเขียนจริง
 *   status_changed — มีคนเปลี่ยนสถานะไปก่อน เช่น ผู้ยืมกดยกเลิกจังหวะเดียวกับที่ staff กดอนุมัติ
 *   unavailable    — ของชิ้นสุดท้ายถูกอนุมัติให้คนอื่นไปก่อน
 *   already_picked_up — กดรับของซ้ำ หรือเป็นรายการเก่าที่ไม่มีช่วงเวลายืม
 */
export class BorrowConflictError extends Error {
  readonly reason: "status_changed" | "unavailable" | "already_picked_up";

  constructor(reason: BorrowConflictError["reason"]) {
    super(reason);
    this.reason = reason;
    this.name = "BorrowConflictError";
  }
}

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
  // null = รายการเก่าก่อนมีช่วงเวลายืม
  details: BorrowDetails | null;
};

export type BorrowDetails = {
  borrowId: string;
  startAt: string;
  endAt: string;
  pickedUpAt: string | null;
  pickedUpBy: string | null;
};

// dbClient กับ tx ใช้ API ชุดเดียวกัน จึงรับตัวไหนก็ได้
type Executor = Pick<typeof dbClient, "select">;

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
  startAt: borrowsTable.startAt,
  endAt: borrowsTable.endAt,
  pickedUpAt: borrowsTable.pickedUpAt,
  pickedUpBy: borrowsTable.pickedUpBy,
};

const baseQuery = () =>
  dbClient
    .select(selection)
    .from(borrowsTable)
    .innerJoin(equipmentTable, eq(equipmentTable.id, borrowsTable.equipmentId))
    .innerJoin(usersTable, eq(usersTable.id, borrowsTable.borrowerId))
    // left join เพราะรายการที่ยังไม่ถูกอนุมัติยังไม่มีผู้อนุมัติ
    .leftJoin(approver, eq(approver.id, borrowsTable.approvedBy));

type RawRow = Omit<BorrowRow, "createdAt" | "returnedAt" | "approvedAt" | "details"> & {
  createdAt: Date;
  returnedAt: Date | null;
  approvedAt: Date | null;
  startAt: Date | null;
  endAt: Date | null;
  pickedUpAt: Date | null;
  pickedUpBy: string | null;
};

const toBorrowRow = ({ startAt, endAt, pickedUpAt, pickedUpBy, ...row }: RawRow): BorrowRow => ({
  ...row,
  createdAt: toIso(row.createdAt),
  returnedAt: toIsoOrNull(row.returnedAt),
  approvedAt: toIsoOrNull(row.approvedAt),
  details:
    startAt && endAt
      ? {
          borrowId: row.id,
          startAt: toIso(startAt),
          endAt: toIso(endAt),
          pickedUpAt: toIsoOrNull(pickedUpAt),
          pickedUpBy,
        }
      : null,
});

/** จำนวนที่อนุมัติแล้วและจองทับช่วงนี้ — ไม่มีช่วงเวลา = ตั้งแต่ตอนนี้ไปจนกว่าจะคืน */
const bookedCount = async (
  equipmentId: string,
  start: Date | null,
  end: Date | null,
  db: Executor = dbClient,
): Promise<number> => {
  const [row] = await db
    .select({ n: count() })
    .from(borrowsTable)
    .where(
      and(
        eq(borrowsTable.equipmentId, equipmentId),
        inArray(borrowsTable.status, [...HOLDING_STATUSES]),
        overlapsSql(start ?? sql`now()`, end ?? sql`'infinity'::timestamptz`),
      ),
    );
  return row?.n ?? 0;
};

// สถานะ -> action ที่บันทึกลงประวัติ
const ACTION_FOR: Partial<Record<BorrowStatus, LogAction>> = {
  approved: "borrow_approved",
  rejected: "borrow_rejected",
  returning: "borrow_return_requested",
  returned: "borrow_returned",
  cancelled: "borrow_cancelled",
};

export const borrowModel = {
  bookedCount,

  /**
   * ช่วงที่อุปกรณ์ชิ้นนี้ถูกจองไว้แล้ว (อนุมัติแล้วยังไม่คืน) ให้หน้าขอยืมเลือกวันได้ถูก
   * ไม่ส่งชื่อผู้ยืม เพราะผู้ยืมทุกคนเรียกได้ — null = รายการเก่าที่ไม่มีช่วงเวลา (จองจนกว่าจะคืน)
   */
  async bookingsOf(equipmentId: string): Promise<{ startAt: string | null; endAt: string | null }[]> {
    const rows = await dbClient
      .select({ startAt: borrowsTable.startAt, endAt: borrowsTable.endAt })
      .from(borrowsTable)
      .where(
        and(
          eq(borrowsTable.equipmentId, equipmentId),
          inArray(borrowsTable.status, [...HOLDING_STATUSES]),
        ),
      )
      .orderBy(borrowsTable.startAt);
    return rows.map((r) => ({ startAt: toIsoOrNull(r.startAt), endAt: toIsoOrNull(r.endAt) }));
  },

  /** staffId = เห็นเฉพาะอุปกรณ์ในแผนกที่ดูแล + อุปกรณ์ที่ไม่สังกัดแผนก */
  async listAll(opts: { staffId?: string } = {}): Promise<BorrowRow[]> {
    const rows = await baseQuery()
      .where(
        opts.staffId === undefined
          ? undefined
          : or(
              isNull(equipmentTable.departmentId),
              inArray(
                equipmentTable.departmentId,
                dbClient
                  .select({ id: staffDepartmentsTable.departmentId })
                  .from(staffDepartmentsTable)
                  .where(eq(staffDepartmentsTable.userId, opts.staffId)),
              ),
            ),
      )
      .orderBy(desc(borrowsTable.createdAt));
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
      startAt?: Date | null;
      endAt?: Date | null;
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
        startAt: input.startAt ?? null,
        endAt: input.endAt ?? null,
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
   *
   * `from` = สถานะที่ยอมให้เปลี่ยนออกมาได้ ตรวจซ้ำหลังล็อกแถวแล้ว
   * ไม่ตรง -> โยน BorrowConflictError
   */
  async setStatus(
    id: string,
    status: BorrowStatus,
    opts: {
      actor?: Actor;
      reason?: string | null;
      note?: string | null;
      from?: readonly BorrowStatus[];
    } = {},
  ): Promise<BorrowRow | undefined> {
    const before = await borrowModel.findById(id);
    if (!before) return undefined;

    await dbClient.transaction(async (tx) => {
      // controller ตรวจสถานะมาแล้วก็จริง แต่ถ้าสองคนกดพร้อมกันจะผ่านการตรวจนั้นทั้งคู่
      // จึงล็อกแถวแล้วตรวจซ้ำ คนที่มาทีหลังจะรอจนคนแรก commit แล้วเห็นสถานะใหม่
      const [current] = await tx
        .select({ status: borrowsTable.status })
        .from(borrowsTable)
        .where(eq(borrowsTable.id, id))
        .for("update");

      if (!current || (opts.from && !opts.from.includes(current.status))) {
        throw new BorrowConflictError("status_changed");
      }

      if (status === "approved") {
        // ล็อกแถว equipment ให้การอนุมัติของชิ้นเดียวกันต่อคิวกัน
        // แล้วค่อยนับในอีกคำสั่ง — คำสั่งใหม่ได้ snapshot ใหม่ จึงเห็นการอนุมัติที่เพิ่ง commit
        const [item] = await tx
          .select({ quantity: equipmentTable.quantity })
          .from(equipmentTable)
          .where(eq(equipmentTable.id, before.equipmentId))
          .for("update");

        const booked = await bookedCount(
          before.equipmentId,
          before.details ? new Date(before.details.startAt) : null,
          before.details ? new Date(before.details.endAt) : null,
          tx,
        );

        if (!item || booked >= item.quantity) {
          throw new BorrowConflictError("unavailable");
        }
      }

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
            fromStatus: current.status,
            toStatus: status,
            note: opts.reason ?? opts.note ?? null,
          },
          tx,
        );
      }
    });

    return borrowModel.findById(id);
  },

  /** ยืนยันว่ารับของแล้ว — ทำได้ครั้งเดียว เฉพาะรายการที่อนุมัติแล้วและมีช่วงเวลายืม */
  async pickup(id: string, actor: Actor): Promise<BorrowRow | undefined> {
    const before = await borrowModel.findById(id);
    if (!before) return undefined;

    await dbClient.transaction(async (tx) => {
      const updated = await tx
        .update(borrowsTable)
        .set({ pickedUpAt: new Date(), pickedUpBy: actor.id })
        .where(
          and(
            eq(borrowsTable.id, id),
            eq(borrowsTable.status, "approved"),
            isNull(borrowsTable.pickedUpAt),
            sql`${borrowsTable.startAt} IS NOT NULL`,
          ),
        )
        .returning({ id: borrowsTable.id });

      if (updated.length === 0) throw new BorrowConflictError("already_picked_up");

      await logModel.write(
        {
          equipmentId: before.equipmentId,
          equipmentName: before.equipmentName,
          borrowId: id,
          actorId: actor.id,
          actorName: actor.fullName,
          action: "borrow_picked_up",
        },
        tx,
      );
    });

    return borrowModel.findById(id);
  },

  async markReturned(
    id: string,
    opts: { actor?: Actor; note?: string | null } = {},
  ): Promise<BorrowRow | undefined> {
    return borrowModel.setStatus(id, "returned", {
      ...opts,
      from: HOLDING_STATUSES,
    });
  },
};

export default borrowModel;
