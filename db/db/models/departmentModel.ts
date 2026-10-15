// แผนก + การมอบหมายอุปกรณ์/staff เข้าแผนก
//
// อุปกรณ์อยู่ได้แผนกเดียว (equipment.department_id) ไม่สังกัดแผนก = staff ทุกคนจัดการได้
// staff หนึ่งคนดูแลได้หลายแผนก (staff_departments)

import { and, asc, count, eq } from "drizzle-orm";
import { dbClient } from "@db/client.js";
import {
  departmentsTable,
  equipmentTable,
  staffDepartmentsTable,
  usersTable,
} from "@db/schema.js";
import { firstOrUndefined, toIso } from "@db/models/helpers.js";

export type DepartmentRow = {
  id: number;
  name: string;
  createdAt: string;
};

export type DepartmentDetail = DepartmentRow & {
  staff: { id: string; fullName: string; email: string }[];
  equipmentCount: number;
};

const toDepartmentRow = (row: { id: number; name: string; createdAt: Date }): DepartmentRow => ({
  ...row,
  createdAt: toIso(row.createdAt),
});

export const departmentModel = {
  /** พร้อมรายชื่อ staff และจำนวนอุปกรณ์ ให้หน้าจัดการแผนกเห็นว่าใครดูแลอะไรอยู่ */
  async listAll(): Promise<DepartmentDetail[]> {
    const [departments, staff, counts] = await Promise.all([
      dbClient.select().from(departmentsTable).orderBy(asc(departmentsTable.name)),
      dbClient
        .select({
          departmentId: staffDepartmentsTable.departmentId,
          id: usersTable.id,
          fullName: usersTable.fullName,
          email: usersTable.email,
        })
        .from(staffDepartmentsTable)
        .innerJoin(usersTable, eq(usersTable.id, staffDepartmentsTable.userId))
        .orderBy(asc(usersTable.fullName)),
      dbClient
        .select({ departmentId: equipmentTable.departmentId, n: count() })
        .from(equipmentTable)
        .groupBy(equipmentTable.departmentId),
    ]);

    return departments.map((d) => ({
      ...toDepartmentRow(d),
      staff: staff
        .filter((s) => s.departmentId === d.id)
        .map(({ id, fullName, email }) => ({ id, fullName, email })),
      equipmentCount: counts.find((c) => c.departmentId === d.id)?.n ?? 0,
    }));
  },

  async findById(id: number): Promise<DepartmentRow | undefined> {
    const rows = await dbClient
      .select()
      .from(departmentsTable)
      .where(eq(departmentsTable.id, id))
      .limit(1);
    const row = firstOrUndefined(rows);
    return row === undefined ? undefined : toDepartmentRow(row);
  },

  /** คืน undefined ถ้าชื่อซ้ำ */
  async create(name: string): Promise<DepartmentRow | undefined> {
    const rows = await dbClient
      .insert(departmentsTable)
      .values({ name })
      .onConflictDoNothing()
      .returning();
    const row = firstOrUndefined(rows);
    return row === undefined ? undefined : toDepartmentRow(row);
  },

  /** ชื่อซ้ำ -> โยน unique violation (23505) ให้ controller แปลงเป็น 409 */
  async rename(id: number, name: string): Promise<DepartmentRow | undefined> {
    const rows = await dbClient
      .update(departmentsTable)
      .set({ name })
      .where(eq(departmentsTable.id, id))
      .returning();
    const row = firstOrUndefined(rows);
    return row === undefined ? undefined : toDepartmentRow(row);
  },

  /** ลบแผนก — อุปกรณ์ในแผนกกลายเป็นไม่สังกัดแผนก (ไม่ถูกลบ) คืนจำนวนอุปกรณ์ที่ถูกปลดออก */
  async remove(id: number): Promise<number> {
    return dbClient.transaction(async (tx) => {
      const affected = await tx
        .update(equipmentTable)
        .set({ departmentId: null })
        .where(eq(equipmentTable.departmentId, id))
        .returning({ id: equipmentTable.id });
      // staff_departments ลบตามเองด้วย ON DELETE CASCADE
      await tx.delete(departmentsTable).where(eq(departmentsTable.id, id));
      return affected.length;
    });
  },

  /** ย้ายอุปกรณ์เข้าแผนก — ย้ายซ้ำได้ แผนกใหม่ทับแผนกเดิม */
  async assignEquipment(departmentId: number, equipmentId: string): Promise<void> {
    await dbClient
      .update(equipmentTable)
      .set({ departmentId })
      .where(eq(equipmentTable.id, equipmentId));
  },

  async assignStaff(departmentId: number, userId: string): Promise<void> {
    await dbClient
      .insert(staffDepartmentsTable)
      .values({ userId, departmentId })
      .onConflictDoNothing();
  },

  async removeStaff(departmentId: number, userId: string): Promise<void> {
    await dbClient
      .delete(staffDepartmentsTable)
      .where(
        and(
          eq(staffDepartmentsTable.departmentId, departmentId),
          eq(staffDepartmentsTable.userId, userId),
        ),
      );
  },

  /** เอาอุปกรณ์ออกจากแผนก -> กลับเป็นไม่สังกัดแผนก (เฉพาะถ้ายังอยู่แผนกนี้) */
  async unassignEquipment(departmentId: number, equipmentId: string): Promise<void> {
    await dbClient
      .update(equipmentTable)
      .set({ departmentId: null })
      .where(
        and(
          eq(equipmentTable.id, equipmentId),
          eq(equipmentTable.departmentId, departmentId),
        ),
      );
  },

  /** แผนกที่ผู้ใช้คนนี้ดูแล */
  async departmentIdsOf(userId: string): Promise<number[]> {
    const rows = await dbClient
      .select({ id: staffDepartmentsTable.departmentId })
      .from(staffDepartmentsTable)
      .where(eq(staffDepartmentsTable.userId, userId));
    return rows.map((r) => r.id);
  },

  /** staff คนนี้จัดการอุปกรณ์ชิ้นนี้ได้ไหม (ไม่ได้เช็ค role — admin ต้องเช็คเองก่อนเรียก) */
  async staffCanManage(userId: string, equipmentId: string): Promise<boolean> {
    const rows = await dbClient
      .select({ departmentId: equipmentTable.departmentId })
      .from(equipmentTable)
      .where(eq(equipmentTable.id, equipmentId))
      .limit(1);
    const departmentId = firstOrUndefined(rows)?.departmentId;
    if (departmentId == null) return true;

    const member = await dbClient
      .select({ userId: staffDepartmentsTable.userId })
      .from(staffDepartmentsTable)
      .where(
        and(
          eq(staffDepartmentsTable.userId, userId),
          eq(staffDepartmentsTable.departmentId, departmentId),
        ),
      )
      .limit(1);
    return member.length > 0;
  },
};

export default departmentModel;
