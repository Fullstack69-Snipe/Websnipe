import { relations, sql } from "drizzle-orm";
import {
  bigserial,
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

// ผู้ให้บริการ OAuth ที่รองรับ
export const authProviderEnum = pgEnum("auth_provider", [
  "google",
  "github",
  "discord",
]);

// การกระทำที่บันทึกลง equipment_logs
export const logActionEnum = pgEnum("log_action", [
  "equipment_created",
  "equipment_updated",
  "equipment_deleted",
  "borrow_requested",
  "borrow_approved",
  "borrow_rejected",
  "borrow_return_requested",
  "borrow_returned",
]);

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
export type AuthProvider = (typeof authProviderEnum.enumValues)[number];
export type LogAction = (typeof logActionEnum.enumValues)[number];

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
    avatarUrl: text("avatar_url"),
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
    purpose: text("purpose"),

    // ใครอนุมัติ/ปฏิเสธ และเมื่อไหร่ — เดิมไม่ได้เก็บเลย ตามตัวไม่ได้ว่าใครกดอะไร
    approvedBy: varchar("approved_by", { length: 64 }).references(
      () => usersTable.id,
      { onDelete: "restrict" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectReason: text("reject_reason"),

    // ใครเป็นคนรับคืน และสภาพของตอนคืน
    receivedBy: varchar("received_by", { length: 64 }).references(
      () => usersTable.id,
      { onDelete: "restrict" },
    ),
    returnNote: text("return_note"),

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

// ---------- user_identities ----------
// บัญชี OAuth ที่ผูกกับผู้ใช้หนึ่งคน (คนเดียวผูกได้ทั้ง google และ github)
// แยกเป็นตารางต่างหากแทนการเก็บ provider ไว้ใน users เพื่อให้ผูกได้หลายเจ้า
export const userIdentitiesTable = pgTable(
  "user_identities",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    provider: authProviderEnum("provider").notNull(),
    // id ของผู้ใช้ฝั่งผู้ให้บริการ (google sub / github id) — เป็นค่าที่ไม่เปลี่ยน
    // ต่างจาก email ที่ผู้ใช้เปลี่ยนเองได้ จึงใช้ตัวนี้เป็นกุญแจหลักในการจับคู่
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_identities_provider_account_unique").on(
      table.provider,
      table.providerAccountId,
    ),
    // ผูกผู้ให้บริการเจ้าหนึ่งได้บัญชีเดียวต่อผู้ใช้หนึ่งคน
    uniqueIndex("user_identities_user_provider_unique").on(
      table.userId,
      table.provider,
    ),
  ],
);

// ---------- sessions ----------
// เก็บ session ไว้ในฐานข้อมูล (ไม่ใช่ JWT) เพื่อให้ logout / ถอนสิทธิ์ได้จริง
// คุกกี้ฝั่ง browser เก็บแค่ token ที่สุ่มมา ตัวข้อมูลอยู่ที่นี่ทั้งหมด
export const sessionsTable = pgTable(
  "sessions",
  {
    // token ที่อยู่ในคุกกี้ (สุ่ม 32 ไบต์ เข้ารหัส base64url)
    id: varchar("id", { length: 128 }).primaryKey(),
    userId: varchar("user_id", { length: 64 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_sessions_user").on(table.userId),
    // ใช้ตอนกวาด session หมดอายุทิ้ง
    index("idx_sessions_expires_at").on(table.expiresAt),
  ],
);

// ---------- equipment_logs ----------
// ประวัติการเปลี่ยนแปลงทั้งหมด ตอบโจทย์ "ไม่มีประวัติ ตามของคืนยาก"
//
// เก็บชื่ออุปกรณ์/ชื่อผู้ทำไว้ซ้ำในแถว (denormalize) โดยตั้งใจ
// เพราะ log ต้องอ่านรู้เรื่องแม้อุปกรณ์ถูกลบไปแล้ว ถ้าพึ่ง JOIN อย่างเดียว
// พอลบอุปกรณ์ทิ้ง ประวัติจะกลายเป็นแถวว่างที่ไม่มีความหมาย
//
// FK จึงเป็น SET NULL ไม่ใช่ CASCADE — ลบของได้ แต่ประวัติยังอยู่
export const equipmentLogsTable = pgTable(
  "equipment_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    equipmentId: varchar("equipment_id", { length: 64 }).references(
      () => equipmentTable.id,
      { onDelete: "set null" },
    ),
    equipmentName: varchar("equipment_name", { length: 255 }).notNull(),

    borrowId: varchar("borrow_id", { length: 64 }).references(
      () => borrowsTable.id,
      { onDelete: "set null" },
    ),

    actorId: varchar("actor_id", { length: 64 }).references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    actorName: varchar("actor_name", { length: 255 }).notNull(),

    action: logActionEnum("action").notNull(),

    // สถานะก่อน/หลัง ใส่เฉพาะ action ที่เป็นการเปลี่ยนสถานะการยืม
    fromStatus: borrowStatusEnum("from_status"),
    toStatus: borrowStatusEnum("to_status"),

    note: text("note"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_log_equipment").on(table.equipmentId),
    index("idx_log_created_at").on(table.createdAt.desc()),
    index("idx_log_borrow").on(table.borrowId),
  ],
);

// ---------- relations (สำหรับ dbClient.query.*.findMany({ with: ... })) ----------
export const usersRelations = relations(usersTable, ({ many }) => ({
  borrows: many(borrowsTable),
  identities: many(userIdentitiesTable),
  sessions: many(sessionsTable),
}));

export const userIdentitiesRelations = relations(
  userIdentitiesTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [userIdentitiesTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export const sessionsRelations = relations(sessionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [sessionsTable.userId],
    references: [usersTable.id],
  }),
}));

export const equipmentRelations = relations(equipmentTable, ({ many }) => ({
  borrows: many(borrowsTable),
  logs: many(equipmentLogsTable),
}));

export const equipmentLogsRelations = relations(
  equipmentLogsTable,
  ({ one }) => ({
    equipment: one(equipmentTable, {
      fields: [equipmentLogsTable.equipmentId],
      references: [equipmentTable.id],
    }),
    borrow: one(borrowsTable, {
      fields: [equipmentLogsTable.borrowId],
      references: [borrowsTable.id],
    }),
    actor: one(usersTable, {
      fields: [equipmentLogsTable.actorId],
      references: [usersTable.id],
    }),
  }),
);

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
export type UserIdentity = typeof userIdentitiesTable.$inferSelect;
export type NewUserIdentity = typeof userIdentitiesTable.$inferInsert;
export type Session = typeof sessionsTable.$inferSelect;
export type NewSession = typeof sessionsTable.$inferInsert;
export type EquipmentLog = typeof equipmentLogsTable.$inferSelect;
export type NewEquipmentLog = typeof equipmentLogsTable.$inferInsert;
