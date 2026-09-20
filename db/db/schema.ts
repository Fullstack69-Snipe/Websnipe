import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// ---------- enums ----------
// ตรงกับ Role / BorrowStatus ใน frontend/src/types.ts
export const roleEnum = pgEnum("role", ["user", "staff", "admin"]);

export const borrowStatusEnum = pgEnum("borrow_status", [
  "pending",
  "approved",
  "rejected",
  "returning",
  "returned",
]);

// ตรงกับ Role / BorrowStatus ฝั่ง frontend แบบ 1:1
export type Role = (typeof roleEnum.enumValues)[number];
export type BorrowStatus = (typeof borrowStatusEnum.enumValues)[number];

// สถานะที่ถือว่า "ถือของอยู่" — pending ไม่นับ เพราะ staff อาจปฏิเสธ
// ต้องตรงกับ HOLDING ใน backend/src/models/equipmentModel.js
export const HOLDING_STATUSES = ["approved", "returning"] as const satisfies readonly BorrowStatus[];

// ---------- users ----------
export const usersTable = pgTable(
  "users",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    role: roleEnum("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // เทียบ email แบบไม่สนตัวพิมพ์ กัน somchai@ / Somchai@ ซ้ำกัน
    uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),
    index("idx_users_role").on(table.role),
  ],
);

// ---------- equipment ----------
// ไม่มีคอลัมน์ available — คำนวณสดจาก borrows ทุกครั้ง (quantity - จำนวนที่ถือของอยู่)
// เพื่อไม่ให้ข้อมูลไม่ตรงกัน (drift) จากการเก็บตัวเลขซ้ำสองที่
export const equipmentTable = pgTable(
  "equipment",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url"),
    quantity: integer("quantity").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("equipment_quantity_non_negative", sql`${table.quantity} >= 0`),
    index("idx_equipment_created_at").on(table.createdAt),
  ],
);

// ---------- borrows ----------
// หนึ่งแถว = ยืมอุปกรณ์หนึ่งชิ้น (backend นับจำนวนด้วย COUNT(*))
export const borrowsTable = pgTable(
  "borrows",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    equipmentId: varchar("equipment_id", { length: 64 })
      .notNull()
      .references(() => equipmentTable.id, { onDelete: "restrict" }),
    borrowerId: varchar("borrower_id", { length: 64 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    // วันครบกำหนดคืน เก็บเป็นวันที่ล้วน (ไม่มีเวลา) ตาม dueDate ใน types.ts → 'YYYY-MM-DD'
    dueDate: date("due_date").notNull(),
    status: borrowStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_borrows_equipment").on(table.equipmentId),
    index("idx_borrows_borrower").on(table.borrowerId),
    index("idx_borrows_status").on(table.status),
    // หน้า MyBorrows / BorrowRequests เรียงใหม่สุดขึ้นก่อนเสมอ
    index("idx_borrows_created_at").on(table.createdAt.desc()),
    // returned ต้องมี returned_at, สถานะอื่นต้องไม่มี
    check(
      "borrows_returned_at_matches_status",
      sql`(${table.status} = 'returned') = (${table.returnedAt} IS NOT NULL)`,
    ),
  ],
);

// ---------- relations (สำหรับ dbClient.query.*.findMany({ with: ... })) ----------
export const usersRelations = relations(usersTable, ({ many }) => ({
  borrows: many(borrowsTable),
}));

export const equipmentRelations = relations(equipmentTable, ({ many }) => ({
  borrows: many(borrowsTable),
}));

export const borrowsRelations = relations(borrowsTable, ({ one }) => ({
  equipment: one(equipmentTable, {
    fields: [borrowsTable.equipmentId],
    references: [equipmentTable.id],
  }),
  borrower: one(usersTable, {
    fields: [borrowsTable.borrowerId],
    references: [usersTable.id],
  }),
}));

// ---------- inferred types ----------
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Equipment = typeof equipmentTable.$inferSelect;
export type NewEquipment = typeof equipmentTable.$inferInsert;
export type Borrow = typeof borrowsTable.$inferSelect;
export type NewBorrow = typeof borrowsTable.$inferInsert;
