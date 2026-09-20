// จัดการตาราง users — ส่งออกเป็น camelCase ให้ตรงกับ type User ใน frontend/src/types.ts
//
// เทียบเท่า backend/src/models/userModel.js (SQLite) ทุกฟังก์ชัน
// ต่างกันแค่ทุกตัวเป็น async

import { eq } from "drizzle-orm";
import { dbClient } from "@db/client.js";
import { usersTable, type Role } from "@db/schema.js";
import { firstOrUndefined } from "@db/models/helpers.js";

// เลือกเฉพาะ 4 คอลัมน์เดิม (ไม่ส่ง createdAt / updatedAt ออกไป)
// ให้ response เหมือน SELECT_USER ของเวอร์ชัน SQLite เป๊ะ
const userColumns = {
  id: usersTable.id,
  email: usersTable.email,
  fullName: usersTable.fullName,
  role: usersTable.role,
};

export type UserRow = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
};

export const userModel = {
  async listAll(): Promise<UserRow[]> {
    return dbClient
      .select(userColumns)
      .from(usersTable)
      .orderBy(usersTable.createdAt);
  },

  async findById(id: string): Promise<UserRow | undefined> {
    const rows = await dbClient
      .select(userColumns)
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    return firstOrUndefined(rows);
  },

  async setRole(id: string, role: Role): Promise<UserRow | undefined> {
    const rows = await dbClient
      .update(usersTable)
      .set({ role })
      .where(eq(usersTable.id, id))
      .returning(userColumns);

    return firstOrUndefined(rows);
  },
};

export default userModel;
