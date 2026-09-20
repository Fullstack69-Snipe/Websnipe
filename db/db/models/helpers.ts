// ตัวช่วยที่ทุก model ใช้ร่วมกัน
//
// เป้าหมายของชั้น models ทั้งหมดนี้: ส่งค่ากลับ "หน้าตาเหมือนเดิมเป๊ะ"
// กับ backend/src/models/*.js เวอร์ชัน SQLite เพื่อให้สลับมาใช้ได้โดย
// controller แทบไม่ต้องแก้ (เหลือแค่เติม await)
//
// จุดต่างที่ต้องแปลงเสมอ:
//   SQLite  เก็บเวลาเป็น TEXT -> อ่านออกมาได้ string ISO ตรงๆ
//   Postgres เก็บเป็น timestamptz -> ไดรเวอร์คืนเป็น Date object
// frontend/src/types.ts ประกาศ createdAt / returnedAt เป็น string
// จึงต้องแปลงกลับเป็น ISO string ทุกครั้งก่อนส่งออก

import { sql } from "drizzle-orm";
import { HOLDING_STATUSES } from "@db/schema.js";

/** Date -> ISO string (ของที่ NOT NULL ใน schema) */
export const toIso = (value: Date): string => value.toISOString();

/** Date | null -> ISO string | null (คง null ไว้ ไม่แปลงเป็น undefined) */
export const toIsoOrNull = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

/**
 * better-sqlite3 `.get()` คืน undefined เมื่อไม่พบแถว และ controller ทุกตัว
 * เช็คด้วย `if (!item)` — ฝั่ง drizzle คืน [] จึงต้องแปลงให้ตรงกัน
 */
export const firstOrUndefined = <T>(rows: T[]): T | undefined => rows[0];

/**
 * จำนวนที่ถูกยืมอยู่ของอุปกรณ์แต่ละชิ้น (นับเฉพาะสถานะใน HOLDING_STATUSES)
 * ใช้เป็น subquery ซ้ำได้ทั้งใน SELECT และที่อื่น
 */
// ชื่อตาราง/คอลัมน์เขียนเต็มเองแทนการฝัง object ของ drizzle
//
// เหตุผล: drizzle จะตัดชื่อตารางนำหน้าทิ้งเมื่อ query มีตารางเดียว ทำให้ subquery นี้
// ถูก render เป็น WHERE "equipment_id" = "id" — ซึ่ง "id" ไปตรงกับ borrows.id
// (ตาราง borrows มีคอลัมน์ id อยู่จริง) Postgres จึงไม่ error แต่ได้ตัวเลขผิดเงียบๆ
// เขียน "borrows"."equipment_id" = "equipment"."id" ตรงๆ จึงชัวร์กว่า
//
// ส่วนค่าสถานะยังส่งเป็น parameter ตามปกติ
export const holdingCountSql = sql<number>`(
  SELECT COUNT(*)::int FROM "borrows"
  WHERE "borrows"."equipment_id" = "equipment"."id"
    AND "borrows"."status" = ANY(ARRAY[${sql.join(
      HOLDING_STATUSES.map((status) => sql`${status}`),
      sql`, `,
    )}]::borrow_status[])
)`;
