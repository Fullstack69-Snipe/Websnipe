// จัดการตาราง equipment
//
// สำคัญ: available ไม่ได้เก็บใน DB — คำนวณสดจากตาราง borrows ทุกครั้ง
// เทียบเท่า backend/src/models/equipmentModel.js (SQLite) ทุกฟังก์ชัน
// ต่างกันแค่ทุกตัวเป็น async

import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { dbClient } from "@db/client.js";
import { borrowsTable, equipmentTable, HOLDING_STATUSES } from "@db/schema.js";
import { firstOrUndefined, holdingCountSql } from "@db/models/helpers.js";

// ชื่อเดิมที่ backend export ออกไป — คงไว้เพื่อให้โค้ดที่ import อยู่ไม่พัง
export const HOLDING = [...HOLDING_STATUSES];

export type EquipmentRow = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  quantity: number;
  available: number;
};

export type EquipmentInput = {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  quantity: number;
};

// ดึง quantity กับจำนวนที่ถือของอยู่มาก่อน แล้วค่อยลบกันในชั้น JS
// (คอลัมน์ที่ส่งออกจริงคือ available ตาม type Equipment ใน types.ts)
const selection = {
  id: equipmentTable.id,
  name: equipmentTable.name,
  description: equipmentTable.description,
  imageUrl: equipmentTable.imageUrl,
  quantity: equipmentTable.quantity,
  holding: holdingCountSql,
};

const toEquipmentRow = (row: {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  quantity: number;
  holding: number;
}): EquipmentRow => {
  const { holding, ...rest } = row;
  return { ...rest, available: rest.quantity - Number(holding) };
};

export const equipmentModel = {
  async listAll(): Promise<EquipmentRow[]> {
    const rows = await dbClient
      .select(selection)
      .from(equipmentTable)
      .orderBy(equipmentTable.createdAt);

    return rows.map(toEquipmentRow);
  },

  async findById(id: string): Promise<EquipmentRow | undefined> {
    const rows = await dbClient
      .select(selection)
      .from(equipmentTable)
      .where(eq(equipmentTable.id, id))
      .limit(1);

    const row = firstOrUndefined(rows);
    return row === undefined ? undefined : toEquipmentRow(row);
  },

  // จำนวนที่กำลังถูกยืมอยู่ของอุปกรณ์ชิ้นนี้
  async borrowedCount(equipmentId: string): Promise<number> {
    const rows = await dbClient
      .select({ holding: holdingCountSql })
      .from(equipmentTable)
      .where(eq(equipmentTable.id, equipmentId))
      .limit(1);

    return Number(firstOrUndefined(rows)?.holding ?? 0);
  },

  async create(input: EquipmentInput): Promise<EquipmentRow | undefined> {
    const id = crypto.randomUUID();

    await dbClient.insert(equipmentTable).values({
      id,
      name: input.name,
      description: input.description ?? "",
      imageUrl: input.imageUrl ?? null,
      quantity: input.quantity,
    });

    return equipmentModel.findById(id);
  },

  async update(
    id: string,
    input: EquipmentInput,
  ): Promise<EquipmentRow | undefined> {
    // updatedAt ขยับเองผ่าน $onUpdate ใน schema ไม่ต้องเซ็ตมือเหมือนฝั่ง SQLite
    await dbClient
      .update(equipmentTable)
      .set({
        name: input.name,
        description: input.description ?? "",
        imageUrl: input.imageUrl ?? null,
        quantity: input.quantity,
      })
      .where(eq(equipmentTable.id, id));

    return equipmentModel.findById(id);
  },

  // ลบอุปกรณ์ + ประวัติการยืมที่ไม่ได้ถือของอยู่ (pending / rejected / returned)
  //
  // ต้องลบ borrows ทิ้งก่อน เพราะ FK เป็น ON DELETE RESTRICT
  // controller เช็คแล้วว่าไม่มีรายการสถานะ approved/returning ก่อนเรียกฟังก์ชันนี้
  //
  // คืนค่าจำนวนประวัติที่ถูกลบไป เพื่อให้ controller แจ้งผู้ใช้ได้ (เหมือนเวอร์ชัน SQLite)
  async remove(id: string): Promise<number> {
    return dbClient.transaction(async (tx) => {
      const deletedBorrows = await tx
        .delete(borrowsTable)
        .where(eq(borrowsTable.equipmentId, id))
        .returning({ id: borrowsTable.id });

      await tx.delete(equipmentTable).where(eq(equipmentTable.id, id));

      return deletedBorrows.length;
    });
  },

  HOLDING,
};

export default equipmentModel;
