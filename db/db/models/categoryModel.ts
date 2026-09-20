// หมวดหมู่อุปกรณ์
//
// ลบหมวดหมู่ได้เสมอ อุปกรณ์ที่อยู่ในหมวดนั้นจะกลายเป็น "ไม่ระบุหมวดหมู่"
// (FK เป็น SET NULL) ไม่ต้องบังคับให้ย้ายของออกก่อน

import { asc, eq, sql } from "drizzle-orm";
import { dbClient } from "@db/client.js";
import { categoriesTable, equipmentTable } from "@db/schema.js";
import { firstOrUndefined } from "@db/models/helpers.js";

export type CategoryRow = {
  id: number;
  name: string;
  description: string | null;
  equipmentCount: number;
};

export type CategoryInput = {
  name: string;
  description?: string | null;
};

// นับจำนวนอุปกรณ์ในหมวดนี้ เพื่อให้หน้าจัดการเตือนก่อนลบได้
const equipmentCountSql = sql<number>`(
  SELECT COUNT(*)::int FROM "equipment"
  WHERE "equipment"."category_id" = "categories"."id"
)`;

const selection = {
  id: categoriesTable.id,
  name: categoriesTable.name,
  description: categoriesTable.description,
  equipmentCount: equipmentCountSql,
};

export const categoryModel = {
  async listAll(): Promise<CategoryRow[]> {
    return dbClient
      .select(selection)
      .from(categoriesTable)
      .orderBy(asc(categoriesTable.name));
  },

  async findById(id: number): Promise<CategoryRow | undefined> {
    const rows = await dbClient
      .select(selection)
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .limit(1);

    return firstOrUndefined(rows);
  },

  async create(input: CategoryInput): Promise<CategoryRow | undefined> {
    const inserted = await dbClient
      .insert(categoriesTable)
      .values({ name: input.name, description: input.description ?? null })
      .returning({ id: categoriesTable.id });

    return categoryModel.findById(inserted[0]!.id);
  },

  async update(
    id: number,
    input: CategoryInput,
  ): Promise<CategoryRow | undefined> {
    await dbClient
      .update(categoriesTable)
      .set({ name: input.name, description: input.description ?? null })
      .where(eq(categoriesTable.id, id));

    return categoryModel.findById(id);
  },

  /** คืนจำนวนอุปกรณ์ที่ถูกปลดออกจากหมวดนี้ */
  async remove(id: number): Promise<number> {
    return dbClient.transaction(async (tx) => {
      const affected = await tx
        .select({ id: equipmentTable.id })
        .from(equipmentTable)
        .where(eq(equipmentTable.categoryId, id));

      await tx.delete(categoriesTable).where(eq(categoriesTable.id, id));

      return affected.length;
    });
  },
};

export default categoryModel;
